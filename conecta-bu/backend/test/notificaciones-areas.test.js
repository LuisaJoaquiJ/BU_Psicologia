// Privacidad del centro de notificaciones: las alertas de crisis solo las ve el
// personal ACTUAL de Desarrollo Humano, y cada area ve solo sus avisos. Al cambiar
// de area, lo del area anterior deja de verse (sin borrar nada).
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const servicio = require("../src/modules/notificaciones/service");
const { dispararAlertaCrisis } = require("../src/modules/desarrollo-humano/utils/asistenteCrisis");

const api = (metodo, ruta, quien) => request(app)[metodo](`/api/v1${ruta}`).set(auth(quien.token));
const titulos = async (quien, q = "") => (await api("get", `/notificaciones${q}`, quien)).body.items.map((n) => n.titulo);
const noLeidas = async (quien) => (await api("get", "/notificaciones/resumen", quien)).body.noLeidas;

// Personal con las areas indicadas (accesos por correo).
function personal(email, modulos, nombre = "Personal") {
  const usuario = prisma.__seedUsuario({ emailInstitucional: email, nombre, rolId: "rol-administrador", modulos });
  const { signToken } = require("../src/common/utils/jwt");
  return { usuario, token: signToken({ sub: usuario.id, rol: "Administrador" }) };
}
// Guarda una notificacion tal cual (como las que ya estan en la base).
const guardar = (quien, datos) => prisma.notificacion.create({ data: { usuarioId: quien.usuario.id, modulo: "general", tipo: "general", mensaje: "x", ruta: null, ...datos } });
const ALERTA = { modulo: "desarrollo-humano", tipo: "alerta-crisis", titulo: "🚨 ALERTA ROJA: POSIBLE RIESGO VITAL 🚨", mensaje: "Estudiante: Ana" };
const ALERTA_VIEJA = { modulo: "desarrollo-humano", tipo: "alerta-crisis", titulo: "Alerta de posible crisis emocional", mensaje: "Ana" };

