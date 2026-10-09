// Pruebas del Sprint 4 (RF-009, RF-010, RF-011): gestion de eventos por el
// administrador, consulta e inscripcion de estudiantes y control de
// asistencia a eventos. Reglas: RN-006, RN-007, RN-008, RN-010.

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

function crearUsuario(rol, email) {
  const usuario = prisma.__seedUsuario({
    emailInstitucional: email,
    nombre: rol === "Administrador" ? "Admin de Prueba" : `Estudiante ${email}`,
    rolId: rol === "Administrador" ? "rol-administrador" : "rol-estudiante",
  });
  return { usuario, token: signToken({ sub: usuario.id, rol }) };
}

const crearAdmin = () => crearUsuario("Administrador", "admin@uniautonoma.edu.co");
const crearEstudiante = (email = "estudiante@uniautonoma.edu.co") => crearUsuario("Estudiante", email);

function diasDesdeHoy(dias) {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias));
}

const isoDia = (dias) => diasDesdeHoy(dias).toISOString().slice(0, 10);

function eventoValido(extra = {}) {
  return {
    nombre: "Taller de mindfulness",
    descripcion: "Respiración y atención plena.",
    lugar: "Auditorio principal",
    fecha: isoDia(10),
    horaInicio: "14:00",
    horaFin: "16:00",
    cupos: 20,
    fechaLimiteInscripcion: isoDia(8),
    ...extra,
  };
}

function sembrarEventoPublicado(extra = {}) {
  return prisma.__seedEvento({
    fecha: diasDesdeHoy(10),
    fechaLimiteInscripcion: diasDesdeHoy(8),
    ...extra,
  });
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  prisma.__reset();
});

describe("RF-009 / RN-008: gestion de eventos (administrador)", () => {
  test("sin token responde 401 y un estudiante recibe 403", async () => {
    const sinToken = await request(app).get("/api/v1/admin/eventos");
    expect(sinToken.status).toBe(401);

    const { token } = crearEstudiante();
    const res = await request(app).post("/api/v1/admin/eventos").set(auth(token)).send(eventoValido());
    expect(res.status).toBe(403);
  });

  test("crea un evento en estado Borrador por defecto", async () => {
    const { token } = crearAdmin();
    const res = await request(app).post("/api/v1/admin/eventos").set(auth(token)).send(eventoValido());

    expect(res.status).toBe(201);
    expect(res.body.evento).toMatchObject({ nombre: "Taller de mindfulness", estado: "Borrador", cupos: 20 });
  });

  test("valida campos obligatorios, horas y fecha limite", async () => {
    const { token } = crearAdmin();

    const faltan = await request(app).post("/api/v1/admin/eventos").set(auth(token)).send({ nombre: "X" });
    expect(faltan.status).toBe(400);

    const horas = await request(app)
      .post("/api/v1/admin/eventos")
      .set(auth(token))
      .send(eventoValido({ horaInicio: "17:00", horaFin: "16:00" }));
    expect(horas.status).toBe(400);

    const limite = await request(app)
      .post("/api/v1/admin/eventos")
      .set(auth(token))
      .send(eventoValido({ fechaLimiteInscripcion: isoDia(12) }));
    expect(limite.status).toBe(400);

    const cupos = await request(app).post("/api/v1/admin/eventos").set(auth(token)).send(eventoValido({ cupos: 0 }));
    expect(cupos.status).toBe(400);
  });

  test("edita un evento, pero RN-007 impide dejar menos cupos que inscritos", async () => {
    const { token } = crearAdmin();
    const evento = sembrarEventoPublicado({ cupos: 5 });
    const a = crearEstudiante("a@uniautonoma.edu.co");
    const b = crearEstudiante("b@uniautonoma.edu.co");
    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(a.token));
    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(b.token));

    const ok = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}`)
      .set(auth(token))
      .send({ nombre: "Nuevo nombre", lugar: "Sala 2" });
    expect(ok.status).toBe(200);
    expect(ok.body.evento).toMatchObject({ nombre: "Nuevo nombre", lugar: "Sala 2" });

    const menosCupos = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}`)
      .set(auth(token))
      .send({ cupos: 1 });
    expect(menosCupos.status).toBe(409);
  });

  test("publica un evento y deja trazabilidad del cambio de estado", async () => {
    const { token, usuario } = crearAdmin();
    const creado = await request(app).post("/api/v1/admin/eventos").set(auth(token)).send(eventoValido());

    const res = await request(app)
      .patch(`/api/v1/admin/eventos/${creado.body.evento.id}/estado`)
      .set(auth(token))
      .send({ estado: "Publicado" });

    expect(res.status).toBe(200);
    expect(res.body.evento.estado).toBe("Publicado");
    const historial = await prisma.historialEstado.findMany({ where: { eventoId: creado.body.evento.id } });
    expect(historial).toEqual([
      expect.objectContaining({ estadoAnterior: "Borrador", estadoNuevo: "Publicado", usuarioId: usuario.id }),
    ]);
  });

  test("un evento cancelado no se puede reactivar y un estado invalido responde 400", async () => {
    const { token } = crearAdmin();
    const evento = sembrarEventoPublicado({ estado: "Cancelado" });

    const reactivar = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/estado`)
      .set(auth(token))
      .send({ estado: "Publicado" });
    expect(reactivar.status).toBe(409);

    const invalido = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/estado`)
      .set(auth(token))
      .send({ estado: "Inventado" });
    expect(invalido.status).toBe(400);
  });

  test("eliminar un evento con inscripciones activas exige confirmacion", async () => {
    const { token } = crearAdmin();
    const evento = sembrarEventoPublicado();
    const estudiante = crearEstudiante();
    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(estudiante.token));

    const sinConfirmar = await request(app).delete(`/api/v1/admin/eventos/${evento.id}`).set(auth(token));
    expect(sinConfirmar.status).toBe(409);

    const confirmado = await request(app)
      .delete(`/api/v1/admin/eventos/${evento.id}?confirmar=true`)
      .set(auth(token));
    expect(confirmado.status).toBe(200);

    const despues = await request(app).get(`/api/v1/admin/eventos/${evento.id}`).set(auth(token));
    expect(despues.status).toBe(404);
  });

  test("un evento sin inscripciones se elimina sin confirmacion", async () => {
    const { token } = crearAdmin();
    const evento = sembrarEventoPublicado({ estado: "Borrador" });
    const res = await request(app).delete(`/api/v1/admin/eventos/${evento.id}`).set(auth(token));
    expect(res.status).toBe(200);
  });
});

