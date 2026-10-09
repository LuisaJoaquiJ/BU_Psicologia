// Atencion sin cita: el profesional registra a un estudiante que llego sin
// haber pedido cita.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

let admin, estudiante, servicio;
beforeEach(() => {
  prisma.__reset();
  admin = crearUsuario("Administrador", "orientadora@uniautonoma.edu.co");
  estudiante = crearUsuario("Estudiante", "ana.lopez@uniautonoma.edu.co", "Ana López");
  servicio = prisma.__seedServicio({ nombre: "Orientación psicológica", modulo: "desarrollo-humano" });
});

describe("Atención sin cita", () => {
  test("busca estudiantes por nombre o correo", async () => {
    const res = await request(app).get("/api/v1/admin/citas/estudiantes?q=lopez").set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.estudiantes).toEqual([{ id: estudiante.usuario.id, nombre: "Ana López", email: "ana.lopez@uniautonoma.edu.co" }]);
    const corto = await request(app).get("/api/v1/admin/citas/estudiantes?q=a").set(auth(admin.token));
    expect(corto.body.estudiantes).toEqual([]);
  });

  test("registra la atención como cita atendida, sin aparecer en los horarios", async () => {
    const res = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(admin.token))
      .send({ usuarioId: estudiante.usuario.id, servicioId: servicio.id, hora: "10:15", duracion: 45, observaciones: "Llegó por orientación vocacional" });
    expect(res.status).toBe(201);
    expect(res.body.cita).toMatchObject({ estado: "Atendida", usuarioId: estudiante.usuario.id, observaciones: "Llegó por orientación vocacional" });
    expect(res.body.cita.horario).toMatchObject({ sinCita: true, ocupado: true });
    expect(res.body.cita.horario.horaFin).toContain("11:00");
    expect(await prisma.asistenciaCita.findUnique({ where: { citaId: res.body.cita.id } })).toMatchObject({ asistio: true, registradoPorId: admin.usuario.id });

    const agenda = await request(app).get("/api/v1/admin/citas").set(auth(admin.token));
    expect(agenda.body.citas.map((c) => c.id)).toContain(res.body.cita.id);
    const horarios = await request(app).get("/api/v1/admin/horarios").set(auth(admin.token));
    expect(horarios.body.horarios.some((h) => h.sinCita)).toBe(false);

    const mias = await request(app).get("/api/v1/citas/mias").set(auth(estudiante.token));
    expect(mias.body.citas.map((c) => c.id)).toContain(res.body.cita.id);
  });

  test("crea al estudiante si nunca ha entrado, solo con correo institucional", async () => {
    const externo = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(admin.token))
      .send({ correo: "alguien@gmail.com", nombre: "Pedro Pérez", servicioId: servicio.id });
    expect(externo.status).toBe(400);

    const res = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(admin.token))
      .send({ correo: "Pedro.Perez@uniautonoma.edu.co", nombre: "Pedro Pérez", servicioId: servicio.id });
    expect(res.status).toBe(201);
    const nuevo = await prisma.usuario.findUnique({ where: { emailInstitucional: "pedro.perez@uniautonoma.edu.co" } });
    expect(nuevo).toMatchObject({ nombre: "Pedro Pérez", rolId: "rol-estudiante" });
  });

  test("valida servicio del módulo, fecha futura y acceso", async () => {
    const salud = prisma.__seedServicio({ nombre: "Enfermería", modulo: "salud" });
    const otro = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(admin.token))
      .send({ usuarioId: estudiante.usuario.id, servicioId: salud.id });
    expect(otro.status).toBe(403);

    const futura = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(admin.token))
      .send({ usuarioId: estudiante.usuario.id, servicioId: servicio.id, fecha: "2099-01-01" });
    expect(futura.status).toBe(400);

    const comoEstudiante = await request(app)
      .post("/api/v1/admin/citas/sin-cita")
      .set(auth(estudiante.token))
      .send({ usuarioId: estudiante.usuario.id, servicioId: servicio.id });
    expect(comoEstudiante.status).toBe(403);
  });
});
