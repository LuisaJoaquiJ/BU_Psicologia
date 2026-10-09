// Pruebas del Sprint 2 (HU-06 a HU-12): consulta de servicios, consulta de
// horarios, agendamiento de citas (con sus reglas de negocio) y consulta /
// cancelacion de citas propias.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));

process.env.PORT = "4000";
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
process.env.JWT_SECRET = "secreto-de-pruebas";
process.env.GOOGLE_CLIENT_ID = "client-id-de-pruebas";
process.env.ALLOWED_GOOGLE_DOMAIN = "uniautonoma.edu.co";
process.env.FRONTEND_URL = "http://localhost:5173";

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { signToken } = require("../src/common/utils/jwt");

function crearEstudiante(email = "estudiante@uniautonoma.edu.co") {
  const usuario = prisma.__seedUsuario({
    emailInstitucional: email,
    nombre: "Estudiante de Prueba",
    rolId: "rol-estudiante",
  });
  const token = signToken({ sub: usuario.id, rol: "Estudiante" });
  return { usuario, token };
}

function manana() {
  const fecha = new Date();
  fecha.setUTCHours(0, 0, 0, 0);
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha;
}

beforeEach(() => {
  prisma.__reset();
});

describe("RF-003 / HU-06: consulta de servicios", () => {
  test("sin token, responde 401", async () => {
    const res = await request(app).get("/api/v1/servicios");
    expect(res.status).toBe(401);
  });

  test("con token, devuelve los servicios activos", async () => {
    const { token } = crearEstudiante();
    const res = await request(app).get("/api/v1/servicios").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.servicios.length).toBeGreaterThan(0);
    expect(res.body.servicios[0]).toMatchObject({ nombre: expect.any(String) });
  });
});

describe("RF-004 / HU-07: consulta de horarios disponibles", () => {
  test("solo devuelve horarios libres y desde hoy en adelante", async () => {
    const { token } = crearEstudiante();
    prisma.__seedHorario({ fecha: manana(), ocupado: false });
    prisma.__seedHorario({ fecha: manana(), ocupado: true });

    const res = await request(app)
      .get("/api/v1/citas/horarios-disponibles")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.horarios).toHaveLength(1);
    expect(res.body.horarios[0].ocupado).toBe(false);
    expect(res.body.horarios[0].servicio).toBeTruthy();
  });

  test("sin horarios disponibles, devuelve una lista vacia", async () => {
    const { token } = crearEstudiante();
    const res = await request(app)
      .get("/api/v1/citas/horarios-disponibles")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.horarios).toEqual([]);
  });
});

describe("RF-005 / HU-08, HU-09, HU-10: agendamiento de citas", () => {
  test("agenda la cita y deja el horario ocupado", async () => {
    const { token } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });

    const res = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario.id });

    expect(res.status).toBe(201);
    expect(res.body.cita).toMatchObject({ estado: "Agendada", horarioId: horario.id });

    const horarios = await request(app)
      .get("/api/v1/citas/horarios-disponibles")
      .set("Authorization", `Bearer ${token}`);
    expect(horarios.body.horarios).toHaveLength(0);
  });

  test("HU-09: si el horario ya esta ocupado, responde 409 y no crea la cita", async () => {
    const { token } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana(), ocupado: true });

    const res = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario.id });

    expect(res.status).toBe(409);
  });

  test("HU-10: si el estudiante ya tiene una cita activa, responde 409", async () => {
    const { token } = crearEstudiante();
    const horario1 = prisma.__seedHorario({ fecha: manana() });
    const horario2 = prisma.__seedHorario({ fecha: manana() });

    const primera = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario1.id });
    expect(primera.status).toBe(201);

    const segunda = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario2.id });
    expect(segunda.status).toBe(409);
  });

  test("sin horarioId en el body, responde 400", async () => {
    const { token } = crearEstudiante();
    const res = await request(app).post("/api/v1/citas").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });
});

describe("RF-006 / HU-11 y HU-12: mis citas y cancelacion", () => {
  test("HU-11: solo devuelve las citas del usuario autenticado", async () => {
    const { token, usuario } = crearEstudiante("estudiante1@uniautonoma.edu.co");
    const { usuario: otro } = crearEstudiante("estudiante2@uniautonoma.edu.co");
    const horarioPropio = prisma.__seedHorario({ fecha: manana() });
    const horarioAjeno = prisma.__seedHorario({ fecha: manana() });

    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horarioPropio.id });

    const tokenOtro = signToken({ sub: otro.id, rol: "Estudiante" });
    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenOtro}`)
      .send({ horarioId: horarioAjeno.id });

    const res = await request(app).get("/api/v1/citas/mias").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.citas).toHaveLength(1);
    expect(res.body.citas[0].usuarioId).toBe(usuario.id);
  });

  test("HU-12: cancela una cita propia y libera el horario", async () => {
    const { token } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    const agendada = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario.id });

    const res = await request(app)
      .patch(`/api/v1/citas/${agendada.body.cita.id}/cancelar`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cita.estado).toBe("Cancelada");

    const horarios = await request(app)
      .get("/api/v1/citas/horarios-disponibles")
      .set("Authorization", `Bearer ${token}`);
    expect(horarios.body.horarios).toHaveLength(1);
  });

  test("no permite cancelar la cita de otro estudiante (404)", async () => {
    const { token: tokenDueno } = crearEstudiante("dueno@uniautonoma.edu.co");
    const { token: tokenIntruso } = crearEstudiante("intruso@uniautonoma.edu.co");
    const horario = prisma.__seedHorario({ fecha: manana() });

    const agendada = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenDueno}`)
      .send({ horarioId: horario.id });

    const res = await request(app)
      .patch(`/api/v1/citas/${agendada.body.cita.id}/cancelar`)
      .set("Authorization", `Bearer ${tokenIntruso}`);

    expect(res.status).toBe(404);
  });

  test("no permite cancelar dos veces la misma cita (409)", async () => {
    const { token } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    const agendada = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${token}`)
      .send({ horarioId: horario.id });

    await request(app)
      .patch(`/api/v1/citas/${agendada.body.cita.id}/cancelar`)
      .set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/v1/citas/${agendada.body.cita.id}/cancelar`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});
