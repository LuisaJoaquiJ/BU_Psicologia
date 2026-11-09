// Centro de notificaciones: cada persona ve solo las suyas, y los avisos salen donde ya
// salen los correos y en las audiciones y el equipo de Cultura.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ N8N_WEBHOOK_URL: "http://n8n.test/webhook/conecta-bu" });
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const servicio = require("../src/modules/notificaciones/service");
const automatizaciones = require("../src/integrations/automatizaciones");

const esperar = () => new Promise((resolve) => setImmediate(resolve));
const api = (metodo, ruta, quien) => request(app)[metodo](`/api/v1${ruta}`).set(auth(quien.token));

beforeEach(() => {
  prisma.__reset();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("{}"), json: () => Promise.resolve({}) }));
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("Centro de notificaciones (API)", () => {
  test("requiere sesión", async () => {
    expect((await request(app).get("/api/v1/notificaciones")).status).toBe(401);
  });

  test("cada persona ve solo las suyas, la más reciente primero, y puede marcarlas y borrarlas", async () => {
    const ana = crearUsuario("Estudiante", "ana.notif@uniautonoma.edu.co", "Ana");
    const luis = crearUsuario("Estudiante", "luis.notif@uniautonoma.edu.co", "Luis");
    const primera = await servicio.crear(ana.usuario.id, { modulo: "salud", tipo: "cita", titulo: "Primera", mensaje: "Hola", ruta: "/mi-salud" });
    await prisma.notificacion.update({ where: { id: primera.id }, data: { fechaCreacion: new Date(Date.now() - 60000) } });
    await servicio.crear(ana.usuario.id, { modulo: "cultura", tipo: "audicion", titulo: "Segunda", mensaje: "Hola" });
    const deLuis = await servicio.crear(luis.usuario.id, { titulo: "De Luis", mensaje: "x" });

    const lista = (await api("get", "/notificaciones", ana)).body;
    expect(lista.items.map((n) => n.titulo)).toEqual(["Segunda", "Primera"]);
    expect(lista).toMatchObject({ total: 2, noLeidas: 2 });
    expect((await api("get", "/notificaciones/resumen", ana)).body).toEqual({ noLeidas: 2 });

    // No toca las de otra persona.
    expect((await api("patch", `/notificaciones/${deLuis.id}/leida`, ana)).status).toBe(404);
    expect((await api("delete", `/notificaciones/${deLuis.id}`, ana)).status).toBe(404);

    expect((await api("patch", `/notificaciones/${primera.id}/leida`, ana)).body.leida).toBe(true);
    expect((await api("get", "/notificaciones/resumen", ana)).body.noLeidas).toBe(1);
    expect((await api("get", "/notificaciones?soloNoLeidas=1", ana)).body.items.map((n) => n.titulo)).toEqual(["Segunda"]);
    expect((await api("post", "/notificaciones/leer-todas", ana)).body.marcadas).toBe(1);
    expect((await api("get", "/notificaciones/resumen", ana)).body.noLeidas).toBe(0);
    expect((await api("delete", `/notificaciones/${primera.id}`, ana)).status).toBe(200);
    expect((await api("get", "/notificaciones", ana)).body.total).toBe(1);
    expect((await api("get", "/notificaciones/resumen", luis)).body.noLeidas).toBe(1); // lo de Luis intacto
  });

  test("crear un aviso nunca falla aunque no haya a quién avisar", async () => {
    expect(await servicio.crear(null, { titulo: "x" })).toBeNull();
    expect(await servicio.crearPorCorreo("nadie@uniautonoma.edu.co", { titulo: "x", mensaje: "y" })).toBeNull();
  });
});

