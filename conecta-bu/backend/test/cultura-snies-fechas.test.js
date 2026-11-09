// Grupos con horario distinto por dia y fechas opcionales del taller, y la
// casilla "No se reporta al SNIES" para actividades internas.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const ExcelJS = require("exceljs");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ JWT_EXPIRES_IN: "30d" });
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

afterEach(() => jest.restoreAllMocks());

const dia = (n) => new Date(hoyBogota().getTime() + n * 864e5).toISOString().slice(0, 10);

describe("Horario por día, fechas del taller y SNIES", () => {
  let personal;
  let ana;
  let areaId;

  beforeEach(async () => {
    prisma.__reset();
    personal = crearUsuario("Administrador", "cultura.snies@uniautonoma.edu.co", "Coordinación");
    ana = crearUsuario("Estudiante", "ana.snies@uniautonoma.edu.co", "Ana Snies");
    prisma.__darAcceso("cultura.snies@uniautonoma.edu.co", "cultura");
    areaId = (await prisma.areaCultural.create({ data: { nombre: "Danza" } })).id;
  });

  const adm = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(personal.token));
  const crearGrupo = (extra = {}) =>
    adm("post", "/grupos").send({ areaId, nombre: "Danzas folclóricas", cupo: 20, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }], ...extra });

  test("la lista de áreas solo trae las activas", async () => {
    await prisma.areaCultural.create({ data: { nombre: "Teatro (catálogo viejo)", activa: false } });
    const r = await adm("get", "/areas");
    expect(r.body.map((x) => x.nombre)).toEqual(["Danza"]);
  });

  test("cada día guarda su propia hora", async () => {
    const r = await crearGrupo({
      horario: [
        { dia: 2, inicio: "14:00", fin: "16:00" },
        { dia: 4, inicio: "17:00", fin: "19:00" },
        { dia: 5, inicio: "08:00", fin: "10:00" },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.horario).toEqual([
      { dia: 2, inicio: "14:00", fin: "16:00" },
      { dia: 4, inicio: "17:00", fin: "19:00" },
      { dia: 5, inicio: "08:00", fin: "10:00" },
    ]);
  });

  test("las fechas del taller son opcionales y el fin no puede ser antes del inicio", async () => {
    expect((await crearGrupo()).body).toMatchObject({ fechaInicio: null, fechaFin: null });
    const mal = await crearGrupo({ nombre: "Otro", fechaInicio: dia(10), fechaFin: dia(5) });
    expect(mal.status).toBe(400);
    expect(mal.body.message).toBe("La fecha de fin del taller no puede ser anterior a la de inicio.");
  });

  test("avisa si entre las fechas no cae ningún día del horario", async () => {
    // Un solo dia (un viernes) con horario de martes: el taller nunca tendria sesion.
    const viernes = new Date(Date.UTC(2026, 10, 6)).toISOString().slice(0, 10);
    const r = await crearGrupo({ fechaInicio: viernes, fechaFin: viernes, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }] });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe("Entre esas fechas no cae ningún día del horario. Revisa las fechas o los días.");
    expect((await crearGrupo({ fechaInicio: viernes, fechaFin: viernes, horario: [{ dia: 5, inicio: "08:00", fin: "10:00" }] })).status).toBe(201);
  });

  test("a un taller que ya terminó no se inscribe nadie y su código no se abre", async () => {
    const g = (await crearGrupo({ fechaInicio: dia(-30), fechaFin: dia(-1) })).body;
    const insc = await request(app).post(`/api/v1/cultura/grupos/${g.id}/inscripcion`).set(auth(ana.token)).send({});
    expect(insc.status).toBe(400);
    expect(insc.body.message).toBe("Este taller ya terminó.");
    const oferta = await request(app).get("/api/v1/cultura/grupos").set(auth(ana.token));
    expect(oferta.body.areas[0].grupos[0]).toMatchObject({ fechaFin: dia(-1), inscripcionesAbiertas: false });
    const abrir = await adm("post", `/grupos/${g.id}/asistencia/abrir`);
    expect(abrir.status).toBe(409);
    expect(abrir.body.message).toBe(`Danzas folclóricas terminó el ${dia(-1)}.`);
  });

  test("antes de la fecha de inicio el código no se abre", async () => {
    const g = (await crearGrupo({ fechaInicio: dia(7) })).body;
    const abrir = await adm("post", `/grupos/${g.id}/asistencia/abrir`);
    expect(abrir.body.message).toBe(`Danzas folclóricas empieza el ${dia(7)}.`);
  });

  test("lo que no se reporta al SNIES sale en la asistencia pero no en la hoja SNIES", async () => {
    const evento = (fecha, extra) => adm("post", "/agenda").send({ fecha, fechaLimite: fecha, horaInicio: "08:00", horaFin: "10:00", cupo: 100, estado: "Publicado", ...extra });
    const interno = await evento(dia(-3), { nombre: "Open House", categoria: "promocion", reportaSnies: false, conteoEstudiantes: 40 });
    const reportado = await evento(dia(-3), { nombre: "Halloween", categoria: "especial", codigoSnies: "HAL-26", conteoEstudiantes: 25 });
    expect(interno.body.reportaSnies).toBe(false);
    expect(reportado.body.reportaSnies).toBe(true);
    for (const id of [interno.body.id, reportado.body.id]) {
      await prisma.inscripcionEventoCultural.create({ data: { eventoId: id, usuarioId: ana.usuario.id, estado: "Activa", asistio: true, fechaAsistencia: new Date(`${dia(-3)}T14:00:00Z`), tipoSnies: 1 } });
    }

    const r = await adm("get", `/informe?desde=${dia(-5)}&hasta=${dia(0)}`).buffer(true).parse((res, cb) => {
      const partes = [];
      res.on("data", (p) => partes.push(p));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(r.body);
    const hoja = (nombre) => {
      const filas = [];
      libro.getWorksheet(nombre).eachRow((fila) => filas.push(fila.values.slice(1)));
      return filas;
    };
    const actividadesSnies = hoja("SNIES").map((f) => f[2]);
    expect(actividadesSnies).toContain("Halloween");
    expect(actividadesSnies).not.toContain("Open House");
    expect(hoja("ASISTENCIA").map((f) => f[0])).toEqual(expect.arrayContaining(["Halloween", "Open House"]));
  });
});
