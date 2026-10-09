// Pruebas de accesos por modulo y del superadministrador: cada modulo de
// Conecta BU (Desarrollo humano y orientacion, Salud integral) es
// independiente y solo entra el personal cuyo correo fue asignado.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

let superadmin;
beforeEach(() => {
  prisma.__reset();
  superadmin = crearUsuario("SuperAdministrador", "super@uniautonoma.edu.co");
});

const api = (metodo, ruta, token = superadmin.token) => request(app)[metodo](`/api/v1/super${ruta}`).set(auth(token));

describe("Superadministrador: accesos por modulo", () => {
  test("solo el superadministrador administra los accesos", async () => {
    const dh = crearUsuario("Administrador", "dh@uniautonoma.edu.co");
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    expect((await api("get", "/accesos", dh.token)).status).toBe(403);
    expect((await api("get", "/accesos", est.token)).status).toBe(403);
    expect((await api("get", "/accesos")).status).toBe(200);
  });

  test("asignar un correo a Salud lo vuelve personal de ese modulo, y solo de ese", async () => {
    const enfermera = crearUsuario("Estudiante", "enfermera@uniautonoma.edu.co");
    const res = await api("post", "/accesos").send({ email: " Enfermera@UniAutonoma.edu.co ", modulo: "salud" });
    expect(res.status).toBe(201);
    expect(res.body.acceso.email).toBe("enfermera@uniautonoma.edu.co");

    const me = await request(app).get("/api/v1/auth/me").set(auth(enfermera.token));
    expect(me.body.usuario).toMatchObject({ rol: "Administrador", modulos: ["salud"] });
    expect((await request(app).get("/api/v1/salud/catalogos").set(auth(enfermera.token))).status).toBe(200);
    expect((await request(app).get("/api/v1/admin/eventos").set(auth(enfermera.token))).status).toBe(403);

    const repetido = await api("post", "/accesos").send({ email: "enfermera@uniautonoma.edu.co", modulo: "salud" });
    expect(repetido.status).toBe(409);
  });

  test("valida correo institucional y modulo", async () => {
    expect((await api("post", "/accesos").send({ email: "alguien@gmail.com", modulo: "salud" })).status).toBe(400);
    expect((await api("post", "/accesos").send({ email: "a@uniautonoma.edu.co", modulo: "cocina" })).status).toBe(400);
  });

  test("quitar el ultimo acceso devuelve a la persona a estudiante", async () => {
    const persona = crearUsuario("Estudiante", "p@uniautonoma.edu.co");
    const a1 = (await api("post", "/accesos").send({ email: "p@uniautonoma.edu.co", modulo: "salud" })).body.acceso;
    const a2 = (await api("post", "/accesos").send({ email: "p@uniautonoma.edu.co", modulo: "desarrollo-humano" })).body.acceso;
    let me = await request(app).get("/api/v1/auth/me").set(auth(persona.token));
    expect(me.body.usuario.modulos.sort()).toEqual(["desarrollo-humano", "salud"]);

    await api("delete", `/accesos/${a1.id}`);
    me = await request(app).get("/api/v1/auth/me").set(auth(persona.token));
    expect(me.body.usuario).toMatchObject({ rol: "Administrador", modulos: ["desarrollo-humano"] });

    await api("delete", `/accesos/${a2.id}`);
    me = await request(app).get("/api/v1/auth/me").set(auth(persona.token));
    expect(me.body.usuario).toMatchObject({ rol: "Estudiante", modulos: [] });
  });

  test("se puede asignar un correo antes de su primer ingreso", async () => {
    await api("post", "/accesos").send({ email: "nueva@uniautonoma.edu.co", modulo: "salud" });
    const { aplicarAccesos } = require("../src/modules/auth/auth.service");
    const nueva = crearUsuario("Estudiante", "nueva@uniautonoma.edu.co");
    const conRol = await prisma.usuario.findUnique({ where: { id: nueva.usuario.id }, include: { rol: true } });
    const resultado = await aplicarAccesos(conRol);
    expect(resultado.rol.nombre).toBe("Administrador");
    expect(resultado.modulos).toEqual(["salud"]);
  });

  test("el correo de SUPERADMIN_EMAIL entra como superadministrador aunque ya fuera personal", async () => {
    process.env.SUPERADMIN_EMAIL = " Alejandro.Martinez.S@uniautonoma.edu.co ";
    try {
      const { aplicarAccesos, serializarUsuario } = require("../src/modules/auth/auth.service");
      const persona = crearUsuario("Administrador", "alejandro.martinez.s@uniautonoma.edu.co");
      const conRol = await prisma.usuario.findUnique({ where: { id: persona.usuario.id }, include: { rol: true } });
      const resultado = await aplicarAccesos(conRol);
      expect(resultado.rol.nombre).toBe("SuperAdministrador");
      expect(serializarUsuario(resultado).modulos).toEqual(["desarrollo-humano", "salud", "deporte"]);
      const otro = crearUsuario("Administrador", "otra@uniautonoma.edu.co");
      const otroConRol = await prisma.usuario.findUnique({ where: { id: otro.usuario.id }, include: { rol: true } });
      expect((await aplicarAccesos(otroConRol)).rol.nombre).toBe("Administrador");
    } finally {
      delete process.env.SUPERADMIN_EMAIL;
    }
  });

  test("un administrador sin modulos asignados no entra a ningun panel", async () => {
    const sinNada = crearUsuario("Estudiante", "x@uniautonoma.edu.co");
    await prisma.usuario.update({ where: { id: sinNada.usuario.id }, data: { rolId: "rol-administrador" } });
    expect((await request(app).get("/api/v1/admin/estadisticas").set(auth(sinNada.token))).status).toBe(403);
    expect((await request(app).get("/api/v1/salud/resumen").set(auth(sinNada.token))).status).toBe(403);
  });

  test("el superadministrador entra a todos los modulos y ve el resumen", async () => {
    expect((await request(app).get("/api/v1/admin/estadisticas").set(auth(superadmin.token))).status).toBe(200);
    expect((await request(app).get("/api/v1/salud/resumen").set(auth(superadmin.token))).status).toBe(200);
    const me = await request(app).get("/api/v1/auth/me").set(auth(superadmin.token));
    expect(me.body.usuario.modulos).toEqual(["desarrollo-humano", "salud", "deporte"]);
    const res = await api("get", "/resumen");
    expect(res.status).toBe(200);
    expect(res.body.modulos.map((m) => m.id)).toEqual(["desarrollo-humano", "salud", "deporte"]);
  });
});

