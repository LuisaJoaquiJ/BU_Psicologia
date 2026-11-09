// Lo que pedia el tablero de Arte y Cultura y faltaba en el modulo:
// el oficio de invitacion de cada delegacion, el inventario con prestamos
// (vestuario, instrumentos) y los pendientes de logistica (gestionar el bus,
// entregar el SNIES).
const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-cultura-"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

const dia = (n) => {
  const b = hoyBogota();
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + n)).toISOString().slice(0, 10);
};

describe("Logística de Arte y Cultura", () => {
  let personal;
  let monitor;
  let ana;

  beforeEach(async () => {
    prisma.__reset();
    personal = crearUsuario("Administrador", "cultura.log@uniautonoma.edu.co", "Coordinación");
    monitor = crearUsuario("Administrador", "monitor.log@uniautonoma.edu.co", "Monitor");
    ana = crearUsuario("Estudiante", "ana.log@uniautonoma.edu.co", "Ana Log");
    prisma.__darAcceso("cultura.log@uniautonoma.edu.co", "cultura");
    prisma.__darAcceso("monitor.log@uniautonoma.edu.co", "cultura");
    await prisma.rolOperativoCultural.create({ data: { email: "monitor.log@uniautonoma.edu.co", rol: "monitor" } });
  });

  const adm = (metodo, ruta, token = personal.token) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(token));

  test("el oficio de invitación queda adjunto a la delegación", async () => {
    const red = await adm("post", "/representaciones").send({ red: "ASIES", nombre: "Global Fest", fecha: dia(3), participantes: [ana.usuario.emailInstitucional] });
    expect(red.status).toBe(201);
    const subida = await adm("post", "/evidencias")
      .field("representacionId", red.body.id)
      .field("tipo", "oficio")
      .attach("evidencia", Buffer.from("%PDF-1.4 oficio"), { filename: "oficio-global-fest.pdf", contentType: "application/pdf" });
    expect(subida.status).toBe(201);
    expect(subida.body.tipo).toBe("oficio");

    const lista = await adm("get", "/representaciones");
    expect(lista.body[0].documentos).toEqual([expect.objectContaining({ tipo: "oficio", nombreOriginal: "oficio-global-fest.pdf" })]);
    const archivo = await adm("get", `/evidencias/${subida.body.id}/archivo`);
    expect(archivo.status).toBe(200);
  });

  test("el inventario descuenta lo prestado y lo dañado al devolver", async () => {
    const vestido = await adm("post", "/inventario").send({ nombre: "Vestido de cumbia", categoria: "vestuario", cantidadTotal: 10, ubicacion: "Bodega 2" });
    expect(vestido.status).toBe(201);

    const prestamo = await adm("post", `/inventario/${vestido.body.id}/prestamos`).send({ cantidad: 8, responsable: "Grupo de danzas", motivo: "Global Fest", fechaDevolucionEsperada: dia(2) });
    expect(prestamo.status).toBe(201);
    const demasiado = await adm("post", `/inventario/${vestido.body.id}/prestamos`).send({ cantidad: 3, responsable: "Otra persona", fechaDevolucionEsperada: dia(2) });
    expect(demasiado.status).toBe(409);

    let lista = await adm("get", "/inventario");
    expect(lista.body[0]).toMatchObject({ prestados: 8, disponibles: 2 });

    const devuelto = await adm("post", `/prestamos/${prestamo.body.id}/devolucion`).send({ devueltosDanados: 1 });
    expect(devuelto.status).toBe(200);
    expect(devuelto.body).toMatchObject({ prestados: 0, cantidadDanada: 1, disponibles: 9 });
    expect((await adm("post", `/prestamos/${prestamo.body.id}/devolucion`).send({})).status).toBe(409);
  });

  test("un monitor presta, pero no crea artículos", async () => {
    const guitarra = await adm("post", "/inventario").send({ nombre: "Guitarra acústica", categoria: "instrumento", cantidadTotal: 4 });
    expect((await adm("post", "/inventario", monitor.token).send({ nombre: "Piano", categoria: "instrumento" })).status).toBe(403);
    const r = await adm("post", `/inventario/${guitarra.body.id}/prestamos`, monitor.token).send({ responsable: "Taller de guitarra", fechaDevolucionEsperada: dia(0) });
    expect(r.status).toBe(201);
  });

  test("los pendientes muestran cuáles vencieron y se marcan como hechos", async () => {
    const evento = await adm("post", "/agenda").send({ nombre: "Teatro en Timbío", fecha: dia(4), fechaLimite: dia(4), horaInicio: "08:00", horaFin: "12:00", cupo: 20, estado: "Publicado" });
    const bus = await adm("post", "/pendientes").send({ titulo: "Gestionar bus", categoria: "logistica", fechaLimite: dia(2), responsable: "Monitor", eventoId: evento.body.id });
    expect(bus.status).toBe(201);
    expect(bus.body).toMatchObject({ evento: "Teatro en Timbío", diasRestantes: 2, vencida: false });

    const snies = await adm("post", "/pendientes").send({ titulo: "Entregar SNIES", categoria: "informe", fechaLimite: dia(-1) });
    expect(snies.body.vencida).toBe(true);

    const hecha = await adm("patch", `/pendientes/${snies.body.id}`, monitor.token).send({ hecha: true });
    expect(hecha.status).toBe(200);
    expect(hecha.body).toMatchObject({ hecha: true, vencida: false });

    const lista = await adm("get", "/pendientes");
    expect(lista.body.map((t) => t.titulo)).toEqual(["Entregar SNIES", "Gestionar bus"]);
    expect((await adm("delete", `/pendientes/${bus.body.id}`, monitor.token)).status).toBe(403);
    expect((await adm("delete", `/pendientes/${bus.body.id}`)).status).toBe(200);
  });

  test("el estudiante no ve el inventario ni los pendientes", async () => {
    expect((await adm("get", "/inventario", ana.token)).status).toBe(403);
    expect((await adm("get", "/pendientes", ana.token)).status).toBe(403);
  });
});

