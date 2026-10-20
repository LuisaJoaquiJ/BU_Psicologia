// Modulo Deporte: oferta por grupos, inscripcion con cupo, cruce de horario y
// maximo de grupos, asistencia por sesion, horas acumuladas hacia las 40
// requeridas, horas reconocidas, constancia y reporte.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

// Reloj fijo a las 7:00 a. m. de hoy (hora de Bogota, en medio de las clases de 6 a 8) para que las reglas de hora
// (la asistencia se activa a la hora de inicio) no dependan de cuando corran las pruebas.
const ahoraReal = new Date(Date.now() - 5 * 3600e3);
const MEDIODIA = Date.UTC(ahoraReal.getUTCFullYear(), ahoraReal.getUTCMonth(), ahoraReal.getUTCDate(), 12, 0);
beforeAll(() => jest.useFakeTimers({ now: MEDIODIA, doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "hrtime", "performance"] }));
afterAll(() => jest.useRealTimers());

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");
const { diaSemana, periodoActual } = require("../src/modules/deporte/utils");

const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};
const hoy = () => hoyBogota().toISOString().slice(0, 10);
const diaHoy = () => diaSemana(hoyBogota());
const otroDia = () => (diaHoy() % 7) + 1;

let laura;
let andres;
let instructor;
let salud;
let natacion;
let ajedrez;
beforeEach(async () => {
  prisma.__reset();
  laura = crearUsuario("Estudiante", "laura.munoz@uniautonoma.edu.co", "Laura Muñoz");
  andres = crearUsuario("Estudiante", "andres.gomez@uniautonoma.edu.co", "Andrés Gómez");
  instructor = crearUsuario("Administrador", "deportes@uniautonoma.edu.co", "Coordinación de Deportes");
  prisma.__darAcceso("deportes@uniautonoma.edu.co", "deporte");
  salud = crearUsuario("Salud", "enfermeria@uniautonoma.edu.co");
  natacion = await prisma.disciplinaDeportiva.create({ data: { nombre: "Natación", tipo: "Individual" } });
  ajedrez = await prisma.disciplinaDeportiva.create({ data: { nombre: "Ajedrez", tipo: "Mental" } });
});

const adm = (metodo, ruta, token = instructor.token) => request(app)[metodo](`/api/v1/deporte/admin${ruta}`).set(auth(token));
const est = (metodo, ruta, token = laura.token) => request(app)[metodo](`/api/v1/deporte${ruta}`).set(auth(token));

async function crearGrupo(datos = {}) {
  const res = await adm("post", "/grupos").send({
    disciplinaId: natacion.id,
    nombre: "Natación · Grupo 1",
    instructor: "Carlos Ruiz",
    lugar: "Piscina Comfacauca",
    cupo: 2,
    horario: [{ dia: diaHoy(), inicio: "6:00", fin: "08:00" }],
    ...datos,
  });
  expect(res.status).toBe(201);
  return res.body.grupo;
}

describe("Acceso al módulo Deporte", () => {
  it("el panel es solo del personal asignado a Deporte", async () => {
    expect((await adm("get", "/resumen", salud.token)).status).toBe(403);
    expect((await adm("get", "/resumen", laura.token)).status).toBe(403);
    expect((await adm("get", "/resumen")).status).toBe(200);
    const me = await request(app).get("/api/v1/auth/me").set(auth(instructor.token));
    expect(me.body.usuario.modulos).toContain("deporte");
  });

  it("el superadministrador puede asignar personal al módulo", async () => {
    const superadmin = crearUsuario("SuperAdministrador", "super@uniautonoma.edu.co");
    const res = await request(app).post("/api/v1/super/accesos").set(auth(superadmin.token)).send({ email: "instructor2@uniautonoma.edu.co", modulo: "deporte" });
    expect(res.status).toBe(201);
    const resumen = await request(app).get("/api/v1/super/resumen").set(auth(superadmin.token));
    expect(resumen.body.modulos.map((m) => m.id)).toContain("deporte");
  });
});