beforeEach(() => {
  prisma.__reset();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("{}"), json: () => Promise.resolve({}) }));
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("Alertas de crisis: solo Desarrollo Humano", () => {
  test("la alerta del asistente llega solo al personal de Desarrollo Humano", async () => {
    const psico = personal("psico.crisis@uniautonoma.edu.co", ["desarrollo-humano"]);
    const enfermera = personal("enfermera.crisis@uniautonoma.edu.co", ["salud"]);
    const deporte = personal("deporte.crisis@uniautonoma.edu.co", ["deporte"]);
    const superadmin = crearUsuario("SuperAdministrador", "super.crisis@uniautonoma.edu.co");
    const ana = crearUsuario("Estudiante", "ana.crisis@uniautonoma.edu.co", "Ana Riesgo");

    expect((await dispararAlertaCrisis(ana.usuario, "Ideación suicida")).enviada).toBe(true);
    const guardadas = await prisma.notificacion.findMany({ where: { tipo: "alerta-crisis" } });
    expect(guardadas.map((n) => n.usuarioId)).toEqual([psico.usuario.id]);
    expect(await titulos(psico)).toContain("🚨 ALERTA ROJA: POSIBLE RIESGO VITAL 🚨");
    for (const otro of [enfermera, deporte, superadmin, ana]) {
      expect(await titulos(otro)).toHaveLength(0);
      expect(await noLeidas(otro)).toBe(0);
    }
  });

  test("no se puede guardar una alerta de crisis para alguien que no es de Desarrollo Humano", async () => {
    const enfermera = personal("enfermera.guarda@uniautonoma.edu.co", ["salud"]);
    const ana = crearUsuario("Estudiante", "ana.guarda@uniautonoma.edu.co");
    const superadmin = crearUsuario("SuperAdministrador", "super.guarda@uniautonoma.edu.co");
    for (const quien of [enfermera, ana, superadmin]) expect(await servicio.crear(quien.usuario.id, ALERTA)).toBeNull();
    expect(await servicio.avisarAlPersonal("salud", { ...ALERTA, modulo: "salud" })).toBe(0);
    expect(await servicio.avisarAlPersonal("salud", ALERTA)).toBe(0);
    expect(await prisma.notificacion.findMany({ where: { tipo: "alerta-crisis" } })).toHaveLength(0);
    // Con el modulo equivocado tampoco, aunque sea personal de DH.
    const psico = personal("psico.guarda@uniautonoma.edu.co", ["desarrollo-humano"]);
    expect(await servicio.crear(psico.usuario.id, { ...ALERTA, modulo: "salud" })).toBeNull();
    expect(await servicio.crear(psico.usuario.id, ALERTA)).not.toBeNull();
  });

  test("quien pasa de Desarrollo Humano a Salud deja de ver las alertas (nuevas y viejas) por cualquier endpoint", async () => {
    const superadmin = crearUsuario("SuperAdministrador", "super.cambio@uniautonoma.edu.co");
    const luisa = personal("luisa.cambio@uniautonoma.edu.co", ["desarrollo-humano"], "Luisa");
    const roja = await guardar(luisa, ALERTA);
    const vieja = await guardar(luisa, ALERTA_VIEJA);
    await guardar(luisa, { modulo: "desarrollo-humano", tipo: "cita-nueva", titulo: "Nueva cita agendada", ruta: "/admin/citas" });
    expect(await noLeidas(luisa)).toBe(3);

    const acceso = (await prisma.accesoModulo.findMany({ where: { email: "luisa.cambio@uniautonoma.edu.co" } }))[0];
    const res = await request(app).patch(`/api/v1/super/accesos/${acceso.id}`).set(auth(superadmin.token)).send({ modulo: "salud" });
    expect(res.status).toBe(200);
    await guardar(luisa, { modulo: "salud", tipo: "cita-nueva", titulo: "Nueva cita de salud", ruta: "/salud/citas" });

    // Solo "Cambió tu acceso" y lo de Salud; nada de Orientación ni de crisis.
    expect((await titulos(luisa)).sort()).toEqual(["Cambió tu acceso", "Nueva cita de salud"]);
    expect(await noLeidas(luisa)).toBe(2);
    expect((await api("get", "/notificaciones", luisa)).body).toMatchObject({ total: 2, noLeidas: 2 });
    for (const n of [roja, vieja]) {
      expect((await api("patch", `/notificaciones/${n.id}/leida`, luisa)).status).toBe(404);
      expect((await api("delete", `/notificaciones/${n.id}`, luisa)).status).toBe(404);
    }
    expect((await api("post", "/notificaciones/leer-todas", luisa)).body.marcadas).toBe(2);
    expect((await prisma.notificacion.findUnique({ where: { id: roja.id } })).leida).toBe(false); // no se tocó

    // Si vuelve a Desarrollo Humano, las vuelve a ver (nada se borró).
    await request(app).patch(`/api/v1/super/accesos/${acceso.id}`).set(auth(superadmin.token)).send({ modulo: "desarrollo-humano" });
    expect(await titulos(luisa)).toEqual(expect.arrayContaining([ALERTA.titulo, ALERTA_VIEJA.titulo, "Nueva cita agendada"]));
    expect(await titulos(luisa)).not.toContain("Nueva cita de salud");
  });

  test("el superadministrador no ve alertas de crisis aunque estén guardadas a su nombre", async () => {
    const superadmin = crearUsuario("SuperAdministrador", "super.ve@uniautonoma.edu.co");
    await guardar(superadmin, ALERTA);
    await guardar(superadmin, { modulo: "salud", tipo: "informe", titulo: "Informe para revisar", ruta: "/super/informes" });
    expect(await titulos(superadmin)).toEqual(["Informe para revisar"]);
    expect(await noLeidas(superadmin)).toBe(1);
  });
});

