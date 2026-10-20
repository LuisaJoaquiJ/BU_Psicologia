// Salidas de Salud integral con inscripcion: el personal de Salud publica la
// salida, los estudiantes se inscriben (con comprobante si se pide) y el
// personal revisa y descarga el listado para la ARL o el seguro.

const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-salidas-"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

const PDF = Buffer.from("%PDF-1.4\n%%EOF");
const enDias = (n) => new Date(Date.now() - 5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const SALIDA = {
  nombre: "Visita técnica Medellín",
  destino: "Medellín, Antioquia",
  responsable: "Víctor Ruiz",
  fechaSalida: enDias(20),
  fechaRegreso: enDias(22),
  horaSalida: "05:00",
  cupos: 2,
  costo: 700000,
  infoPago: "Consignar el 50 % a la cuenta indicada.",
  pideComprobante: true,
  fechaLimiteInscripcion: enDias(10),
};
const DATOS = { tipoDocumento: "CC", documento: "1061700123", programa: "Ingeniería Civil", celular: "3104567890", eps: "Nueva EPS", consentimiento: "true" };

let salud;
beforeEach(() => {
  prisma.__reset();
  salud = crearUsuario("Salud", "salud@uniautonoma.edu.co");
});
afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

const personal = (metodo, ruta) => request(app)[metodo](`/api/v1/salud/salidas-inscripcion${ruta}`).set(auth(salud.token));
const estudianteApi = (est, metodo, ruta) => request(app)[metodo](`/api/v1/salud/estudiante${ruta}`).set(auth(est.token));
function inscribir(est, id, datos = DATOS, conArchivo = true) {
  let r = estudianteApi(est, "post", `/salidas/${id}/inscripcion`);
  for (const [k, v] of Object.entries(datos)) r = r.field(k, v);
  if (conArchivo) r = r.attach("comprobante", PDF, { filename: "pago.pdf", contentType: "application/pdf" });
  return r;
}

async function salidaPublicada(extra = {}) {
  const res = await personal("post", "").send({ ...SALIDA, ...extra, estado: "Publicada" });
  expect(res.status).toBe(201);
  return res.body.salida;
}

describe("Salidas con inscripción de estudiantes", () => {
  test("solo el personal de Salud crea salidas, y el borrador no lo ve el estudiante", async () => {
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    expect((await request(app).post("/api/v1/salud/salidas-inscripcion").set(auth(est.token)).send(SALIDA)).status).toBe(403);
    const borrador = await personal("post", "").send(SALIDA);
    expect(borrador.body.salida.estado).toBe("Borrador");
    expect((await estudianteApi(est, "get", "/salidas")).body.salidas).toHaveLength(0);
    await personal("patch", `/${borrador.body.salida.id}/estado`).send({ estado: "Publicada" });
    const vista = await estudianteApi(est, "get", "/salidas");
    expect(vista.body.salidas[0]).toMatchObject({ nombre: SALIDA.nombre, inscripcionAbierta: true, cuposDisponibles: 2 });
    expect(vista.body.programas.length).toBeGreaterThan(5);
  });

  test("valida fechas y cupos de la salida", async () => {
    expect((await personal("post", "").send({ ...SALIDA, fechaRegreso: enDias(19) })).status).toBe(400);
    expect((await personal("post", "").send({ ...SALIDA, fechaLimiteInscripcion: enDias(21) })).status).toBe(400);
    expect((await personal("post", "").send({ ...SALIDA, cupos: 0 })).status).toBe(400);
  });

  test("el estudiante se inscribe con sus datos y el comprobante; no se repite ni pasa los cupos", async () => {
    const salida = await salidaPublicada();
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co");
    const b = crearUsuario("Estudiante", "b@uniautonoma.edu.co");
    const c = crearUsuario("Estudiante", "c@uniautonoma.edu.co");

    expect((await inscribir(a, salida.id, DATOS, false)).status).toBe(400); // falta comprobante
    expect((await inscribir(a, salida.id, { ...DATOS, consentimiento: "false" })).status).toBe(400);
    const ok = await inscribir(a, salida.id);
    expect(ok.status).toBe(201);
    expect(ok.body.inscripcion).toMatchObject({ estado: "Pendiente", correo: "a@uniautonoma.edu.co", tieneComprobante: true });
    expect(ok.body.inscripcion.comprobante).toBeUndefined();
    expect((await inscribir(a, salida.id)).status).toBe(409);
    expect((await inscribir(b, salida.id)).status).toBe(201);
    const lleno = await inscribir(c, salida.id);
    expect(lleno.status).toBe(409);
    expect(lleno.body.message).toMatch(/cupos/);
  });

  test("el personal revisa, el rechazo pide motivo y el listado para la ARL trae a los aprobados", async () => {
    const salida = await salidaPublicada({ cupos: 5 });
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co", "Ana Pérez");
    const b = crearUsuario("Estudiante", "b@uniautonoma.edu.co", "Bruno Díaz");
    await inscribir(a, salida.id);
    await inscribir(b, salida.id);
    const { inscripciones } = (await personal("get", `/${salida.id}/inscripciones`)).body;
    expect(inscripciones).toHaveLength(2);
    const [ia, ib] = inscripciones;

    const comp = await personal("get", `/${salida.id}/inscripciones/${ia.id}/comprobante`);
    expect(comp.status).toBe(200);

    expect((await personal("patch", `/${salida.id}/inscripciones/${ib.id}`).send({ estado: "Rechazada" })).status).toBe(400);
    expect((await personal("patch", `/${salida.id}/inscripciones/${ib.id}`).send({ estado: "Rechazada", observacion: "El comprobante no es legible" })).status).toBe(200);
    expect((await personal("patch", `/${salida.id}/inscripciones/${ia.id}`).send({ estado: "Aprobada" })).body.inscripcion.estado).toBe("Aprobada");

    const vistaB = await estudianteApi(b, "get", "/salidas");
    expect(vistaB.body.misInscripciones[0]).toMatchObject({ estado: "Rechazada", observacion: "El comprobante no es legible" });

    const xlsx = await personal("get", `/${salida.id}/listado`).buffer(true).parse((res, cb) => {
      const partes = [];
      res.on("data", (d) => partes.push(d));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });
    expect(xlsx.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(xlsx.body);
    const filas = [];
    libro.worksheets[0].eachRow((r) => filas.push(r.values.slice(1).join("|")));
    expect(filas.some((f) => f.includes("Ana Pérez") && f.includes("Nueva EPS"))).toBe(true);
    expect(filas.some((f) => f.includes("Bruno Díaz"))).toBe(false);

    // Tras el rechazo puede corregir e inscribirse de nuevo.
    expect((await inscribir(b, salida.id)).status).toBe(201);
  });

  test("el estudiante cancela su inscripción y libera el cupo", async () => {
    const salida = await salidaPublicada({ cupos: 1 });
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co");
    const b = crearUsuario("Estudiante", "b@uniautonoma.edu.co");
    await inscribir(a, salida.id);
    expect((await estudianteApi(a, "patch", `/salidas/${salida.id}/inscripcion/cancelar`)).body.inscripcion.estado).toBe("Cancelada");
    expect((await inscribir(b, salida.id)).status).toBe(201);
    expect((await personal("delete", `/${salida.id}`)).status).toBe(409); // tiene inscripciones
  });
});

describe("Inscripción abierta desde un reporte SST", () => {
  const reporteSst = (extra = {}) =>
    prisma.reporteSST.create({
      data: {
        tipo: "SalidaEstudiantesRegional",
        reportadoPorId: salud.usuario.id,
        evento: "Práctica de campo en el Cauca",
        motivo: "Reconocimiento de ecosistemas.",
        destino: "Popayán, Cauca",
        responsableNombre: "Ana Gómez",
        numeroEstudiantes: 25,
        fechaSalida: new Date(`${enDias(15)}T00:00:00Z`),
        fechaRegreso: new Date(`${enDias(16)}T00:00:00Z`),
        horaSalida: "06:00",
        horaRegreso: "19:00",
        ...extra,
      },
    });
  const abrir = (id) => request(app).post(`/api/v1/salud/reportes-sst/${id}/convocatoria`).set(auth(salud.token));

  test("crea el borrador con los datos del reporte y no lo duplica", async () => {
    const reporte = await reporteSst();
    const res = await abrir(reporte.id);
    expect(res.status).toBe(201);
    expect(res.body.salida).toMatchObject({
      nombre: "Práctica de campo en el Cauca",
      destino: "Popayán, Cauca",
      responsable: "Ana Gómez",
      cupos: 25,
      estado: "Borrador",
      fechaSalida: enDias(15),
      fechaRegreso: enDias(16),
      fechaLimiteInscripcion: enDias(14),
      reporteSstId: reporte.id,
    });
    const otra = await abrir(reporte.id);
    expect(otra.status).toBe(200);
    expect(otra.body.salida.id).toBe(res.body.salida.id);
    expect((await personal("get", "")).body.salidas).toHaveLength(1);

    // El detalle del reporte muestra la convocatoria enlazada.
    const detalle = await request(app).get(`/api/v1/reportes-sst/${reporte.id}`).set(auth(salud.token));
    expect(detalle.body.reporte.convocatoria).toEqual({ id: res.body.salida.id, estado: "Borrador" });
  });

  test("solo salidas con estudiantes que aún no pasan, y solo el personal de Salud", async () => {
    const representacion = await reporteSst({ tipo: "RepresentacionNacional" });
    expect((await abrir(representacion.id)).status).toBe(409);
    const pasada = await reporteSst({ fechaSalida: new Date(`${enDias(-3)}T00:00:00Z`), fechaRegreso: new Date(`${enDias(-2)}T00:00:00Z`) });
    expect((await abrir(pasada.id)).status).toBe(409);
    expect((await abrir("no-existe")).status).toBe(404);
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const reporte = await reporteSst();
    expect((await request(app).post(`/api/v1/salud/reportes-sst/${reporte.id}/convocatoria`).set(auth(est.token))).status).toBe(403);
  });

  test("al verificar el reporte la salida se publica sola a los estudiantes", async () => {
    const reporte = await reporteSst({ adjuntos: { create: [{ tipo: "Poliza", nombreArchivo: "poliza.pdf", ruta: "x/poliza.pdf", tipoMime: "application/pdf", tamano: 10 }] } });
    const res = await request(app).patch(`/api/v1/salud/reportes-sst/${reporte.id}`).set(auth(salud.token)).send({ estado: "Verificado" });
    expect(res.status).toBe(200);
    expect(res.body.reporte.convocatoria).toMatchObject({ estado: "Publicada" });
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const vista = await estudianteApi(est, "get", "/salidas");
    expect(vista.body.salidas).toHaveLength(1);
    expect(vista.body.salidas[0]).toMatchObject({ nombre: "Práctica de campo en el Cauca", inscripcionAbierta: true, cuposDisponibles: 25 });
  });

  test("las salidas ya verificadas sin convocatoria aparecen al estudiante", async () => {
    await reporteSst({ estado: "Verificado" });
    await reporteSst({ estado: "Recibido", evento: "Sin verificar" });
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const vista = await estudianteApi(est, "get", "/salidas");
    expect(vista.body.salidas.map((s) => s.nombre)).toEqual(["Práctica de campo en el Cauca"]);
    expect((await estudianteApi(est, "get", "/salidas")).body.salidas).toHaveLength(1); // no se duplica
  });
});