describe("RF-010: consulta e inscripcion a eventos (estudiante)", () => {
  test("solo lista eventos publicados y futuros, con cupos disponibles", async () => {
    const { token } = crearEstudiante();
    const publicado = sembrarEventoPublicado({ cupos: 3 });
    sembrarEventoPublicado({ estado: "Borrador" });
    sembrarEventoPublicado({ fecha: diasDesdeHoy(-2), fechaLimiteInscripcion: diasDesdeHoy(-3) });

    const res = await request(app).get("/api/v1/eventos").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.eventos[0]).toMatchObject({
      id: publicado.id,
      cuposDisponibles: 3,
      inscripcionAbierta: true,
      miInscripcion: null,
    });
  });

  test("se inscribe y el detalle refleja su inscripcion y el cupo usado", async () => {
    const { token } = crearEstudiante();
    const evento = sembrarEventoPublicado({ cupos: 3 });

    const res = await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(token));
    expect(res.status).toBe(201);
    expect(res.body.inscripcion.estado).toBe("Confirmada");

    const detalle = await request(app).get(`/api/v1/eventos/${evento.id}`).set(auth(token));
    expect(detalle.body.evento).toMatchObject({ cuposDisponibles: 2, miInscripcion: { estado: "Confirmada" } });
  });

  test("RN-006: no permite inscribirse dos veces al mismo evento", async () => {
    const { token } = crearEstudiante();
    const evento = sembrarEventoPublicado();

    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(token));
    const segunda = await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(token));

    expect(segunda.status).toBe(409);
    expect(await prisma.inscripcion.count({ where: { eventoId: evento.id } })).toBe(1);
  });

  test("RN-007: no permite superar los cupos del evento", async () => {
    const evento = sembrarEventoPublicado({ cupos: 1 });
    const a = crearEstudiante("a@uniautonoma.edu.co");
    const b = crearEstudiante("b@uniautonoma.edu.co");

    const primera = await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(a.token));
    const segunda = await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(b.token));

    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(409);
    expect(segunda.body.message).toMatch(/cupos/i);
  });

  test("rechaza inscripciones despues de la fecha limite o en eventos no publicados", async () => {
    const { token } = crearEstudiante();
    const cerrado = sembrarEventoPublicado({ fechaLimiteInscripcion: diasDesdeHoy(-1) });
    const borrador = sembrarEventoPublicado({ estado: "Borrador" });

    const tarde = await request(app).post(`/api/v1/eventos/${cerrado.id}/inscripciones`).set(auth(token));
    expect(tarde.status).toBe(409);

    const noPublicado = await request(app).post(`/api/v1/eventos/${borrador.id}/inscripciones`).set(auth(token));
    expect(noPublicado.status).toBe(404);
  });

  test("cancelar la inscripcion libera el cupo y permite volver a inscribirse", async () => {
    const evento = sembrarEventoPublicado({ cupos: 1 });
    const a = crearEstudiante("a@uniautonoma.edu.co");
    const b = crearEstudiante("b@uniautonoma.edu.co");

    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(a.token));
    const cancelar = await request(app)
      .patch(`/api/v1/eventos/${evento.id}/inscripciones/cancelar`)
      .set(auth(a.token));
    expect(cancelar.status).toBe(200);
    expect(cancelar.body.inscripcion.estado).toBe("Cancelada");

    const otra = await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(b.token));
    expect(otra.status).toBe(201);

    const mias = await request(app).get("/api/v1/eventos/mis-inscripciones").set(auth(a.token));
    expect(mias.body.inscripciones).toEqual([expect.objectContaining({ estado: "Cancelada" })]);
  });
});

