// Tiempo no disponible del personal (compromisos, incapacidad, permisos...).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

const hora = (h, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
const iso = (d) => d.toISOString().slice(0, 10);

let admin, estudiante, servicio;
beforeEach(() => {
  prisma.__reset();
  admin = crearUsuario("Administrador", "orientadora@uniautonoma.edu.co");
  estudiante = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana López");
  servicio = prisma.__seedServicio({ nombre: "Orientación psicológica", modulo: "desarrollo-humano" });
});

describe("Tiempo no disponible", () => {
  test("crea, lista y elimina un bloqueo; el motivo es obligatorio", async () => {
    const sinMotivo = await request(app)
      .post("/api/v1/admin/horarios/bloqueos")
      .set(auth(admin.token))
      .send({ fechaInicio: iso(diasDesdeHoy(2)) });
    expect(sinMotivo.status).toBe(400);

    const res = await request(app)
      .post("/api/v1/admin/horarios/bloqueos")
      .set(auth(admin.token))
      .send({ motivo: "Incapacidad", fechaInicio: iso(diasDesdeHoy(2)), fechaFin: iso(diasDesdeHoy(4)) });
    expect(res.status).toBe(201);
    expect(res.body.bloqueo).toMatchObject({ motivo: "Incapacidad", todoElDia: true, fechaInicio: iso(diasDesdeHoy(2)), creadoPor: "Admin de Prueba" });

    const lista = await request(app).get("/api/v1/admin/horarios/bloqueos").set(auth(admin.token));
    expect(lista.body.bloqueos).toHaveLength(1);
    expect(lista.body.motivos).toContain("Permiso laboral");

    const borrar = await request(app).delete(`/api/v1/admin/horarios/bloqueos/${res.body.bloqueo.id}`).set(auth(admin.token));
    expect(borrar.status).toBe(200);
    const vacia = await request(app).get("/api/v1/admin/horarios/bloqueos").set(auth(admin.token));
    expect(vacia.body.bloqueos).toHaveLength(0);
  });

  test("oculta a los estudiantes los horarios que caen en el bloqueo y no deja publicar ahí", async () => {
    prisma.__seedHorario({ servicioId: servicio.id, fecha: diasDesdeHoy(2), horaInicio: hora(9), horaFin: hora(10) });
    prisma.__seedHorario({ servicioId: servicio.id, fecha: diasDesdeHoy(2), horaInicio: hora(14), horaFin: hora(15) });
    await request(app)
      .post("/api/v1/admin/horarios/bloqueos")
      .set(auth(admin.token))
      .send({ motivo: "Reunión", fechaInicio: iso(diasDesdeHoy(2)), todoElDia: false, horaInicio: "08:00", horaFin: "12:00" });

    const disp = await request(app).get("/api/v1/citas/horarios-disponibles").set(auth(estudiante.token));
    expect(disp.body.horarios).toHaveLength(1);
    expect(disp.body.horarios[0].horaInicio).toContain("14:00");

    const nuevo = await request(app)
      .post("/api/v1/admin/horarios")
      .set(auth(admin.token))
      .send({ servicioId: servicio.id, fecha: iso(diasDesdeHoy(2)), horaInicio: "10:00", horaFin: "11:00" });
    expect(nuevo.status).toBe(409);
    expect(nuevo.body.codigo).toBe("HORARIO_EN_BLOQUEO");
  });

  test("si hay citas agendadas pide confirmar y al confirmar las cancela", async () => {
    const h = prisma.__seedHorario({ servicioId: servicio.id, fecha: diasDesdeHoy(3), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const cita = await prisma.cita.create({ data: { usuarioId: estudiante.usuario.id, horarioId: h.id, estado: "Agendada" } });
    const cuerpo = { motivo: "Permiso laboral", fechaInicio: iso(diasDesdeHoy(3)) };

    const afectadas = await request(app).post("/api/v1/admin/horarios/bloqueos/citas-afectadas").set(auth(admin.token)).send(cuerpo);
    expect(afectadas.body.citas).toEqual([expect.objectContaining({ estudiante: "Ana López" })]);

    const sinConfirmar = await request(app).post("/api/v1/admin/horarios/bloqueos").set(auth(admin.token)).send(cuerpo);
    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.codigo).toBe("CITAS_EN_BLOQUEO");

    const ok = await request(app)
      .post("/api/v1/admin/horarios/bloqueos")
      .set(auth(admin.token))
      .send({ ...cuerpo, confirmar: true });
    expect(ok.status).toBe(201);
    expect(ok.body.citasCanceladas).toBe(1);
    expect((await prisma.cita.findUnique({ where: { id: cita.id } })).estado).toBe("Cancelada");
  });

  test("solo el personal del módulo", async () => {
    const res = await request(app).get("/api/v1/admin/horarios/bloqueos").set(auth(estudiante.token));
    expect(res.status).toBe(403);
  });
});

describe("Eventos virtuales", () => {
  const base = () => ({
    nombre: "Taller de hábitos de estudio",
    fecha: iso(diasDesdeHoy(5)),
    horaInicio: "14:00",
    horaFin: "16:00",
    cupos: 20,
    fechaLimiteInscripcion: iso(diasDesdeHoy(4)),
    estado: "Publicado",
  });

  test("un evento virtual exige enlace y solo lo ven los inscritos", async () => {
    const sinEnlace = await request(app)
      .post("/api/v1/admin/eventos")
      .set(auth(admin.token))
      .send({ ...base(), modalidad: "Virtual" });
    expect(sinEnlace.status).toBe(400);

    const res = await request(app)
      .post("/api/v1/admin/eventos")
      .set(auth(admin.token))
      .send({ ...base(), modalidad: "Virtual", enlaceReunion: "meet.google.com/abc-defg-hij" });
    expect(res.status).toBe(201);
    expect(res.body.evento).toMatchObject({ modalidad: "Virtual", enlaceReunion: "https://meet.google.com/abc-defg-hij" });
    const id = res.body.evento.id;
    await request(app).patch(`/api/v1/admin/eventos/${id}/estado`).set(auth(admin.token)).send({ estado: "Publicado" });

    const antes = await request(app).get("/api/v1/eventos").set(auth(estudiante.token));
    const ev = antes.body.eventos.find((e) => e.id === id);
    expect(ev).toMatchObject({ modalidad: "Virtual", enlaceReunion: null });

    await request(app).post(`/api/v1/eventos/${id}/inscripciones`).set(auth(estudiante.token));
    const despues = await request(app).get("/api/v1/eventos").set(auth(estudiante.token));
    expect(despues.body.eventos.find((e) => e.id === id).enlaceReunion).toBe("https://meet.google.com/abc-defg-hij");
  });

  test("un evento presencial no guarda enlace", async () => {
    const res = await request(app)
      .post("/api/v1/admin/eventos")
      .set(auth(admin.token))
      .send({ ...base(), modalidad: "Presencial", enlaceReunion: "https://zoom.us/j/1" });
    expect(res.body.evento).toMatchObject({ modalidad: "Presencial", enlaceReunion: null });
  });
});