describe("Grupos y oferta", () => {
  it("valida el horario del grupo", async () => {
    const malo = await adm("post", "/grupos").send({ disciplinaId: natacion.id, nombre: "X", horario: [{ dia: 1, inicio: "08:00", fin: "07:00" }] });
    expect(malo.status).toBe(400);
    const cruzado = await adm("post", "/grupos").send({
      disciplinaId: natacion.id,
      nombre: "X",
      horario: [
        { dia: 1, inicio: "08:00", fin: "10:00" },
        { dia: 1, inicio: "09:00", fin: "11:00" },
      ],
    });
    expect(cruzado.status).toBe(400);
    const grupo = await crearGrupo();
    expect(grupo).toMatchObject({ periodo: periodoActual(), horasSemana: 2, cuposDisponibles: 2 });
    expect(grupo.horario[0].inicio).toBe("06:00");
  });

  it("el estudiante ve la oferta del periodo con cupos y su estado", async () => {
    const grupo = await crearGrupo();
    await adm("post", "/grupos").send({ disciplinaId: natacion.id, periodo: "2020-1", nombre: "Viejo", horario: [{ dia: 1, inicio: "08:00", fin: "09:00" }] });
    const res = await est("get", "/oferta");
    expect(res.status).toBe(200);
    const nat = res.body.disciplinas.find((d) => d.nombre === "Natación");
    expect(nat.grupos).toHaveLength(1);
    expect(nat.grupos[0]).toMatchObject({ id: grupo.id, inscrito: false, cuposDisponibles: 2 });
    expect((await est("get", "/oferta", instructor.token)).status).toBe(403);
  });
});

describe("Inscripciones", () => {
  it("inscribe, respeta el cupo y permite retirarse y volver", async () => {
    const grupo = await crearGrupo({ cupo: 1 });
    const ok = await est("post", `/grupos/${grupo.id}/inscripcion`);
    expect(ok.status).toBe(201);
    expect(ok.body.disciplinas.find((d) => d.nombre === "Natación").grupos[0].inscrito).toBe(true);
    expect((await est("post", `/grupos/${grupo.id}/inscripcion`)).body.codigo).toBe("YA_INSCRITO");
    const lleno = await est("post", `/grupos/${grupo.id}/inscripcion`, andres.token);
    expect(lleno.status).toBe(409);
    expect(lleno.body.codigo).toBe("SIN_CUPO");
    expect((await est("delete", `/grupos/${grupo.id}/inscripcion`)).status).toBe(200);
    expect((await est("post", `/grupos/${grupo.id}/inscripcion`, andres.token)).status).toBe(201);
  });

  it("no deja inscribir grupos con horarios cruzados ni más del máximo por periodo", async () => {
    const g1 = await crearGrupo({ horario: [{ dia: 2, inicio: "08:00", fin: "10:00" }] });
    const g2 = await crearGrupo({ disciplinaId: ajedrez.id, nombre: "Ajedrez · A", horario: [{ dia: 2, inicio: "09:00", fin: "11:00" }] });
    const g3 = await crearGrupo({ disciplinaId: ajedrez.id, nombre: "Ajedrez · B", horario: [{ dia: 3, inicio: "09:00", fin: "11:00" }] });
    const g4 = await crearGrupo({ nombre: "Natación · Grupo 2", horario: [{ dia: 4, inicio: "09:00", fin: "11:00" }] });
    await est("post", `/grupos/${g1.id}/inscripcion`);
    const cruce = await est("post", `/grupos/${g2.id}/inscripcion`);
    expect(cruce.status).toBe(409);
    expect(cruce.body.codigo).toBe("CRUCE_HORARIO");
    const oferta = (await est("get", "/oferta")).body;
    expect(oferta.disciplinas.find((d) => d.nombre === "Ajedrez").grupos.find((g) => g.id === g2.id).cruceCon).toBe("Natación · Grupo 1");
    expect((await est("post", `/grupos/${g3.id}/inscripcion`)).status).toBe(201);
    const maximo = await est("post", `/grupos/${g4.id}/inscripcion`);
    expect(maximo.body.codigo).toBe("MAXIMO_GRUPOS");
  });

  it("respeta las inscripciones cerradas, pero el personal puede inscribir por correo", async () => {
    const grupo = await crearGrupo();
    await adm("patch", `/grupos/${grupo.id}`).send({ inscripcionesAbiertas: false });
    expect((await est("post", `/grupos/${grupo.id}/inscripcion`)).body.codigo).toBe("INSCRIPCIONES_CERRADAS");
    const porCorreo = await adm("post", `/grupos/${grupo.id}/inscritos`).send({ email: "LAURA.MUNOZ@uniautonoma.edu.co" });
    expect(porCorreo.status).toBe(201);
    expect(porCorreo.body.grupo.inscritos.map((i) => i.nombre)).toEqual(["Laura Muñoz"]);
    const noExiste = await adm("post", `/grupos/${grupo.id}/inscritos`).send({ email: "nadie@uniautonoma.edu.co" });
    expect(noExiste.body.codigo).toBe("USUARIO_NO_ENCONTRADO");
    expect((await adm("patch", `/grupos/${grupo.id}`).send({ cupo: 0 })).status).toBe(400);
  });
});