describe("Cada área ve sus propias notificaciones", () => {
  test("Salud, Deporte, Cultura y Desarrollo Humano ven solo las de su área y las personales", async () => {
    const dh = personal("dh.area@uniautonoma.edu.co", ["desarrollo-humano"]);
    const salud = personal("salud.area@uniautonoma.edu.co", ["salud"]);
    const deporte = personal("deporte.area@uniautonoma.edu.co", ["deporte"]);
    const docente = personal("docente.area@uniautonoma.edu.co", ["deporte-docente"]);
    const cultura = personal("cultura.area@uniautonoma.edu.co", ["cultura"]);
    const modulos = ["desarrollo-humano", "salud", "deporte", "cultura"];
    for (const quien of [dh, salud, deporte, docente, cultura]) {
      for (const m of modulos) await guardar(quien, { modulo: m, tipo: "inscripcion", titulo: `Aviso de ${m}` });
      await guardar(quien, { modulo: "cultura", tipo: "acceso", titulo: "Cambió tu acceso" });
    }
    expect((await titulos(dh)).sort()).toEqual(["Aviso de desarrollo-humano", "Cambió tu acceso"]);
    expect((await titulos(salud)).sort()).toEqual(["Aviso de salud", "Cambió tu acceso"]);
    expect((await titulos(deporte)).sort()).toEqual(["Aviso de deporte", "Cambió tu acceso"]);
    expect((await titulos(docente)).sort()).toEqual(["Aviso de deporte", "Cambió tu acceso"]);
    expect((await titulos(cultura)).sort()).toEqual(["Aviso de cultura", "Cambió tu acceso"]);
    expect(await noLeidas(salud)).toBe(2);
  });

  test("quien tiene dos áreas ve las de ambas", async () => {
    const doble = personal("doble.area@uniautonoma.edu.co", ["salud", "cultura"]);
    for (const m of ["desarrollo-humano", "salud", "cultura"]) await guardar(doble, { modulo: m, tipo: "inscripcion", titulo: m });
    await guardar(doble, ALERTA);
    expect((await titulos(doble)).sort()).toEqual(["cultura", "salud"]);
  });

  test("un estudiante ve sus avisos de todas las dimensiones, pero no los que recibió cuando era personal", async () => {
    const ana = crearUsuario("Estudiante", "ana.area@uniautonoma.edu.co", "Ana");
    await guardar(ana, { modulo: "salud", tipo: "cita", titulo: "Cita agendada", ruta: "/mi-salud/mis-citas" });
    await guardar(ana, { modulo: "desarrollo-humano", tipo: "inscripcion", titulo: "Inscripción confirmada", ruta: "/estudiante/eventos" });
    await guardar(ana, { modulo: "cultura", tipo: "audicion", titulo: "Audición", ruta: "/mi-cultura/convocatorias" });
    await guardar(ana, { modulo: "deporte", tipo: "evento-publicado", titulo: "Nuevo evento deportivo", ruta: "/mi-deporte/eventos" });
    await guardar(ana, { modulo: "general", tipo: "general", titulo: "Aviso general" });
    // De cuando era personal:
    await guardar(ana, { modulo: "desarrollo-humano", tipo: "cita-nueva", titulo: "Nueva cita agendada", ruta: "/admin/citas" });
    await guardar(ana, { modulo: "salud", tipo: "inscripcion", titulo: "Nueva inscripción a una jornada", ruta: "/salud/actividades" });
    await guardar(ana, ALERTA);
    await guardar(ana, { modulo: "salud", tipo: "acceso", titulo: "Te quitaron un acceso", ruta: "/" });
    expect((await titulos(ana)).sort()).toEqual(["Audición", "Aviso general", "Cita agendada", "Inscripción confirmada", "Nuevo evento deportivo", "Te quitaron un acceso"]);
    expect(await noLeidas(ana)).toBe(6);
  });

  test("las notificaciones que llegan por automatización siguen yendo al área correcta", async () => {
    const dh = personal("dh.auto@uniautonoma.edu.co", ["desarrollo-humano"]);
    const salud = personal("salud.auto@uniautonoma.edu.co", ["salud"]);
    await servicio.avisarAlPersonal("salud", { modulo: "salud", tipo: "cita-nueva", titulo: "Nueva cita agendada", mensaje: "x", ruta: "/salud/citas" });
    await servicio.avisarAlPersonal("desarrollo-humano", { modulo: "desarrollo-humano", tipo: "cita-nueva", titulo: "Nueva cita de orientación", mensaje: "x", ruta: "/admin/citas" });
    expect(await titulos(salud)).toEqual(["Nueva cita agendada"]);
    expect(await titulos(dh)).toEqual(["Nueva cita de orientación"]);
  });
});
