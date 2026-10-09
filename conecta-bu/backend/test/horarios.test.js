// Pruebas del Sprint 3 (HU-13 a HU-16): creacion, modificacion y
// deshabilitacion de horarios, agenda administrativa y registro de
// asistencia. Todas estas rutas son exclusivas del rol Administrador.

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

function crearAdmin(email = "admin@uniautonoma.edu.co") {
  const usuario = prisma.__seedUsuario({
    emailInstitucional: email,
    nombre: "Admin de Prueba",
    rolId: "rol-administrador",
  });
  const token = signToken({ sub: usuario.id, rol: "Administrador" });
  return { usuario, token };
}

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

function mananaStr() {
  return manana().toISOString().slice(0, 10);
}

beforeEach(() => {
  prisma.__reset();
});

describe("RF-007 / HU-13: creacion de horarios", () => {
  test("sin token, responde 401", async () => {
    const res = await request(app).post("/api/v1/admin/horarios").send({});
    expect(res.status).toBe(401);
  });

  test("un estudiante no puede crear horarios (403)", async () => {
    const { token } = crearEstudiante();
    const res = await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "servicio-1", fecha: mananaStr(), horaInicio: "09:00", horaFin: "09:45" });
    expect(res.status).toBe(403);
  });

  test("el administrador crea un horario valido", async () => {
    const { token } = crearAdmin();
    const res = await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "servicio-1", fecha: mananaStr(), horaInicio: "09:00", horaFin: "09:45", cupo: 1 });

    expect(res.status).toBe(201);
    expect(res.body.horario).toMatchObject({ servicioId: "servicio-1", ocupado: false });
    expect(res.body.horario.servicio).toBeTruthy();
  });

  test("rechaza si la hora de inicio no es anterior a la de fin (400)", async () => {
    const { token } = crearAdmin();
    const res = await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "servicio-1", fecha: mananaStr(), horaInicio: "10:00", horaFin: "09:00" });
    expect(res.status).toBe(400);
  });

  test("rechaza un horario que se solapa con uno existente del mismo servicio (409)", async () => {
    const { token } = crearAdmin();
    await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "servicio-1", fecha: mananaStr(), horaInicio: "09:00", horaFin: "10:00" });

    const res = await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "servicio-1", fecha: mananaStr(), horaInicio: "09:30", horaFin: "10:30" });
    expect(res.status).toBe(409);
  });

  test("servicio inexistente responde 404", async () => {
    const { token } = crearAdmin();
    const res = await request(app)
      .post("/api/v1/admin/horarios")
      .set("Authorization", `Bearer ${token}`)
      .send({ servicioId: "no-existe", fecha: mananaStr(), horaInicio: "09:00", horaFin: "09:45" });
    expect(res.status).toBe(404);
  });
});

describe("RF-007 / HU-14: modificacion y deshabilitacion de horarios", () => {
  test("lista todos los horarios, incluidos los ocupados", async () => {
    const { token } = crearAdmin();
    prisma.__seedHorario({ fecha: manana(), ocupado: false });
    prisma.__seedHorario({ fecha: manana(), ocupado: true });

    const res = await request(app).get("/api/v1/admin/horarios").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.horarios).toHaveLength(2);
  });

  test("actualiza un horario sin citas activas", async () => {
    const { token } = crearAdmin();
    const horario = prisma.__seedHorario({ fecha: manana() });

    const res = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ cupo: 3 });
    expect(res.status).toBe(200);
    expect(res.body.horario.cupo).toBe(3);
  });

  test("no permite modificar un horario con una cita agendada (409)", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: tokenEstudiante } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horario.id });

    const res = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ cupo: 3 });
    expect(res.status).toBe(409);
  });

  test("deshabilita un horario libre directamente", async () => {
    const { token } = crearAdmin();
    const horario = prisma.__seedHorario({ fecha: manana() });

    const res = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}/deshabilitar`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.horario.ocupado).toBe(true);
  });

  test("deshabilitar un horario con cita activa exige confirmacion", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: tokenEstudiante } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horario.id });

    const sinConfirmar = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}/deshabilitar`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({});
    expect(sinConfirmar.status).toBe(409);

    const conConfirmar = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}/deshabilitar`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ confirmar: true });
    expect(conConfirmar.status).toBe(200);
    expect(conConfirmar.body.horario.ocupado).toBe(true);

    const misCitas = await request(app)
      .get("/api/v1/citas/mias")
      .set("Authorization", `Bearer ${tokenEstudiante}`);
    expect(misCitas.body.citas[0].estado).toBe("Cancelada");
  });

  test("habilita de nuevo un horario deshabilitado sin citas activas", async () => {
    const { token } = crearAdmin();
    const horario = prisma.__seedHorario({ fecha: manana(), ocupado: true });

    const res = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}/habilitar`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.horario.ocupado).toBe(false);
  });

  test("no permite habilitar un horario con una cita activa real (409)", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: tokenEstudiante } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horario.id });

    const res = await request(app)
      .patch(`/api/v1/admin/horarios/${horario.id}/habilitar`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(409);
  });
});