describe("Mis citas separadas por modulo", () => {
  test("cada modulo muestra solo sus citas", async () => {
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const servicioSalud = prisma.__seedServicio({ nombre: "Consulta de enfermería", modulo: "salud" });
    const hDh = prisma.__seedHorario({ fecha: diasDesdeHoy(3), horaInicio: new Date(Date.UTC(1970, 0, 1, 8)), horaFin: new Date(Date.UTC(1970, 0, 1, 9)) });
    const hSalud = prisma.__seedHorario({ servicioId: servicioSalud.id, fecha: diasDesdeHoy(3), horaInicio: new Date(Date.UTC(1970, 0, 1, 10)), horaFin: new Date(Date.UTC(1970, 0, 1, 11)) });
    await request(app).post("/api/v1/citas").set(auth(est.token)).send({ horarioId: hDh.id });
    await request(app).post("/api/v1/citas").set(auth(est.token)).send({ horarioId: hSalud.id });

    const dh = await request(app).get("/api/v1/citas/mias?modulo=desarrollo-humano").set(auth(est.token));
    expect(dh.body.citas.map((c) => c.horarioId)).toEqual([hDh.id]);
    const sal = await request(app).get("/api/v1/citas/mias?modulo=salud").set(auth(est.token));
    expect(sal.body.citas.map((c) => c.horarioId)).toEqual([hSalud.id]);
  });
});
