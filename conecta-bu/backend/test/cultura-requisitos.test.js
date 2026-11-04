// Requisitos del area de Arte y Cultura (reunion del 30 de octubre de 2026):
// SNIES por personas sin repetir, registro calificado con eventos y redes,
// inscritos por tipo de persona y agenda publica del portal.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
const { hoyBogota } = require("../src/common/utils/fechas");
const { periodoActual } = require("../src/modules/cultura/periodo");

configurarEntorno();

const dia = (n) => {
  const b = hoyBogota();
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + n)).toISOString().slice(0, 10);
};

describe("Requisitos de Arte y Cultura", () => {
  let ana;
  let eva;
  let personal;

  beforeEach(async () => {
    prisma.__reset();
    ana = crearUsuario("Estudiante", "ana.req@uniautonoma.edu.co", "Ana Req");
    eva = crearUsuario("Estudiante", "eva.req@uniautonoma.edu.co", "Eva Req");
    personal = crearUsuario("Administrador", "cultura.req@uniautonoma.edu.co", "Personal Req");
    prisma.__darAcceso("cultura.req@uniautonoma.edu.co", "cultura");
    await prisma.perfilCultural.create({ data: { usuarioId: ana.usuario.id, tipoSnies: 1, programa: "Derecho", caracterizacion: "No registra" } });
    await prisma.perfilCultural.create({ data: { usuarioId: eva.usuario.id, tipoSnies: 4, programa: "Ingeniería", caracterizacion: "No registra" } });
  });

  const api = (token) => ({
    get: (ruta) => request(app).get(ruta).set(auth(token)),
    post: (ruta, cuerpo) => request(app).post(ruta).set(auth(token)).send(cuerpo),
    put: (ruta, cuerpo) => request(app).put(ruta).set(auth(token)).send(cuerpo),
  });

  async function grupoConSnies() {
    const area = await prisma.areaCultural.create({ data: { nombre: `Guitarra ${Math.random()}` } });
    const r = await api(personal.token).post("/api/v1/cultura/admin/grupos", {
      areaId: area.id,
      periodo: periodoActual(),
      nombre: "Taller de guitarra",
      cupo: 20,
      horario: [{ dia: 1, inicio: "07:00", fin: "08:00" }],
      codigoSnies: "CUL-77",
      documentoResponsable: "1061000",
    });
    expect(r.status).toBe(201);
    return r.body;
  }

  async function hoja(desde, hasta, nombre) {
    const r = await api(personal.token).get(`/api/v1/cultura/admin/informe?desde=${desde}&hasta=${hasta}`).buffer(true).parse((res, cb) => {
      const partes = [];
      res.on("data", (p) => partes.push(p));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(r.body);
    const filas = [];
    libro.getWorksheet(nombre).eachRow((f, n) => n > 1 && filas.push(f.values.slice(1)));
    return filas;
  }

  test("el SNIES cuenta personas sin repetir, con el codigo de la actividad y la cedula", async () => {
    const g = await grupoConSnies();
    await api(ana.token).post(`/api/v1/cultura/grupos/${g.id}/inscripcion`);
    await api(eva.token).post(`/api/v1/cultura/grupos/${g.id}/inscripcion`);
    // Ana va a dos sesiones; Eva a una.
    await api(personal.token).post(`/api/v1/cultura/admin/grupos/${g.id}/asistencia`, { fecha: dia(0), presentes: [ana.usuario.id, eva.usuario.id] });
    await api(personal.token).post(`/api/v1/cultura/admin/grupos/${g.id}/asistencia`, { fecha: dia(-1), presentes: [ana.usuario.id] });
    await api(personal.token).put(`/api/v1/cultura/admin/grupos/${g.id}/conteos`, { fecha: dia(0), conteoEstudiantes: 5 });

    const filas = await hoja(dia(-7), dia(1), "SNIES");
    expect(filas).toContainEqual(["1061000", "CUL-77", "Taller de guitarra", expect.any(String), 1, "Estudiante", 6]);
    expect(filas).toContainEqual(["1061000", "CUL-77", "Taller de guitarra", expect.any(String), 4, "Egresado", 1]);
  });

  test("el personal ve de una vez cuantos inscritos son estudiantes y cuantos egresados", async () => {
    const g = await grupoConSnies();
    await api(ana.token).post(`/api/v1/cultura/grupos/${g.id}/inscripcion`);
    await api(eva.token).post(`/api/v1/cultura/grupos/${g.id}/inscripcion`);
    const lista = await api(personal.token).get("/api/v1/cultura/admin/grupos");
    expect(lista.body.find((x) => x.id === g.id).porTipo).toEqual({ Estudiante: 1, Egresado: 1 });
  });

  test("el registro calificado por programa incluye eventos y delegaciones, sin importar tildes", async () => {
    const ev = await api(personal.token).post("/api/v1/cultura/admin/agenda", { nombre: "Halloween", fecha: dia(0), fechaLimite: dia(0), horaInicio: "06:00", horaFin: "23:00", cupo: 10, estado: "Publicado" });
    expect(ev.status).toBe(201);
    const abierto = await api(personal.token).post(`/api/v1/cultura/admin/agenda/${ev.body.id}/asistencia/abrir`);
    expect((await api(eva.token).post("/api/v1/cultura/asistencia", { codigo: abierto.body.codigo })).status).toBe(201);
    await api(personal.token).post("/api/v1/cultura/admin/representaciones", { red: "ASIES", nombre: "Global Fest", fecha: dia(0), participantes: [ana.usuario.id] });

    const ingenieria = await api(personal.token).get(`/api/v1/cultura/admin/registro-calificado?programa=ingenieria&desde=${dia(-1)}&hasta=${dia(1)}`);
    expect(ingenieria.body.map((p) => p.email)).toEqual(["eva.req@uniautonoma.edu.co"]);
    const derecho = await api(personal.token).get(`/api/v1/cultura/admin/registro-calificado?programa=Derecho&desde=${dia(-1)}&hasta=${dia(1)}`);
    expect(derecho.body.map((p) => p.email)).toEqual(["ana.req@uniautonoma.edu.co"]);
    const programas = await api(personal.token).get("/api/v1/cultura/admin/programas");
    expect(programas.body).toEqual(["Derecho", "Ingeniería"]);
  });

  test("un evento de otro ano se carga con sus conteos y entra al SNIES", async () => {
    const r = await api(personal.token).post("/api/v1/cultura/admin/agenda", {
      nombre: "Semana universitaria 2024",
      fecha: "2024-09-10",
      fechaLimite: "2024-09-10",
      horaInicio: "08:00",
      horaFin: "17:00",
      cupo: 1,
      estado: "Publicado",
      codigoSnies: "SU-24",
      conteoEstudiantes: 120,
      conteoDocentes: 8,
    });
    expect(r.status).toBe(201);
    const filas = await hoja("2024-01-01", "2024-12-31", "SNIES");
    expect(filas).toContainEqual(["", "SU-24", "Semana universitaria 2024", expect.any(String), 1, "Estudiante", 120]);
    expect(filas).toContainEqual(["", "SU-24", "Semana universitaria 2024", expect.any(String), 2, "Docente", 8]);
  });

  test("el portal ve la agenda publicada sin iniciar sesion", async () => {
    await api(personal.token).post("/api/v1/cultura/admin/agenda", { nombre: "Popayán Ciudad Libro", fecha: dia(5), fechaLimite: dia(5), horaInicio: "08:00", horaFin: "12:00", cupo: 30, estado: "Publicado" });
    await api(personal.token).post("/api/v1/cultura/admin/agenda", { nombre: "Borrador interno", fecha: dia(5), fechaLimite: dia(5), horaInicio: "08:00", horaFin: "12:00", cupo: 30, estado: "Borrador" });
    const r = await request(app).get("/api/v1/cultura/publico/agenda");
    expect(r.status).toBe(200);
    expect(r.body.map((e) => e.nombre)).toEqual(["Popayán Ciudad Libro"]);
    expect(r.body[0].cuposDisponibles).toBe(30);
  });
});