describe("Avisos que salen con los correos", () => {
  test("una salida rechazada avisa el motivo y una aprobada, la aprobación", async () => {
    const ana = crearUsuario("Estudiante", "ana.salida@uniautonoma.edu.co", "Ana");
    const salida = { id: "s1", nombre: "Salida a Silvia", destino: "Silvia", fechaSalida: new Date() };
    automatizaciones.salidaRevisada({ estado: "Rechazada", usuarioId: ana.usuario.id, nombre: "Ana", correo: ana.usuario.emailInstitucional, observacion: "Falta el permiso firmado." }, salida);
    automatizaciones.salidaRevisada({ estado: "Aprobada", usuarioId: ana.usuario.id, nombre: "Ana", correo: ana.usuario.emailInstitucional }, salida);
    await esperar();
    const lista = (await api("get", "/notificaciones", ana)).body.items;
    expect(lista.map((n) => n.titulo).sort()).toEqual(["Salida aprobada", "Salida no aprobada"]);
    expect(lista.find((n) => n.titulo === "Salida no aprobada").mensaje).toContain("Falta el permiso firmado.");
    expect(lista[0]).toMatchObject({ modulo: "salud", ruta: "/mi-salud/salidas" });
  });

  test("una cita agendada avisa el servicio, el día y la hora, y lleva a Mis citas", async () => {
    const ana = crearUsuario("Estudiante", "ana.cita@uniautonoma.edu.co", "Ana");
    const cita = { id: "c1", estado: "Agendada", horario: { servicio: { nombre: "Psicología" }, fecha: new Date("2026-12-10T00:00:00.000Z"), horaInicio: new Date("1970-01-01T15:00:00.000Z"), horaFin: new Date("1970-01-01T16:00:00.000Z") } };
    automatizaciones.citaAgendada(ana.usuario, cita, "Orientación");
    automatizaciones.citaAgendada(ana.usuario, cita, "Salud Integral");
    await esperar();
    const lista = (await api("get", "/notificaciones", ana)).body.items;
    expect(lista).toHaveLength(2);
    const orientacion = lista.find((n) => n.modulo === "desarrollo-humano");
    expect(orientacion).toMatchObject({ titulo: "Cita agendada", ruta: "/estudiante/mis-citas" });
    expect(orientacion.mensaje).toContain("Psicología");
    expect(orientacion.mensaje).toContain("diciembre");
    expect(lista.find((n) => n.modulo === "salud").ruta).toBe("/mi-salud/mis-citas");
  });
});

