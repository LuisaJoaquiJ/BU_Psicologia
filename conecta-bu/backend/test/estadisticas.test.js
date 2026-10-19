// Pruebas del Sprint 5 · RF-015: panel de estadisticas de participacion y
// asistencia (citas y eventos).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

beforeEach(() => {
  prisma.__reset();
});

async function sembrarCita(usuarioId, estado, fecha = diasDesdeHoy(1)) {
  const horario = prisma.__seedHorario({ fecha, ocupado: true });
  return prisma.citaDesarrollo.create({ data: { usuarioId, horarioId: horario.id, estado } });
}

describe("RF-015: dashboard administrativo", () => {
  test("solo el administrador accede (403 para estudiantes)", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/admin/estadisticas").set(auth(token));
    expect(res.status).toBe(403);
  });

  test("sin datos indica que no hay informacion disponible", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/admin/estadisticas").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.hayDatos).toBe(false);
    expect(res.body.citas.tasaAsistencia).toBeNull();
    expect(res.body.eventosDetalle).toEqual([]);
  });

  test("calcula indicadores de citas y de eventos", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co");
    const b = crearUsuario("Estudiante", "b@uniautonoma.edu.co");
    const c = crearUsuario("Estudiante", "c@uniautonoma.edu.co");

    await sembrarCita(a.usuario.id, "Atendida");
    await sembrarCita(b.usuario.id, "Atendida");
    await sembrarCita(c.usuario.id, "NoAsistio");
    await sembrarCita(a.usuario.id, "Cancelada");
    await sembrarCita(b.usuario.id, "Agendada");

    const evento = prisma.__seedEvento({ cupos: 10, fecha: diasDesdeHoy(2), fechaLimiteInscripcion: diasDesdeHoy(1) });
    prisma.__seedEvento({ estado: "Borrador", fecha: diasDesdeHoy(3), fechaLimiteInscripcion: diasDesdeHoy(2) });
    const insA = await prisma.inscripcion.create({ data: { usuarioId: a.usuario.id, eventoId: evento.id } });
    const insB = await prisma.inscripcion.create({ data: { usuarioId: b.usuario.id, eventoId: evento.id } });
    await prisma.inscripcion.create({ data: { usuarioId: c.usuario.id, eventoId: evento.id } });
    await prisma.inscripcion.create({
      data: { usuarioId: "u-otro", eventoId: evento.id, estado: "Cancelada" },
    });
    await prisma.asistenciaEvento.upsert({
      where: { inscripcionId: insA.id },
      create: { inscripcionId: insA.id, asistio: true, registradoPorId: "x" },
      update: {},
    });
    await prisma.asistenciaEvento.upsert({
      where: { inscripcionId: insB.id },
      create: { inscripcionId: insB.id, asistio: false, registradoPorId: "x" },
      update: {},
    });

    const res = await request(app).get("/api/v1/admin/estadisticas").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.hayDatos).toBe(true);
    expect(res.body.estudiantesRegistrados).toBe(3);
    expect(res.body.citas).toEqual({
      total: 5,
      agendadas: 1,
      atendidas: 2,
      noAsistieron: 1,
      canceladas: 1,
      tasaAsistencia: 66.7,
    });
    expect(res.body.citasPorServicio[0]).toMatchObject({ servicio: "Orientación psicológica individual", total: 5 });
    // El borrador no cuenta; la inscripcion cancelada tampoco.
    expect(res.body.eventos).toEqual({
      eventos: 1,
      inscritos: 3,
      asistieron: 1,
      noAsistieron: 1,
      sinRegistrar: 1,
      tasaAsistencia: 50,
    });
    expect(res.body.eventosDetalle[0]).toMatchObject({ id: evento.id, inscritos: 3, ocupacion: 30 });
  });

  test("filtra por rango de fechas y valida el rango", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co");
    await sembrarCita(a.usuario.id, "Atendida", diasDesdeHoy(1));
    await sembrarCita(a.usuario.id, "Atendida", diasDesdeHoy(30));

    const iso = (d) => diasDesdeHoy(d).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/admin/estadisticas?desde=${iso(0)}&hasta=${iso(7)}`)
      .set(auth(token));
    expect(res.body.citas.total).toBe(1);

    const invalido = await request(app)
      .get(`/api/v1/admin/estadisticas?desde=${iso(7)}&hasta=${iso(0)}`)
      .set(auth(token));
    expect(invalido.status).toBe(400);
  });
});

describe("Tablero de Desarrollo Humano (lectura rapida)", () => {
  test("compara el periodo con el anterior de la misma duracion", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    await sembrarCita(est.usuario.id, "Atendida", diasDesdeHoy(0));
    await sembrarCita(est.usuario.id, "NoAsistio", diasDesdeHoy(-1));
    await sembrarCita(est.usuario.id, "Atendida", diasDesdeHoy(-10));

    const res = await request(app).get("/api/v1/admin/estadisticas/tablero?periodo=semana").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.serie).toHaveLength(7);
    const citas = res.body.kpis.find((k) => k.id === "citas");
    expect(citas).toMatchObject({ valor: 2, anterior: 1, variacion: 100 });
    const asistencia = res.body.kpis.find((k) => k.id === "asistencia");
    expect(asistencia).toMatchObject({ valor: 50, anterior: 100, puntos: -50 });
    expect(res.body.estados).toMatchObject({ Atendida: 1, NoAsistio: 1, total: 2 });
    expect(res.body.actividad.length).toBeGreaterThan(0);
  });

  test("un estudiante no lo puede ver", async () => {
    const { token } = crearUsuario("Estudiante", "e2@uniautonoma.edu.co");
    expect((await request(app).get("/api/v1/admin/estadisticas/tablero").set(auth(token))).status).toBe(403);
  });
});