describe("Roles del personal de Arte y Cultura", () => {
  let coordinadora;

  beforeEach(() => {
    prisma.__reset();
    coordinadora = crearUsuario("Administrador", "coordina.rol@uniautonoma.edu.co", "Coordinadora");
    prisma.__darAcceso("coordina.rol@uniautonoma.edu.co", "cultura");
  });

  const adm = (metodo, ruta, token = coordinadora.token) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(token));

  test("el panel sabe el rol de quien entra", async () => {
    const r = await adm("get", "/mi-rol");
    expect(r.body).toEqual({ rol: "administrador" });
  });

  test("la última administradora no puede quitarse el rol", async () => {
    const r = await adm("put", "/equipo").send({ email: "coordina.rol@uniautonoma.edu.co", rol: "docente" });
    expect(r.status).toBe(409);
    expect((await adm("get", "/representaciones")).status).toBe(200);

    prisma.__darAcceso("otra.coord@uniautonoma.edu.co", "cultura");
    expect((await adm("put", "/equipo").send({ email: "coordina.rol@uniautonoma.edu.co", rol: "docente" })).status).toBe(200);
    expect((await adm("get", "/mi-rol")).body.rol).toBe("docente");
  });
});

describe("Fotos de convocatorias y pausas creativas", () => {
  let coordinacion;
  let estudiante;
  const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");

  beforeEach(() => {
    prisma.__reset();
    coordinacion = crearUsuario("Administrador", "fotos.cultura@uniautonoma.edu.co", "Coordinación");
    estudiante = crearUsuario("Estudiante", "fotos.est@uniautonoma.edu.co", "Estudiante");
    prisma.__darAcceso("fotos.cultura@uniautonoma.edu.co", "cultura");
  });

  const adm = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(coordinacion.token));

  test("la convocatoria tiene foto pública que ve el estudiante y se puede quitar", async () => {
    const conv = await adm("post", "/convocatorias").send({ titulo: "Audiciones Uniautónoma Band", cierra: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), cupo: 6 });
    expect(conv.status).toBe(201);
    const subida = await adm("post", `/convocatorias/${conv.body.id}/imagen`).attach("imagen", PNG, { filename: "banda.png", contentType: "image/png" });
    expect(subida.status).toBe(200);
    expect(subida.body.imagenUrl.startsWith(`/api/v1/cultura/publico/imagenes/convocatorias/${conv.body.id}?v=`)).toBe(true);

    const vista = await request(app).get("/api/v1/cultura/convocatorias").set(auth(estudiante.token));
    expect(vista.body[0].imagenUrl).toBe(subida.body.imagenUrl);
    expect((await request(app).get(subida.body.imagenUrl)).status).toBe(200); // sin sesion

    expect((await adm("delete", `/convocatorias/${conv.body.id}/imagen`)).body.imagenUrl).toBeNull();
    expect((await request(app).get(`/api/v1/cultura/publico/imagenes/convocatorias/${conv.body.id}`)).status).toBe(404);
  });

  test("el grupo tiene foto pública que ve el estudiante en la oferta", async () => {
    const area = await prisma.areaCultural.create({ data: { nombre: "Danzas folclóricas", categoria: "taller" } });
    const grupo = await adm("post", "/grupos").send({ areaId: area.id, nombre: "Danzas folclóricas", cupo: 20, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }] });
    expect(grupo.status).toBe(201);
    const subida = await adm("post", `/grupos/${grupo.body.id}/imagen`).attach("imagen", PNG, { filename: "danzas.png", contentType: "image/png" });
    expect(subida.status).toBe(200);
    expect((await adm("get", "/grupos")).body[0].imagenUrl).toBe(subida.body.imagenUrl);
    const oferta = await request(app).get("/api/v1/cultura/grupos").set(auth(estudiante.token));
    expect(oferta.body.areas[0].grupos[0].imagenUrl).toBe(subida.body.imagenUrl);
    expect((await request(app).get(subida.body.imagenUrl)).status).toBe(200);
  });

  test("la lista de pausas trae sus fotos para mostrarlas", async () => {
    const pausa = await adm("post", "/pausas").send({ fecha: new Date().toISOString().slice(0, 10), horaInicio: "10:00", horaFin: "11:00", lugar: "Cafetería", tecnica: "Origami", impactoEstimado: 15 });
    await adm("post", "/evidencias").field("pausaId", pausa.body.id).field("tipo", "fotografia").attach("evidencia", PNG, { filename: "origami.png", contentType: "image/png" });
    const lista = await adm("get", "/pausas");
    expect(lista.body[0].fotos).toEqual([expect.objectContaining({ nombreOriginal: "origami.png" })]);
  });
});