describe("Avisos de Arte y Cultura", () => {
  let coord;
  let docente;
  let monitor;
  let ana;
  let grupo;
  const adm = (metodo, ruta, quien = coord) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(quien.token));
  const avisosDe = async (quien) => (await api("get", "/notificaciones", quien)).body.items;

  beforeEach(async () => {
    coord = crearUsuario("Administrador", "coord.notif@uniautonoma.edu.co", "Coordinación");
    docente = crearUsuario("Administrador", "docente.notif@uniautonoma.edu.co", "Docente Uno");
    monitor = crearUsuario("Administrador", "monitor.notif@uniautonoma.edu.co", "Monitor Uno");
    ana = crearUsuario("Estudiante", "ana.audicion.notif@uniautonoma.edu.co", "Ana Audición");
    for (const u of [coord, docente, monitor]) prisma.__darAcceso(u.usuario.emailInstitucional, "cultura");
    await adm("put", "/equipo").send({ email: coord.usuario.emailInstitucional, rol: "administrador" });
    await adm("put", "/equipo").send({ email: docente.usuario.emailInstitucional, rol: "docente" });
    await adm("put", "/equipo").send({ email: monitor.usuario.emailInstitucional, rol: "monitor" });
    const area = await prisma.areaCultural.create({ data: { nombre: "Uniautónoma Band", categoria: "representativo" } });
    grupo = (await adm("post", "/grupos").send({ areaId: area.id, nombre: "Banda", cupo: 10, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }] })).body;
  });

  test("al asignar y quitar a alguien de un grupo se le avisa; quien lo hace no se avisa a sí mismo", async () => {
    await adm("put", `/grupos/${grupo.id}/responsables`).send({ docenteEmail: docente.usuario.emailInstitucional, monitoresEmails: [monitor.usuario.emailInstitucional] });
    expect((await avisosDe(docente)).map((n) => n.mensaje)).toEqual(["Diriges Banda."]);
    expect((await avisosDe(monitor)).map((n) => n.mensaje)).toEqual(["Ayudas en Banda."]);
    expect(await avisosDe(coord)).toHaveLength(0);

    await adm("put", `/grupos/${grupo.id}/responsables`).send({ docenteEmail: docente.usuario.emailInstitucional, monitoresEmails: [] });
    expect((await avisosDe(monitor))[0]).toMatchObject({ titulo: "Cambió tu asignación", mensaje: "Ya no estás a cargo de Banda." });
  });

  test("una postulación avisa a quien dirige; la cita y la decisión, a la estudiante", async () => {
    await adm("put", `/grupos/${grupo.id}/responsables`).send({ docenteEmail: docente.usuario.emailInstitucional, monitoresEmails: [] });
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const conv = (await adm("post", "/convocatorias").send({ titulo: "Audiciones Banda", cierra, grupoId: grupo.id })).body;
    await request(app).post(`/api/v1/cultura/convocatorias/${conv.id}/postulacion`).set(auth(ana.token)).send({ motivacion: "Toco la batería desde hace años." });

    const aviso = (await avisosDe(docente)).find((n) => n.titulo === "Nueva postulación");
    expect(aviso).toMatchObject({ modulo: "cultura", ruta: "/cultura/convocatorias" });
    expect(aviso.mensaje).toBe("Ana Audición se postuló a Audiciones Banda.");

    const id = (await adm("get", "/convocatorias", docente)).body[0].postulaciones[0].id;
    const hoyBogota = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    await adm("patch", `/postulaciones/${id}/audicion`, docente).send({ fecha: hoyBogota, hora: "10:00", lugar: "Auditorio" });
    expect((await avisosDe(ana)).find((n) => n.titulo === "Te citaron a una audición").mensaje).toContain("a las 10:00 en Auditorio");
    await adm("patch", `/postulaciones/${id}`, docente).send({ estado: "Aceptada", observacion: "Muy bien." });
    const decision = (await avisosDe(ana)).find((n) => n.titulo === "¡Te aceptaron!");
    expect(decision.mensaje).toContain("Banda");
    expect(decision.mensaje).toContain("Muy bien.");
    expect(decision.ruta).toBe("/mi-cultura/convocatorias");
  });

  test("sin grupo, las postulaciones avisan a la coordinación", async () => {
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const conv = (await adm("post", "/convocatorias").send({ titulo: "Casting general", cierra })).body;
    await request(app).post(`/api/v1/cultura/convocatorias/${conv.id}/postulacion`).set(auth(ana.token)).send({ motivacion: "Me gusta actuar mucho." });
    expect((await avisosDe(coord)).some((n) => n.titulo === "Nueva postulación")).toBe(true);
    expect((await avisosDe(docente)).some((n) => n.titulo === "Nueva postulación")).toBe(false);
  });

  test("al agregar a alguien al equipo se le avisa", async () => {
    const nueva = crearUsuario("Estudiante", "nueva.notif@uniautonoma.edu.co", "Nueva Persona");
    await adm("post", "/equipo").send({ email: "nueva.notif@uniautonoma.edu.co", rol: "docente" });
    expect((await avisosDe(nueva))[0]).toMatchObject({ titulo: "Te agregaron al equipo de Arte y Cultura", ruta: "/cultura" });
    await adm("delete", "/equipo/nueva.notif@uniautonoma.edu.co");
    expect((await avisosDe(nueva)).some((n) => n.titulo === "Ya no estás en el equipo de Arte y Cultura")).toBe(true);
  });
});

