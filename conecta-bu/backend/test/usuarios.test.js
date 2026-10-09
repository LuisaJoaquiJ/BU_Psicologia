// Pruebas del Sprint 5 · RF-012: administracion de usuarios (RN-008).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

beforeEach(() => {
  prisma.__reset();
});

describe("RF-012: consulta de usuarios", () => {
  test("un estudiante no puede consultar usuarios (403)", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/admin/usuarios").set(auth(token));
    expect(res.status).toBe(403);
  });

  test("el administrador lista usuarios con su rol y puede filtrar", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez");
    crearUsuario("Estudiante", "luis@uniautonoma.edu.co", "Luis Gómez");

    const todos = await request(app).get("/api/v1/admin/usuarios").set(auth(token));
    expect(todos.status).toBe(200);
    expect(todos.body.usuarios).toHaveLength(3);
    expect(todos.body.roles).toEqual(expect.arrayContaining(["Estudiante", "Administrador"]));
    expect(todos.body.usuarios[0]).toEqual(
      expect.objectContaining({ email: expect.any(String), rol: expect.any(String), habilitado: true })
    );

    const estudiantes = await request(app).get("/api/v1/admin/usuarios?rol=Estudiante").set(auth(token));
    expect(estudiantes.body.usuarios).toHaveLength(2);

    const busqueda = await request(app).get("/api/v1/admin/usuarios?busqueda=ana").set(auth(token));
    expect(busqueda.body.usuarios.map((u) => u.email)).toEqual(["ana@uniautonoma.edu.co"]);
  });
});

describe("RF-012: cambio de rol y estado", () => {
  test("promueve un estudiante a administrador", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const estudiante = crearUsuario("Estudiante", "e@uniautonoma.edu.co");

    const res = await request(app)
      .patch(`/api/v1/admin/usuarios/${estudiante.usuario.id}/rol`)
      .set(auth(admin.token))
      .send({ rol: "Administrador" });

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe("Administrador");
  });

  test("rechaza un rol inexistente (400)", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const estudiante = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app)
      .patch(`/api/v1/admin/usuarios/${estudiante.usuario.id}/rol`)
      .set(auth(admin.token))
      .send({ rol: "SuperUsuario" });
    expect(res.status).toBe(400);
  });

  test("deshabilitar a un usuario le corta el acceso de inmediato", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const estudiante = crearUsuario("Estudiante", "e@uniautonoma.edu.co");

    const res = await request(app)
      .patch(`/api/v1/admin/usuarios/${estudiante.usuario.id}/estado`)
      .set(auth(admin.token))
      .send({ habilitado: false });
    expect(res.status).toBe(200);
    expect(res.body.usuario.habilitado).toBe(false);

    const acceso = await request(app).get("/api/v1/auth/me").set(auth(estudiante.token));
    expect(acceso.status).toBe(401);

    const reactivar = await request(app)
      .patch(`/api/v1/admin/usuarios/${estudiante.usuario.id}/estado`)
      .set(auth(admin.token))
      .send({ habilitado: true });
    expect(reactivar.body.usuario.habilitado).toBe(true);
  });

  test("el administrador no puede cambiarse su propio rol ni deshabilitarse", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");

    const rol = await request(app)
      .patch(`/api/v1/admin/usuarios/${admin.usuario.id}/rol`)
      .set(auth(admin.token))
      .send({ rol: "Estudiante" });
    expect(rol.status).toBe(403);

    const estado = await request(app)
      .patch(`/api/v1/admin/usuarios/${admin.usuario.id}/estado`)
      .set(auth(admin.token))
      .send({ habilitado: false });
    expect(estado.status).toBe(403);
  });

  test("siempre debe quedar al menos un administrador habilitado", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const otroAdmin = crearUsuario("Administrador", "admin2@uniautonoma.edu.co");

    // Con dos administradores, se puede deshabilitar a uno.
    const primero = await request(app)
      .patch(`/api/v1/admin/usuarios/${otroAdmin.usuario.id}/estado`)
      .set(auth(admin.token))
      .send({ habilitado: false });
    expect(primero.status).toBe(200);

    // Simula que el unico admin habilitado restante intenta ser degradado por
    // otro admin (deshabilitado no puede, asi que se prueba via servicio).
    const { cambiarRolUsuario } = require("../src/modules/usuarios/usuarios.service");
    await expect(cambiarRolUsuario(otroAdmin.usuario.id, admin.usuario.id, "Estudiante")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test("habilitado debe ser booleano", async () => {
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const estudiante = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app)
      .patch(`/api/v1/admin/usuarios/${estudiante.usuario.id}/estado`)
      .set(auth(admin.token))
      .send({ habilitado: "no" });
    expect(res.status).toBe(400);
  });
});