describe("Grupos representativos: se entra por audición", () => {
  let coordinacion;
  let ana;
  let band;
  let taller;

  beforeEach(async () => {
    prisma.__reset();
    coordinacion = crearUsuario("Administrador", "audicion.cultura@uniautonoma.edu.co", "Coordinación");
    ana = crearUsuario("Estudiante", "ana.audicion@uniautonoma.edu.co", "Ana Audición");
    prisma.__darAcceso("audicion.cultura@uniautonoma.edu.co", "cultura");
    const representativo = await prisma.areaCultural.create({ data: { nombre: "Uniautónoma Band", categoria: "representativo" } });
    const guitarra = await prisma.areaCultural.create({ data: { nombre: "Guitarra", categoria: "taller" } });
    const crear = (areaId, nombre, dia) => request(app).post("/api/v1/cultura/admin/grupos").set(auth(coordinacion.token)).send({ areaId, nombre, cupo: 10, horario: [{ dia, inicio: "14:00", fin: "16:00" }] });
    band = (await crear(representativo.id, "Uniautónoma Band", 2)).body;
    taller = (await crear(guitarra.id, "Taller de guitarra", 3)).body;
  });

  const adm = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(coordinacion.token));
  const est = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura${ruta}`).set(auth(ana.token));

  test("no hay inscripción directa a un grupo representativo", async () => {
    const r = await est("post", `/grupos/${band.id}/inscripcion`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("A Uniautónoma Band se entra por audición: postúlate en su convocatoria.");
    expect((await est("post", `/grupos/${taller.id}/inscripcion`).send({})).status).toBe(200);
  });

  test("al aceptar la postulación queda inscrita en el grupo y no se postula otra vez", async () => {
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const conv = await adm("post", "/convocatorias").send({ titulo: "Audiciones Uniautónoma Band", cierra, cupo: 5, grupoId: band.id });
    expect(conv.status).toBe(201);

    const oferta = await est("get", "/grupos");
    const grupoBand = oferta.body.areas.flatMap((a) => a.grupos).find((g) => g.id === band.id);
    expect(grupoBand).toMatchObject({ ingreso: "audicion", audicion: { id: conv.body.id } });

    expect((await est("post", `/convocatorias/${conv.body.id}/postulacion`).send({ motivacion: "Canto desde el colegio." })).status).toBe(201);
    const lista = await adm("get", "/convocatorias");
    expect(lista.body[0].grupo).toBe("Uniautónoma Band");
    const idPost = lista.body[0].postulaciones[0].id;
    expect((await adm("patch", `/postulaciones/${idPost}`).send({ estado: "Aceptada" })).status).toBe(409); // sin audición no se acepta
    const hoyBogota = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    await adm("patch", `/postulaciones/${idPost}/audicion`).send({ fecha: cierra, hora: "10:00", lugar: "Auditorio" });
    expect((await adm("patch", `/postulaciones/${idPost}`).send({ estado: "Aceptada" })).status).toBe(409); // aún no es el día
    await adm("patch", `/postulaciones/${idPost}/audicion`).send({ fecha: hoyBogota, hora: "10:00", lugar: "Auditorio" });
    expect((await adm("patch", `/postulaciones/${idPost}`).send({ estado: "Aceptada" })).status).toBe(200);

    const despues = await est("get", "/grupos");
    expect(despues.body.areas.flatMap((a) => a.grupos).find((g) => g.id === band.id).inscrito).toBe(true);
    expect(despues.body.inscritas).toBe(0); // el limite cuenta solo talleres
    const convocatorias = await est("get", "/convocatorias");
    expect(convocatorias.body[0]).toMatchObject({ grupo: "Uniautónoma Band", esMiembro: true });
  });

  test("avance de la postulación: recibida, citada a audición y decisión con comentario", async () => {
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const conv = await adm("post", "/convocatorias").send({ titulo: "Audiciones", cierra, grupoId: band.id });
    await est("post", `/convocatorias/${conv.body.id}/postulacion`).send({ motivacion: "Canto desde el colegio." });
    const id = (await adm("get", "/convocatorias")).body[0].postulaciones[0].id;
    expect((await est("get", "/convocatorias")).body[0].postulacion).toMatchObject({ estado: "Recibida", audicion: null });

    expect((await adm("patch", `/postulaciones/${id}/audicion`).send({ fecha: "2020-01-01", hora: "10:00", lugar: "Auditorio" })).status).toBe(400);
    expect((await adm("patch", `/postulaciones/${id}/audicion`).send({ fecha: cierra, hora: "10:00" })).status).toBe(400);
    expect((await adm("patch", `/postulaciones/${id}/audicion`).send({ fecha: cierra, hora: "10:00", lugar: "Auditorio" })).status).toBe(200);
    expect((await est("get", "/convocatorias")).body[0].postulacion).toMatchObject({ estado: "Citada", audicion: { fecha: cierra, hora: "10:00", lugar: "Auditorio" } });

    await adm("patch", `/postulaciones/${id}`).send({ estado: "Rechazada", observacion: "Gracias, intenta en la próxima." });
    expect((await est("get", "/convocatorias")).body[0].postulacion).toMatchObject({ estado: "Rechazada", observacion: "Gracias, intenta en la próxima." });
    expect((await adm("patch", `/postulaciones/${id}/audicion`).send({ fecha: cierra, hora: "11:00", lugar: "Sala" })).status).toBe(409);
  });
});