describe("Avisos cuando se publica algo", () => {
  let coord;
  let ana;
  let beto;
  const adm = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(coord.token));
  const avisosDe = async (quien) => (await api("get", "/notificaciones", quien)).body.items;
  const fecha = () => new Date(Date.now() - 5 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10);
  const evento = (extra = {}) => ({ nombre: "Muestra de danza", fecha: fecha(), fechaLimite: fecha(), horaInicio: "10:00", horaFin: "12:00", cupo: 30, estado: "Publicado", lugar: "Auditorio", ...extra });

  beforeEach(() => {
    coord = crearUsuario("Administrador", "coord.publica@uniautonoma.edu.co", "Coordinación");
    prisma.__darAcceso("coord.publica@uniautonoma.edu.co", "cultura");
    ana = crearUsuario("Estudiante", "ana.publica@uniautonoma.edu.co", "Ana");
    beto = crearUsuario("Estudiante", "beto.publica@uniautonoma.edu.co", "Beto");
  });

  test("un evento de Cultura publicado avisa a todos los estudiantes; un borrador, no; y publicarlo después sí", async () => {
    expect((await adm("post", "/agenda").send(evento({ nombre: "Borrador", estado: "Borrador" }))).status).toBe(201);
    expect(await avisosDe(ana)).toHaveLength(0);

    const publicado = (await adm("post", "/agenda").send(evento())).body;
    for (const estudiante of [ana, beto]) {
      const [aviso] = await avisosDe(estudiante);
      expect(aviso).toMatchObject({ modulo: "cultura", titulo: "Nuevo evento en Arte y Cultura", ruta: "/mi-cultura/agenda" });
      expect(aviso.mensaje).toContain("Muestra de danza");
      expect(aviso.mensaje).toContain("Auditorio");
    }
    expect(await avisosDe(coord)).toHaveLength(0); // al personal no

    // Editar algo ya publicado no vuelve a avisar.
    await adm("patch", `/agenda/${publicado.id}`).send({ cupo: 40 });
    expect(await avisosDe(ana)).toHaveLength(1);

    // Un borrador que se publica, sí avisa.
    const borrador = (await adm("get", "/agenda")).body.find((e) => e.nombre === "Borrador");
    await adm("patch", `/agenda/${borrador.id}`).send({ estado: "Publicado" });
    expect((await avisosDe(ana)).map((n) => n.mensaje.split(":")[0]).sort()).toEqual(["Borrador", "Muestra de danza"]);
  });

  test("una convocatoria abierta y un taller nuevo avisan a los estudiantes", async () => {
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    await adm("post", "/convocatorias").send({ titulo: "Audiciones de teatro", cierra });
    const area = await prisma.areaCultural.create({ data: { nombre: "Piano", categoria: "taller" } });
    await adm("post", "/grupos").send({ areaId: area.id, nombre: "Taller de piano", cupo: 10, horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }] });
    const titulos = (await avisosDe(beto)).map((n) => n.titulo).sort();
    expect(titulos).toEqual(["Convocatoria abierta", "Nuevo taller disponible"]);
  });

  test("un evento de Orientación publicado avisa una sola vez, aunque se llame de nuevo", async () => {
    const evento = { id: "e1", nombre: "Taller de manejo del estrés", fecha: new Date("2026-12-01T00:00:00.000Z"), horaInicio: new Date("1970-01-01T14:00:00.000Z"), horaFin: new Date("1970-01-01T16:00:00.000Z"), lugar: "Sala 2", cupos: 20 };
    automatizaciones.eventoPublicado(evento);
    await esperar();
    await esperar();
    automatizaciones.eventoPublicado(evento);
    await esperar();
    await esperar();
    const avisos = await avisosDe(ana);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ modulo: "desarrollo-humano", titulo: "Nuevo taller o evento", ruta: "/estudiante/eventos" });
    expect(avisos[0].mensaje).toContain("Taller de manejo del estrés");
    expect(await avisosDe(coord)).toHaveLength(0);
  });
});

