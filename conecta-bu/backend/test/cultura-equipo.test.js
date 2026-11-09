// Equipo de Arte y Cultura: el administrador del area gestiona a su equipo y cada rol
// solo puede lo que le toca (el docente y el monitor, solo en los grupos a su cargo).
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

describe("Equipo de Arte y Cultura", () => {
  let coord;
  let docA;
  let docB;
  let mon;
  let ana;
  let grupoA;
  let grupoB;

  const adm = (metodo, ruta, quien = coord) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(quien.token));
  const correo = (u) => u.usuario?.emailInstitucional || u.email;

  beforeEach(async () => {
    prisma.__reset();
    const personas = [
      ["coord", "coord.equipo@uniautonoma.edu.co", "Coordinación"],
      ["docA", "doc.a@uniautonoma.edu.co", "Docente A"],
      ["docB", "doc.b@uniautonoma.edu.co", "Docente B"],
      ["mon", "monitor@uniautonoma.edu.co", "Monitor Uno"],
    ];
    const creadas = {};
    for (const [clave, email, nombre] of personas) {
      creadas[clave] = crearUsuario("Administrador", email, nombre);
      prisma.__darAcceso(email, "cultura");
    }
    ({ coord, docA, docB, mon } = creadas);
    ana = crearUsuario("Estudiante", "ana.equipo@uniautonoma.edu.co", "Ana Equipo");
    // Primero la coordinacion, que queda como administradora; luego los demas roles.
    await adm("put", "/equipo").send({ email: "coord.equipo@uniautonoma.edu.co", rol: "administrador" });
    await adm("put", "/equipo").send({ email: "doc.a@uniautonoma.edu.co", rol: "docente" });
    await adm("put", "/equipo").send({ email: "doc.b@uniautonoma.edu.co", rol: "docente" });
    await adm("put", "/equipo").send({ email: "monitor@uniautonoma.edu.co", rol: "monitor" });
    const area = await prisma.areaCultural.create({ data: { nombre: "Guitarra", categoria: "taller" } });
    const crear = async (nombre, dia) => (await adm("post", "/grupos").send({ areaId: area.id, nombre, cupo: 10, horario: [{ dia, inicio: "14:00", fin: "16:00" }] })).body;
    grupoA = await crear("Taller A", 2);
    grupoB = await crear("Taller B", 3);
    await adm("put", `/grupos/${grupoA.id}/responsables`).send({ docenteEmail: "doc.a@uniautonoma.edu.co", monitoresEmails: ["monitor@uniautonoma.edu.co"] });
    await adm("put", `/grupos/${grupoB.id}/responsables`).send({ docenteEmail: "doc.b@uniautonoma.edu.co", monitoresEmails: [] });
  });

  test("quien entra sin rol queda como monitor cuando ya hay un administrador", async () => {
    const nueva = crearUsuario("Administrador", "sinrol@uniautonoma.edu.co", "Sin Rol");
    prisma.__darAcceso("sinrol@uniautonoma.edu.co", "cultura");
    expect((await adm("get", "/mi-rol", nueva)).body.rol).toBe("monitor");
    expect((await adm("get", "/mi-rol", coord)).body.rol).toBe("administrador");
  });

  test("el administrador agrega personas a su equipo y las quita", async () => {
    const dominioMalo = await adm("post", "/equipo").send({ email: "alguien@gmail.com", rol: "monitor" });
    expect(dominioMalo.status).toBe(400);
    const nueva = await adm("post", "/equipo").send({ email: "Nueva.Docente@uniautonoma.edu.co", rol: "docente" });
    expect(nueva.status).toBe(201);
    expect(nueva.body).toMatchObject({ email: "nueva.docente@uniautonoma.edu.co", rol: "docente" });
    expect((await adm("post", "/equipo").send({ email: "nueva.docente@uniautonoma.edu.co", rol: "monitor" })).status).toBe(409);
    const equipo = (await adm("get", "/equipo")).body;
    expect(equipo.find((m) => m.email === "nueva.docente@uniautonoma.edu.co")).toMatchObject({ rol: "docente", grupos: [] });

    expect((await adm("delete", "/equipo/nueva.docente@uniautonoma.edu.co")).status).toBe(200);
    expect((await adm("get", "/equipo")).body.some((m) => m.email === "nueva.docente@uniautonoma.edu.co")).toBe(false);
    expect((await adm("delete", "/equipo/coord.equipo@uniautonoma.edu.co")).status).toBe(409); // nadie se quita a si mismo
  });

  test("solo la coordinación gestiona el equipo", async () => {
    expect((await adm("get", "/equipo", docA)).status).toBe(403);
    expect((await adm("post", "/equipo", mon).send({ email: "otra@uniautonoma.edu.co", rol: "monitor" })).status).toBe(403);
    expect((await adm("delete", "/equipo/monitor@uniautonoma.edu.co", docA)).status).toBe(403);
    expect((await adm("put", `/grupos/${grupoA.id}/responsables`, docA).send({ docenteEmail: null, monitoresEmails: [] })).status).toBe(403);
  });

  test("los responsables de un grupo se eligen entre el equipo y nunca queda sin nadie", async () => {
    const put = (cuerpo) => adm("put", `/grupos/${grupoA.id}/responsables`).send(cuerpo);
    expect((await put({ docenteEmail: "monitor@uniautonoma.edu.co", monitoresEmails: [] })).status).toBe(400); // un monitor no dirige
    expect((await put({ docenteEmail: null, monitoresEmails: ["ajeno@uniautonoma.edu.co"] })).status).toBe(400); // ajeno al equipo
    const vacio = await put({ docenteEmail: null, monitoresEmails: [] });
    expect(vacio.status).toBe(400);
    expect(vacio.body.message).toBe("Debe haber al menos una persona a cargo del grupo.");
    expect((await put({ docenteEmail: "doc.a@uniautonoma.edu.co", monitoresEmails: ["doc.b@uniautonoma.edu.co", "monitor@uniautonoma.edu.co"] })).status).toBe(200); // un docente también puede ayudar
  });

  test("un grupo nuevo queda a cargo de quien lo crea si no se indica a nadie", async () => {
    const area = await prisma.areaCultural.create({ data: { nombre: "Piano", categoria: "taller" } });
    const crear = (extra = {}) => adm("post", "/grupos").send({ areaId: area.id, nombre: "Taller nuevo", cupo: 10, horario: [{ dia: 4, inicio: "14:00", fin: "16:00" }], ...extra });
    const sinIndicar = await crear();
    expect(sinIndicar.status).toBe(201);
    expect(sinIndicar.body.docenteEmail).toBe("coord.equipo@uniautonoma.edu.co");
    const conEquipo = await crear({ nombre: "Con equipo", docenteEmail: "doc.a@uniautonoma.edu.co", monitoresEmails: ["monitor@uniautonoma.edu.co"] });
    expect(conEquipo.body).toMatchObject({ docenteEmail: "doc.a@uniautonoma.edu.co", monitoresEmails: ["monitor@uniautonoma.edu.co"] });
    const antes = (await adm("get", "/grupos")).body.length;
    expect((await crear({ nombre: "Mal equipo", docenteEmail: "monitor@uniautonoma.edu.co" })).status).toBe(400);
    expect((await adm("get", "/grupos")).body).toHaveLength(antes); // no queda creado
  });

  test("las personas a cargo de un evento son opcionales; las indicadas lo operan", async () => {
    const fecha = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const crear = (extra = {}) => adm("post", "/agenda").send({ nombre: "Muestra", fecha, fechaLimite: fecha, horaInicio: "08:00", horaFin: "12:00", cupo: 30, estado: "Publicado", ...extra });
    const porDefecto = await crear();
    expect(porDefecto.status).toBe(201);
    expect(porDefecto.body.responsablesEmails).toEqual([]); // sin nadie: lo maneja la coordinación

    const delMonitor = (await crear({ responsablesEmails: ["monitor@uniautonoma.edu.co"] })).body;
    expect((await adm("get", "/agenda", mon)).body.find((e) => e.id === delMonitor.id).puedeOperar).toBe(true);
    expect((await adm("get", "/agenda", docB)).body.find((e) => e.id === delMonitor.id).puedeOperar).toBe(false);
    const conteo = { conteoEstudiantes: 2 };
    expect((await adm("put", `/agenda/${delMonitor.id}/conteos`, mon).send(conteo)).status).toBe(200);
    expect((await adm("put", `/agenda/${delMonitor.id}/conteos`, docB).send(conteo)).status).toBe(403);

    expect((await crear({ responsablesEmails: ["ajeno@uniautonoma.edu.co"] })).status).toBe(400);
    const sinNadie = await adm("put", `/agenda/${delMonitor.id}/responsables`).send({ responsablesEmails: [] });
    expect(sinNadie.status).toBe(200);
    expect((await adm("put", `/agenda/${delMonitor.id}/conteos`, mon).send(conteo)).status).toBe(403); // ya no está a su cargo
    expect((await adm("put", `/agenda/${delMonitor.id}/responsables`).send({ responsablesEmails: ["doc.b@uniautonoma.edu.co"] })).status).toBe(200);
    expect((await adm("put", `/agenda/${delMonitor.id}/conteos`, docB).send(conteo)).status).toBe(200);
  });

  test("al quitar a una persona también sale de los grupos a su cargo", async () => {
    await adm("delete", "/equipo/doc.a@uniautonoma.edu.co");
    const grupos = (await adm("get", "/grupos")).body;
    expect(grupos.find((g) => g.id === grupoA.id).docenteEmail).toBe(null);
  });

  test("docente y monitor no crean ni editan grupos, eventos ni convocatorias", async () => {
    const fecha = "2099-01-01";
    for (const quien of [docA, mon]) {
      expect((await adm("post", "/grupos", quien).send({ nombre: "X" })).status).toBe(403);
      expect((await adm("post", "/agenda", quien).send({ nombre: "X", fecha })).status).toBe(403);
      expect((await adm("post", "/convocatorias", quien).send({ titulo: "X", cierra: fecha })).status).toBe(403);
      expect((await adm("get", "/informe", quien)).status).toBe(403);
    }
  });

  test("cada quien ve y opera solo los grupos a su cargo", async () => {
    expect((await adm("get", "/grupos", docA)).body.map((g) => g.id)).toEqual([grupoA.id]);
    expect((await adm("get", "/grupos", mon)).body.map((g) => g.id)).toEqual([grupoA.id]);
    expect((await adm("get", "/grupos", coord)).body).toHaveLength(2);

    const sitio = { latitud: 2.4448, longitud: -76.6147, radioM: 100 };
    expect((await adm("put", `/grupos/${grupoA.id}/ubicacion`, docA).send(sitio)).status).toBe(200);
    expect((await adm("put", `/grupos/${grupoB.id}/ubicacion`, docA).send(sitio)).status).toBe(403); // no es su grupo
    expect((await adm("put", `/grupos/${grupoA.id}/ubicacion`, mon).send(sitio)).status).toBe(403); // el monitor no fija el sitio

    const conteo = { fecha: "2026-01-05", conteoEstudiantes: 3 };
    expect((await adm("put", `/grupos/${grupoA.id}/conteos`, mon).send(conteo)).status).toBe(200);
    expect((await adm("put", `/grupos/${grupoB.id}/conteos`, mon).send(conteo)).status).toBe(403);
  });

  test("quien dirige el grupo decide la audición; otros docentes y monitores no", async () => {
    const cierra = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const conv = await adm("post", "/convocatorias").send({ titulo: "Audiciones A", cierra, grupoId: grupoA.id });
    expect(conv.status).toBe(201);
    await request(app).post(`/api/v1/cultura/convocatorias/${conv.body.id}/postulacion`).set(auth(ana.token)).send({ motivacion: "Toco guitarra hace años." });
    const lista = (await adm("get", "/convocatorias", docA)).body;
    expect(lista[0]).toMatchObject({ puedeDecidir: true });
    expect((await adm("get", "/convocatorias", docB)).body[0].puedeDecidir).toBe(false);
    const id = lista[0].postulaciones[0].id;
    const cita = { fecha: cierra, hora: "10:00", lugar: "Auditorio" };
    expect((await adm("patch", `/postulaciones/${id}/audicion`, docB).send(cita)).status).toBe(403);
    expect((await adm("patch", `/postulaciones/${id}/audicion`, mon).send(cita)).status).toBe(403);
    expect((await adm("patch", `/postulaciones/${id}/audicion`, docA).send(cita)).status).toBe(200);
  });
});