describe("RF-011 / RN-010: control de asistencia a eventos", () => {
  test("lista los inscritos y registra (y corrige) su asistencia", async () => {
    const admin = crearAdmin();
    const evento = sembrarEventoPublicado();
    const estudiante = crearEstudiante();
    const inscripcion = await request(app)
      .post(`/api/v1/eventos/${evento.id}/inscripciones`)
      .set(auth(estudiante.token));

    const lista = await request(app).get(`/api/v1/admin/eventos/${evento.id}/inscripciones`).set(auth(admin.token));
    expect(lista.status).toBe(200);
    expect(lista.body.inscripciones).toHaveLength(1);
    expect(lista.body.inscripciones[0].usuario.emailInstitucional).toBe("estudiante@uniautonoma.edu.co");

    const url = `/api/v1/admin/eventos/${evento.id}/inscripciones/${inscripcion.body.inscripcion.id}/asistencia`;
    const registro = await request(app).patch(url).set(auth(admin.token)).send({ asistio: true });
    expect(registro.status).toBe(200);
    expect(registro.body.inscripcion.asistencia).toMatchObject({ asistio: true, registradoPorId: admin.usuario.id });

    const correccion = await request(app).patch(url).set(auth(admin.token)).send({ asistio: false });
    expect(correccion.body.inscripcion.asistencia.asistio).toBe(false);
  });

  test("RN-010: no registra asistencia de alguien que no esta inscrito en ese evento", async () => {
    const admin = crearAdmin();
    const evento = sembrarEventoPublicado();
    const otroEvento = sembrarEventoPublicado();
    const estudiante = crearEstudiante();
    const inscripcion = await request(app)
      .post(`/api/v1/eventos/${otroEvento.id}/inscripciones`)
      .set(auth(estudiante.token));

    const res = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/inscripciones/${inscripcion.body.inscripcion.id}/asistencia`)
      .set(auth(admin.token))
      .send({ asistio: true });
    expect(res.status).toBe(404);
  });

  test("RN-010: no registra asistencia sobre una inscripcion cancelada", async () => {
    const admin = crearAdmin();
    const evento = sembrarEventoPublicado();
    const estudiante = crearEstudiante();
    const inscripcion = await request(app)
      .post(`/api/v1/eventos/${evento.id}/inscripciones`)
      .set(auth(estudiante.token));
    await request(app).patch(`/api/v1/eventos/${evento.id}/inscripciones/cancelar`).set(auth(estudiante.token));

    const res = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/inscripciones/${inscripcion.body.inscripcion.id}/asistencia`)
      .set(auth(admin.token))
      .send({ asistio: true });
    expect(res.status).toBe(409);
  });

  test("un estudiante no puede registrar asistencia (403)", async () => {
    const evento = sembrarEventoPublicado();
    const estudiante = crearEstudiante();
    const res = await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/inscripciones/x/asistencia`)
      .set(auth(estudiante.token))
      .send({ asistio: true });
    expect(res.status).toBe(403);
  });
});

describe("Inicio publico: proximos eventos sin sesion", () => {
  test("lista solo eventos publicados y futuros, sin datos de inscritos", async () => {
    const evento = sembrarEventoPublicado({ cupos: 3, nombre: "Feria de bienestar" });
    sembrarEventoPublicado({ estado: "Borrador" });
    const { token } = crearEstudiante();
    await request(app).post(`/api/v1/eventos/${evento.id}/inscripciones`).set(auth(token));

    const res = await request(app).get("/api/v1/eventos/publicos");

    expect(res.status).toBe(200);
    expect(res.body.eventos).toEqual([
      expect.objectContaining({ id: evento.id, nombre: "Feria de bienestar", cuposDisponibles: 2 }),
    ]);
    expect(res.body.eventos[0]).not.toHaveProperty("inscripciones");
    expect(res.body.eventos[0]).not.toHaveProperty("_count");
  });
});
