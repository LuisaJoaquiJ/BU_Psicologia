// Lo que pedia el tablero de Arte y Cultura y faltaba en el modulo:
// el oficio de invitacion de cada delegacion, el inventario con prestamos
// (vestuario, instrumentos) y los pendientes de logistica (gestionar el bus,
// entregar el SNIES).
const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-cultura-"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

const dia = (n) => {
  const b = hoyBogota();
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + n)).toISOString().slice(0, 10);
};

describe("Logística de Arte y Cultura", () => {
  let personal;
  let monitor;
  let ana;

  beforeEach(async () => {
    prisma.__reset();
    personal = crearUsuario("Administrador", "cultura.log@uniautonoma.edu.co", "Coordinación");
    monitor = crearUsuario("Administrador", "monitor.log@uniautonoma.edu.co", "Monitor");
    ana = crearUsuario("Estudiante", "ana.log@uniautonoma.edu.co", "Ana Log");
    prisma.__darAcceso("cultura.log@uniautonoma.edu.co", "cultura");
    prisma.__darAcceso("monitor.log@uniautonoma.edu.co", "cultura");
    await prisma.rolOperativoCultural.create({ data: { email: "monitor.log@uniautonoma.edu.co", rol: "monitor" } });
  });

  const adm = (metodo, ruta, token = personal.token) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(token));

  test("el oficio de invitación queda adjunto a la delegación", async () => {
    const red = await adm("post", "/representaciones").send({ red: "ASIES", nombre: "Global Fest", fecha: dia(3), participantes: [ana.usuario.emailInstitucional] });
    expect(red.status).toBe(201);
    const subida = await adm("post", "/evidencias")
      .field("representacionId", red.body.id)
      .field("tipo", "oficio")
      .attach("evidencia", Buffer.from("%PDF-1.4 oficio"), { filename: "oficio-global-fest.pdf", contentType: "application/pdf" });
    expect(subida.status).toBe(201);
    expect(subida.body.tipo).toBe("oficio");

    const lista = await adm("get", "/representaciones");
    expect(lista.body[0].documentos).toEqual([expect.objectContaining({ tipo: "oficio", nombreOriginal: "oficio-global-fest.pdf" })]);
    const archivo = await adm("get", `/evidencias/${subida.body.id}/archivo`);
    expect(archivo.status).toBe(200);
  });

  test("el inventario descuenta lo prestado y lo dañado al devolver", async () => {
    const vestido = await adm("post", "/inventario").send({ nombre: "Vestido de cumbia", categoria: "vestuario", cantidadTotal: 10, ubicacion: "Bodega 2" });
    expect(vestido.status).toBe(201);

    const prestamo = await adm("post", `/inventario/${vestido.body.id}/prestamos`).send({ cantidad: 8, responsable: "Grupo de danzas", motivo: "Global Fest", fechaDevolucionEsperada: dia(2) });
    expect(prestamo.status).toBe(201);
    const demasiado = await adm("post", `/inventario/${vestido.body.id}/prestamos`).send({ cantidad: 3, responsable: "Otra persona", fechaDevolucionEsperada: dia(2) });
    expect(demasiado.status).toBe(409);

    let lista = await adm("get", "/inventario");
    expect(lista.body[0]).toMatchObject({ prestados: 8, disponibles: 2 });

    const devuelto = await adm("post", `/prestamos/${prestamo.body.id}/devolucion`).send({ devueltosDanados: 1 });
    expect(devuelto.status).toBe(200);
    expect(devuelto.body).toMatchObject({ prestados: 0, cantidadDanada: 1, disponibles: 9 });
    expect((await adm("post", `/prestamos/${prestamo.body.id}/devolucion`).send({})).status).toBe(409);
  });

  test("un monitor presta, pero no crea artículos", async () => {
    const guitarra = await adm("post", "/inventario").send({ nombre: "Guitarra acústica", categoria: "instrumento", cantidadTotal: 4 });
    expect((await adm("post", "/inventario", monitor.token).send({ nombre: "Piano", categoria: "instrumento" })).status).toBe(403);
    const r = await adm("post", `/inventario/${guitarra.body.id}/prestamos`, monitor.token).send({ responsable: "Taller de guitarra", fechaDevolucionEsperada: dia(0) });
    expect(r.status).toBe(201);
  });

  test("los pendientes muestran cuáles vencieron y se marcan como hechos", async () => {
    const evento = await adm("post", "/agenda").send({ nombre: "Teatro en Timbío", fecha: dia(4), fechaLimite: dia(4), horaInicio: "08:00", horaFin: "12:00", cupo: 20, estado: "Publicado" });
    const bus = await adm("post", "/pendientes").send({ titulo: "Gestionar bus", categoria: "logistica", fechaLimite: dia(2), responsable: "Monitor", eventoId: evento.body.id });
    expect(bus.status).toBe(201);
    expect(bus.body).toMatchObject({ evento: "Teatro en Timbío", diasRestantes: 2, vencida: false });

    const snies = await adm("post", "/pendientes").send({ titulo: "Entregar SNIES", categoria: "informe", fechaLimite: dia(-1) });
    expect(snies.body.vencida).toBe(true);

    const hecha = await adm("patch", `/pendientes/${snies.body.id}`, monitor.token).send({ hecha: true });
    expect(hecha.status).toBe(200);
    expect(hecha.body).toMatchObject({ hecha: true, vencida: false });

    const lista = await adm("get", "/pendientes");
    expect(lista.body.map((t) => t.titulo)).toEqual(["Entregar SNIES", "Gestionar bus"]);
    expect((await adm("delete", `/pendientes/${bus.body.id}`, monitor.token)).status).toBe(403);
    expect((await adm("delete", `/pendientes/${bus.body.id}`)).status).toBe(200);
  });

  test("el estudiante no ve el inventario ni los pendientes", async () => {
    expect((await adm("get", "/inventario", ana.token)).status).toBe(403);
    expect((await adm("get", "/pendientes", ana.token)).status).toBe(403);
  });
});

describe("Roles del personal de Arte y Cultura", () => {
  let coordinadora;

  beforeEach(() => {
    prisma.__reset();
    coordinadora = crearUsuario("Administrador", "coordina.rol@uniautonoma.edu.co", "Coordinadora");
    prisma.__darAcceso("coordina.rol@uniautonoma.edu.co", "cultura");
  });

  const adm = (metodo, ruta, token = coordinadora.token) => request(app)[metodo](`/api/v1/cultura/admin${ruta}`).set(auth(token));

  test("el panel sabe el rol de quien entra", async () => {
    const r = await adm("get", "/mi-rol");
    expect(r.body).toEqual({ rol: "administrador" });
  });

  test("la última administradora no puede quitarse el rol", async () => {
    const r = await adm("put", "/equipo").send({ email: "coordina.rol@uniautonoma.edu.co", rol: "docente" });
    expect(r.status).toBe(409);
    expect((await adm("get", "/representaciones")).status).toBe(200);

    prisma.__darAcceso("otra.coord@uniautonoma.edu.co", "cultura");
    expect((await adm("put", "/equipo").send({ email: "coordina.rol@uniautonoma.edu.co", rol: "docente" })).status).toBe(200);
    expect((await adm("get", "/mi-rol")).body.rol).toBe("docente");
  });
});