describe("RF-008 / HU-15: agenda administrativa de citas", () => {
  test("un estudiante no puede ver la agenda administrativa (403)", async () => {
    const { token } = crearEstudiante();
    const res = await request(app).get("/api/v1/admin/citas").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("el administrador ve las citas de todos los estudiantes", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: token1 } = crearEstudiante("estudiante1@uniautonoma.edu.co");
    const { token: token2 } = crearEstudiante("estudiante2@uniautonoma.edu.co");
    const horario1 = prisma.__seedHorario({ fecha: manana() });
    const horario2 = prisma.__seedHorario({ fecha: manana() });

    await request(app).post("/api/v1/citas").set("Authorization", `Bearer ${token1}`).send({ horarioId: horario1.id });
    await request(app).post("/api/v1/citas").set("Authorization", `Bearer ${token2}`).send({ horarioId: horario2.id });

    const res = await request(app).get("/api/v1/admin/citas").set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.citas).toHaveLength(2);
    expect(res.body.citas[0].usuario).toBeTruthy();
  });

  test("filtra la agenda por fecha", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: tokenEstudiante } = crearEstudiante();
    const horarioManana = prisma.__seedHorario({ fecha: manana() });
    await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horarioManana.id });

    const res = await request(app)
      .get(`/api/v1/admin/citas?fecha=${mananaStr()}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.citas).toHaveLength(1);
  });
});

describe("RF-008 / HU-16: registro de asistencia", () => {
  async function crearCitaDePrueba() {
    const { token: tokenEstudiante } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    const res = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horario.id });
    return res.body.cita;
  }

  test("registra asistencia positiva y cambia el estado a Atendida", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const cita = await crearCitaDePrueba();

    const res = await request(app)
      .patch(`/api/v1/admin/citas/${cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ asistio: true });
    expect(res.status).toBe(200);
    expect(res.body.cita.estado).toBe("Atendida");
  });

  test("registra inasistencia y cambia el estado a NoAsistio", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const cita = await crearCitaDePrueba();

    const res = await request(app)
      .patch(`/api/v1/admin/citas/${cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ asistio: false });
    expect(res.status).toBe(200);
    expect(res.body.cita.estado).toBe("NoAsistio");
  });

  test("no permite registrar la asistencia dos veces (409)", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const cita = await crearCitaDePrueba();

    await request(app)
      .patch(`/api/v1/admin/citas/${cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ asistio: true });

    const res = await request(app)
      .patch(`/api/v1/admin/citas/${cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ asistio: true });
    expect(res.status).toBe(409);
  });

  test("no permite registrar asistencia de una cita cancelada (409)", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const { token: tokenEstudiante } = crearEstudiante();
    const horario = prisma.__seedHorario({ fecha: manana() });
    const agendada = await request(app)
      .post("/api/v1/citas")
      .set("Authorization", `Bearer ${tokenEstudiante}`)
      .send({ horarioId: horario.id });
    await request(app)
      .patch(`/api/v1/citas/${agendada.body.cita.id}/cancelar`)
      .set("Authorization", `Bearer ${tokenEstudiante}`);

    const res = await request(app)
      .patch(`/api/v1/admin/citas/${agendada.body.cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ asistio: true });
    expect(res.status).toBe(409);
  });

  test("sin el campo asistio, responde 400", async () => {
    const { token: tokenAdmin } = crearAdmin();
    const cita = await crearCitaDePrueba();

    const res = await request(app)
      .patch(`/api/v1/admin/citas/${cita.id}/asistencia`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