describe("Asistencia y horas", () => {
  async function grupoConInscritos() {
    const grupo = await crearGrupo();
    await est("post", `/grupos/${grupo.id}/inscripcion`);
    await est("post", `/grupos/${grupo.id}/inscripcion`, andres.token);
    return grupo;
  }

  it("registra la sesión, suma horas solo a los presentes y permite corregirla", async () => {
    const grupo = await grupoConInscritos();
    const detalle = (await adm("get", `/grupos/${grupo.id}`)).body.grupo;
    expect(detalle.sugerenciaSesion).toMatchObject({ fecha: hoy(), inicio: "06:00", fin: "08:00", hoyTieneClase: true });

    const res = await adm("post", `/grupos/${grupo.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", tema: "Estilo libre", presentes: [laura.usuario.id] });
    expect(res.status).toBe(201);
    expect(res.body.grupo.sesiones[0]).toMatchObject({ horas: 2, presentes: [laura.usuario.id], registrados: 2 });
    expect((await adm("post", `/grupos/${grupo.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", presentes: [] })).body.codigo).toBe("SESION_REPETIDA");

    let mias = (await est("get", "/mis-horas")).body;
    expect(mias).toMatchObject({ requeridas: 40, total: 2, faltan: 38, cumplido: false, horasPeriodo: 2 });
    expect(mias.porDisciplina).toEqual([{ nombre: "Natación", horas: 2 }]);
    expect(mias.grupos[0].nombre).toBe("Natación · Grupo 1");
    expect((await est("get", "/mis-horas", andres.token)).body.total).toBe(0);

    const sesionId = res.body.grupo.sesiones[0].id;
    const corregida = await adm("put", `/sesiones/${sesionId}`).send({ presentes: [laura.usuario.id, andres.usuario.id], fin: "07:30" });
    expect(corregida.body.grupo.sesiones[0].horas).toBe(1.5);
    expect((await est("get", "/mis-horas", andres.token)).body.total).toBe(1.5);
    expect((await adm("delete", `/sesiones/${sesionId}`)).status).toBe(200);
    expect((await est("get", "/mis-horas")).body.total).toBe(0);
  });

  it("no acepta sesiones futuras ni estudiantes que no están inscritos", async () => {
    const grupo = await grupoConInscritos();
    const futuro = new Date(hoyBogota().getTime() + 2 * 864e5).toISOString().slice(0, 10);
    expect((await adm("post", `/grupos/${grupo.id}/sesiones`).send({ fecha: futuro, inicio: "06:00", fin: "08:00", presentes: [] })).status).toBe(400);
    const otro = crearUsuario("Estudiante", "otro@uniautonoma.edu.co");
    const ajeno = await adm("post", `/grupos/${grupo.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", presentes: [otro.usuario.id] });
    expect(ajeno.status).toBe(400);
    expect((await adm("get", `/grupos/${grupo.id}`)).body.grupo.sesiones).toHaveLength(0);
  });

  it("reconoce horas por torneos, cumple el requisito y expide la constancia", async () => {
    await adm("put", "/config").send({ horasRequeridas: 10 });
    const sinMotivo = await adm("post", `/estudiantes/${laura.usuario.id}/horas`).send({ horas: 4 });
    expect(sinMotivo.status).toBe(400);
    await adm("post", `/estudiantes/${laura.usuario.id}/horas`).send({ horas: 6, motivo: "Torneo regional de natación", disciplinaId: natacion.id });
    const detalle = await adm("post", `/estudiantes/${laura.usuario.id}/horas`).send({ horas: 4, motivo: "Juegos interuniversitarios" });
    expect(detalle.body).toMatchObject({ total: 10, requeridas: 10, cumplido: true, porcentaje: 100 });
    expect(detalle.body.historial[0].tipo).toBe("reconocida");

    const lista = await adm("get", "/estudiantes?estado=cumplieron");
    expect(lista.body.estudiantes.map((e) => e.email)).toEqual(["laura.munoz@uniautonoma.edu.co"]);
    const busqueda = await adm("get", "/estudiantes?q=andr");
    expect(busqueda.body.estudiantes.map((e) => e.nombre)).toEqual(["Andrés Gómez"]);

    const pdf = await est("get", "/mis-horas/constancia").buffer(true).parse(binario);
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 5).toString()).toBe("%PDF-");
    const pdfAdmin = await adm("get", `/estudiantes/${laura.usuario.id}/constancia`).buffer(true).parse(binario);
    expect(pdfAdmin.status).toBe(200);

    const idHoras = detalle.body.historial.find((h) => h.detalle === "Juegos interuniversitarios").id;
    expect((await adm("delete", `/horas/${idHoras}`)).body.total).toBe(6);
  });

  it("resume el periodo y exporta el reporte en Excel", async () => {
    const grupo = await grupoConInscritos();
    await adm("post", `/grupos/${grupo.id}/sesiones`).send({ fecha: hoy(), inicio: "06:00", fin: "08:00", presentes: [laura.usuario.id] });
    const resumen = (await adm("get", "/resumen")).body;
    expect(resumen).toMatchObject({ gruposActivos: 1, inscritos: 2, sesiones: 1, horasOtorgadas: 2, asistenciaPromedio: 50 });
    expect(resumen.clasesHoy[0]).toMatchObject({ nombre: "Natación · Grupo 1", asistenciaTomada: true });
    expect(resumen.porDisciplina).toEqual([{ nombre: "Natación", total: 2 }]);

    const xlsx = await adm("get", "/reporte").buffer(true).parse(binario);
    expect(xlsx.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(xlsx.body);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["ESTUDIANTES", "GRUPOS", "ASISTENCIA"]);
    expect(libro.getWorksheet("ASISTENCIA").rowCount).toBe(3);
  });

  it("administra disciplinas y la configuración", async () => {
    expect((await adm("post", "/disciplinas").send({ nombre: "natación" })).status).toBe(409);
    const nueva = await adm("post", "/disciplinas").send({ nombre: "Voleibol", tipo: "Colectivo" });
    expect(nueva.status).toBe(201);
    expect((await adm("patch", `/disciplinas/${nueva.body.disciplina.id}`).send({ activa: false })).body.disciplina.activa).toBe(false);
    expect((await adm("put", "/config").send({ horasRequeridas: 0 })).status).toBe(400);
    const cat = (await adm("get", "/catalogos")).body;
    expect(cat.config.horasRequeridas).toBe(40);
    expect(cat.disciplinas).toHaveLength(3);
  });
});