describe("Avisos al personal", () => {
  const { accesoService } = require("../src/modules/super/services/AccesoService");
  const avisosDe = async (quien) => (await api("get", "/notificaciones", quien)).body.items;
  const cita = { id: "c1", estado: "Agendada", horario: { servicio: { nombre: "Psicología" }, fecha: new Date("2026-12-10T00:00:00.000Z"), horaInicio: new Date("1970-01-01T15:00:00.000Z"), horaFin: new Date("1970-01-01T16:00:00.000Z") } };
  let ana;
  let orientacion;
  let salud;

  beforeEach(() => {
    ana = crearUsuario("Estudiante", "ana.personal@uniautonoma.edu.co", "Ana Pérez");
    orientacion = crearUsuario("Administrador", "psico.personal@uniautonoma.edu.co", "Psicóloga");
    salud = crearUsuario("Salud", "enfermera.personal@uniautonoma.edu.co", "Enfermera"); // solo Salud
    prisma.__darAcceso("psico.personal@uniautonoma.edu.co", "desarrollo-humano");
    prisma.__darAcceso("enfermera.personal@uniautonoma.edu.co", "salud");
  });

  test("una cita nueva avisa solo al personal de su dimensión", async () => {
    automatizaciones.citaAgendada(ana.usuario, cita, "Orientación");
    await esperar();
    await esperar();
    const aviso = (await avisosDe(orientacion)).find((n) => n.titulo === "Nueva cita agendada");
    expect(aviso).toMatchObject({ modulo: "desarrollo-humano", ruta: "/admin/citas" });
    expect(aviso.mensaje).toContain("Ana Pérez");
    expect(aviso.mensaje).toContain("Psicología");
    expect(aviso.mensaje).toMatch(/3:00 p. m.$/); // un solo punto al final
    expect(await avisosDe(salud)).toHaveLength(0);

    automatizaciones.citaAgendada(ana.usuario, cita, "Salud Integral");
    await esperar();
    await esperar();
    expect((await avisosDe(salud))[0]).toMatchObject({ titulo: "Nueva cita agendada", ruta: "/salud/citas" });
  });

  test("si la estudiante cancela se avisa al personal; si cancela el personal, no", async () => {
    automatizaciones.citaCancelada(ana.usuario, cita, undefined, { porPersonal: true });
    await esperar();
    await esperar();
    expect((await avisosDe(orientacion)).some((n) => n.titulo === "Una cita se canceló")).toBe(false);
    automatizaciones.citaCancelada(ana.usuario, cita);
    await esperar();
    await esperar();
    const aviso = (await avisosDe(orientacion)).find((n) => n.titulo === "Una cita se canceló");
    expect(aviso.mensaje).toContain("quedó libre");
  });

  test("una inscripción a salida avisa al personal de Salud", async () => {
    automatizaciones.salidaInscripcion(ana.usuario, { id: "s1", nombre: "Salida a Silvia", destino: "Silvia", fechaSalida: new Date() });
    await esperar();
    await esperar();
    expect((await avisosDe(salud))[0]).toMatchObject({ titulo: "Nueva solicitud de salida", ruta: "/salud/salidas-estudiantes" });
    expect((await avisosDe(orientacion)).some((n) => n.titulo === "Nueva solicitud de salida")).toBe(false);
  });

  test("quien recibe o pierde un acceso lo sabe", async () => {
    const nuevo = crearUsuario("Estudiante", "nuevo.acceso@uniautonoma.edu.co", "Nuevo Acceso");
    const acceso = await accesoService.asignar({ email: "nuevo.acceso@uniautonoma.edu.co", modulo: "deporte" }, "super@uniautonoma.edu.co");
    expect((await avisosDe(nuevo))[0]).toMatchObject({ titulo: "Te dieron acceso a un panel", modulo: "deporte", ruta: "/deporte" });
    await accesoService.quitar(acceso.id);
    expect((await avisosDe(nuevo)).some((n) => n.titulo === "Te quitaron un acceso")).toBe(true);
  });
});

