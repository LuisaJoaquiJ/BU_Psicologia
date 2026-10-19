// Tablero de Deporte: indicadores del periodo con su comparacion y los datos
// de las graficas (asistencia, horas por origen, avance, disciplinas...).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

const dia = (n) => new Date(hoyBogota().getTime() - n * 864e5);

let coord;
beforeEach(() => {
  prisma.__reset();
  coord = crearUsuario("Administrador", "deportes@uniautonoma.edu.co", "Coordinación");
  prisma.__darAcceso("deportes@uniautonoma.edu.co", "deporte");
});

const tablero = (periodo, token = coord.token) => request(app).get(`/api/v1/deporte/admin/tablero${periodo ? `?periodo=${periodo}` : ""}`).set(auth(token));

describe("Tablero de Deporte", () => {
  test("solo lo ve el personal de Deporte", async () => {
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    expect((await tablero("mes", est.token)).status).toBe(403);
    const vacio = await tablero();
    expect(vacio.status).toBe(200);
    expect(vacio.body.periodo).toBe("mes");
    expect(vacio.body.serie).toHaveLength(30);
    expect(vacio.body.kpis.find((k) => k.id === "asistencia").valor).toBeNull();
    expect(vacio.body.avance.total).toBe(0);
  });

  test("calcula asistencia, horas, avance y ocupacion", async () => {
    const a = crearUsuario("Estudiante", "a@uniautonoma.edu.co", "Ana Pérez");
    const b = crearUsuario("Estudiante", "b@uniautonoma.edu.co", "Beto Ruiz");
    const nat = await prisma.disciplinaDeportiva.create({ data: { nombre: "Natación", tipo: "Individual" } });
    const { periodoActual } = require("../src/modules/deporte/utils");
    const g = await prisma.grupoDeporte.create({ data: { disciplinaId: nat.id, periodo: periodoActual(), nombre: "Natación · Grupo 1", cupo: 10, horario: [], activo: true } });
    for (const x of [a, b]) await prisma.inscripcionDeporte.create({ data: { grupoId: g.id, usuarioId: x.usuario.id, estado: "Activa" } });
    // Dos clases en el periodo: Ana va a las dos, Beto a una.
    for (const [n, presentes] of [[2, [a, b]], [5, [a]]]) {
      const s = await prisma.sesionDeporte.create({ data: { grupoId: g.id, fecha: dia(n), inicio: "06:00", fin: "08:00", horas: 2 } });
      for (const x of [a, b]) await prisma.asistenciaDeporte.create({ data: { sesionId: s.id, usuarioId: x.usuario.id, presente: presentes.includes(x) } });
    }
    // Una clase en el periodo anterior (todos presentes) y 40 h reconocidas a Ana.
    const vieja = await prisma.sesionDeporte.create({ data: { grupoId: g.id, fecha: dia(40), inicio: "06:00", fin: "08:00", horas: 2 } });
    await prisma.asistenciaDeporte.create({ data: { sesionId: vieja.id, usuarioId: b.usuario.id, presente: true } });
    await prisma.horaDeporteManual.create({ data: { usuarioId: a.usuario.id, fecha: dia(1), horas: 40, motivo: "Selección Cauca" } });

    const r = (await tablero("mes")).body;
    const kpi = (id) => r.kpis.find((k) => k.id === id);
    expect(kpi("asistencia").valor).toBe(75);
    expect(kpi("asistencia").puntos).toBe(-25);
    expect(kpi("sesiones").valor).toBe(2);
    expect(kpi("sesiones").variacion).toBe(100);
    expect(kpi("horas").valor).toBe(46);
    expect(kpi("activos").valor).toBe(2);
    expect(r.origen).toEqual({ Clases: 6, Eventos: 0, Reconocidas: 40 });
    expect(r.avance).toMatchObject({ Completaron: 1, Iniciando: 1, total: 2 });
    expect(r.ocupacion[0]).toMatchObject({ nombre: "Natación", inscritos: 2, cupo: 10 });
    expect(r.asistenciaGrupos[0]).toMatchObject({ nombre: "Natación · Grupo 1", asistencia: 75, sesiones: 2 });
    expect(r.serie.reduce((s, x) => s + x.Presentes, 0)).toBe(3);
    expect(r.actividad.length).toBeGreaterThan(0);
  });
});