describe("Lo que hace el estudiante le llega al personal", () => {
  const avisosDe = async (quien) => (await api("get", "/notificaciones", quien)).body.items;
  let coord;
  let docente;
  let otro;
  let ana;
  let grupo;
  const adm = (metodo, ruta, quien = coord) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(quien.token));
  const estudiante = (metodo, ruta) => request(app)[metodo](`/api/v1/cultura${ruta}`).set(auth(ana.token));

  beforeEach(async () => {
    coord = crearUsuario("Administrador", "coord.accion@uniautonoma.edu.co", "Coordinación");
    docente = crearUsuario("Administrador", "docente.accion@uniautonoma.edu.co", "Docente Guitarra");
    otro = crearUsuario("Administrador", "otro.accion@uniautonoma.edu.co", "Otro Docente");
    ana = crearUsuario("Estudiante", "ana.accion@uniautonoma.edu.co", "Ana Acción");
    for (const u of [coord, docente, otro]) prisma.__darAcceso(u.usuario.emailInstitucional, "cultura");
    await adm("put", "/equipo").send({ email: coord.usuario.emailInstitucional, rol: "administrador" });
    await adm("put", "/equipo").send({ email: docente.usuario.emailInstitucional, rol: "docente" });
    await adm("put", "/equipo").send({ email: otro.usuario.emailInstitucional, rol: "docente" });
    const area = await prisma.areaCultural.create({ data: { nombre: "Guitarra", categoria: "taller" } });
    grupo = (await adm("post", "/grupos").send({ areaId: area.id, nombre: "Taller de guitarra", cupo: 10, horario: [{ dia: 3, inicio: "14:00", fin: "16:00" }], docenteEmail: docente.usuario.emailInstitucional })).body;
  });

  test("inscribirse o retirarse de un grupo avisa a la coordinación y a quien lo dirige, no a otros", async () => {
    expect((await estudiante("post", `/grupos/${grupo.id}/inscripcion`).send({})).status).toBe(200);
    for (const quien of [coord, docente]) {
      const aviso = (await avisosDe(quien)).find((n) => n.titulo === "Nueva inscripción");
      expect(aviso).toMatchObject({ modulo: "cultura", ruta: "/cultura/grupos" });
      expect(aviso.mensaje).toBe("Ana Acción se inscribió en Taller de guitarra.");
    }
    expect((await avisosDe(otro)).some((n) => n.titulo === "Nueva inscripción")).toBe(false);
    expect((await avisosDe(ana)).some((n) => n.titulo === "Nueva inscripción")).toBe(false); // la estudiante no se avisa a sí misma

    await estudiante("delete", `/grupos/${grupo.id}/inscripcion`);
    expect((await avisosDe(coord)).find((n) => n.titulo === "Una inscripción se retiró").mensaje).toBe("Ana Acción se retiró de Taller de guitarra.");
  });

  test("inscribirse a un evento avisa a la coordinación y a quienes están a cargo del evento", async () => {
    const fecha = new Date(Date.now() - 5 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10);
    const evento = (await adm("post", "/agenda").send({ nombre: "Muestra", fecha, fechaLimite: fecha, horaInicio: "10:00", horaFin: "12:00", cupo: 30, estado: "Publicado", responsablesEmails: [otro.usuario.emailInstitucional] })).body;
    await estudiante("post", `/agenda/${evento.id}/inscripcion`).send({});
    expect((await avisosDe(coord)).find((n) => n.titulo === "Nueva inscripción a un evento").mensaje).toBe("Ana Acción se inscribió en Muestra.");
    expect((await avisosDe(otro)).some((n) => n.titulo === "Nueva inscripción a un evento")).toBe(true);
    expect((await avisosDe(docente)).some((n) => n.titulo === "Nueva inscripción a un evento")).toBe(false);
    await estudiante("delete", `/agenda/${evento.id}/inscripcion`);
    expect((await avisosDe(otro)).some((n) => n.titulo === "Una inscripción a un evento se canceló")).toBe(true);
  });

  test("las inscripciones de Orientación y de Salud avisan al personal de su dimensión", async () => {
    const psico = crearUsuario("Administrador", "psico.accion@uniautonoma.edu.co", "Psicóloga");
    const enfermera = crearUsuario("Salud", "enfermera.accion@uniautonoma.edu.co", "Enfermera");
    prisma.__darAcceso("psico.accion@uniautonoma.edu.co", "desarrollo-humano");
    prisma.__darAcceso("enfermera.accion@uniautonoma.edu.co", "salud");
    automatizaciones.inscripcionEvento(ana.usuario, { eventoId: "e1", evento: { id: "e1", nombre: "Taller de estudio", fecha: new Date("2026-12-01T00:00:00.000Z") } });
    automatizaciones.jornadaInscripcion(ana.usuario, { id: "j1", nombre: "Jornada de vacunación", fechaInicio: new Date("2026-12-02T00:00:00.000Z"), fechaFin: new Date("2026-12-02T00:00:00.000Z") });
    await esperar();
    await esperar();
    expect((await avisosDe(psico)).find((n) => n.titulo === "Nueva inscripción")).toMatchObject({ ruta: "/admin/eventos" });
    expect((await avisosDe(enfermera)).find((n) => n.titulo === "Nueva inscripción a una jornada").mensaje).toBe("Ana Acción se inscribió en Jornada de vacunación.");
    expect((await avisosDe(enfermera)).some((n) => n.titulo === "Nueva inscripción")).toBe(false);
  });
});
