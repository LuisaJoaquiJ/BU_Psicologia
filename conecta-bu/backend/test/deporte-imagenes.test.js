// Fotos de Deporte: la coordinacion las sube a eventos, disciplinas,
// implementos y comunicados; el docente, a los comunicados de sus grupos.
// Se sirven sin sesion (las usa <img>) y se reemplazan o quitan sin dejar
// archivos sueltos.

const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-deporte-"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");

// PNG de 1x1 pixel.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const enDias = (n) => new Date(hoyBogota().getTime() + n * 864e5).toISOString().slice(0, 10);
const archivos = (tipo) => {
  try {
    return fs.readdirSync(path.join(carpeta, "deporte", tipo));
  } catch {
    return [];
  }
};

let coord;
let laura;
let natacion;
beforeEach(async () => {
  fs.rmSync(path.join(carpeta, "deporte"), { recursive: true, force: true });
  prisma.__reset();
  coord = crearUsuario("Administrador", "deportes@uniautonoma.edu.co", "Coordinación de Deportes");
  prisma.__darAcceso("deportes@uniautonoma.edu.co", "deporte");
  laura = crearUsuario("Estudiante", "laura.munoz@uniautonoma.edu.co", "Laura Muñoz");
  natacion = await prisma.disciplinaDeportiva.create({ data: { nombre: "Natación", tipo: "Individual" } });
});
afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

const adm = (metodo, ruta, token = coord.token) => request(app)[metodo](`/api/v1/deporte/admin${ruta}`).set(auth(token));
const subir = (ruta, token) => adm("post", `${ruta}/imagen`, token).attach("imagen", PNG, { filename: "foto.png", contentType: "image/png" });

describe("Fotos de Deporte", () => {
  test("la disciplina tiene foto de portada que ven la coordinacion y el estudiante", async () => {
    const res = await subir(`/disciplinas/${natacion.id}`);
    expect(res.status).toBe(200);
    expect(res.body.imagenUrl).toMatch(new RegExp(`^/api/v1/deporte/imagenes/disciplinas/${natacion.id}\\?v=`));
    expect(archivos("disciplinas")).toHaveLength(1);

    // Publica: sin sesion.
    const foto = await request(app).get(res.body.imagenUrl);
    expect(foto.status).toBe(200);
    expect(foto.headers["content-type"]).toMatch(/image\/png/);

    const catalogos = await adm("get", "/catalogos");
    expect(catalogos.body.disciplinas[0]).toMatchObject({ nombre: "Natación", imagenUrl: res.body.imagenUrl });
    expect(catalogos.body.disciplinas[0].imagen).toBeUndefined();

    await adm("post", "/grupos").send({ disciplinaId: natacion.id, nombre: "Natación · Grupo 1", cupo: 10, horario: [{ dia: 1, inicio: "06:00", fin: "08:00" }] });
    const oferta = await request(app).get("/api/v1/deporte/oferta").set(auth(laura.token));
    expect(oferta.body.disciplinas[0].imagenUrl).toBe(res.body.imagenUrl);
    expect(oferta.body.disciplinas[0].grupos[0].disciplina.imagenUrl).toBe(res.body.imagenUrl);

    // Reemplazar borra la anterior; quitar la elimina.
    const otra = await subir(`/disciplinas/${natacion.id}`);
    expect(otra.body.imagenUrl).not.toBe(res.body.imagenUrl);
    expect(archivos("disciplinas")).toHaveLength(1);
    expect((await adm("delete", `/disciplinas/${natacion.id}/imagen`)).body).toEqual({ imagenUrl: null });
    expect(archivos("disciplinas")).toHaveLength(0);
    expect((await request(app).get(`/api/v1/deporte/imagenes/disciplinas/${natacion.id}`)).status).toBe(404);
  });

  test("eventos, implementos y comunicados muestran su foto", async () => {
    const evento = (await adm("post", "/eventos").send({ nombre: "Torneo de natación", fecha: enDias(5), horaInicio: "08:00", horaFin: "10:00" })).body.evento;
    expect(evento.imagenUrl).toBeNull();
    await subir(`/eventos/${evento.id}`);
    expect((await adm("get", `/eventos/${evento.id}`)).body.evento.imagenUrl).toMatch(/\/imagenes\/eventos\//);
    expect((await request(app).get("/api/v1/deporte/eventos").set(auth(laura.token))).body.eventos[0].imagenUrl).toMatch(/\/imagenes\/eventos\//);

    const implemento = (await adm("post", "/inventario").send({ nombre: "Balón de voleibol", cantidad: 5 })).body.implemento;
    expect((await subir(`/inventario/${implemento.id}`)).status).toBe(200);
    expect((await adm("get", "/inventario")).body.implementos[0].imagenUrl).toMatch(/\/imagenes\/implementos\//);
    expect((await adm("get", `/inventario/${implemento.id}`)).body.implemento.imagenUrl).toMatch(/\/imagenes\/implementos\//);

    const alerta = (await adm("post", "/alertas").send({ titulo: "Semana deportiva", mensaje: "Inscríbete.", alcance: "Todos" })).body.alerta;
    await subir(`/alertas/${alerta.id}`);
    expect((await adm("get", "/alertas")).body.alertas[0].imagenUrl).toMatch(/\/imagenes\/alertas\//);
    // Borrar el comunicado borra su foto.
    await adm("delete", `/alertas/${alerta.id}`);
    expect(archivos("alertas")).toHaveLength(0);
  });

  test("valida formato, permisos y existencia", async () => {
    const pdf = await adm("post", `/disciplinas/${natacion.id}/imagen`).attach("imagen", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(pdf.status).toBe(400);
    expect((await adm("post", `/disciplinas/${natacion.id}/imagen`)).status).toBe(400);
    expect((await subir(`/disciplinas/${natacion.id}`, laura.token)).status).toBe(403);
    expect((await subir("/eventos/no-existe")).status).toBe(404);
    expect(archivos("eventos")).toHaveLength(0);
    expect((await request(app).get(`/api/v1/deporte/imagenes/otra-cosa/${natacion.id}`)).status).toBe(404);
  });

  test("el docente pone foto solo a los comunicados de sus grupos", async () => {
    const carlos = crearUsuario("Estudiante", "carlos.ruiz@uniautonoma.edu.co", "Carlos Ruiz");
    const d = (await adm("post", "/docentes").send({ email: "carlos.ruiz@uniautonoma.edu.co", nombre: "Carlos Ruiz" })).body.docente;
    const propio = (await adm("post", "/grupos").send({ disciplinaId: natacion.id, nombre: "Natación · Grupo 1", cupo: 10, docenteId: d.id, horario: [{ dia: 1, inicio: "06:00", fin: "08:00" }] })).body.grupo;
    const ajeno = (await adm("post", "/grupos").send({ disciplinaId: natacion.id, nombre: "Natación · Grupo 2", cupo: 10, horario: [{ dia: 2, inicio: "06:00", fin: "08:00" }] })).body.grupo;
    const doc = (metodo, ruta) => request(app)[metodo](`/api/v1/deporte/docente${ruta}`).set(auth(carlos.token));

    const mio = (await doc("post", "/alertas").send({ grupoId: propio.id, titulo: "Piscina 2", mensaje: "Nos vemos en la piscina 2." })).body.alerta;
    const res = await doc("post", `/alertas/${mio.id}/imagen`).attach("imagen", PNG, { filename: "f.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect((await doc("get", "/alertas")).body.alertas[0].imagenUrl).toBe(res.body.imagenUrl);
    expect((await doc("delete", `/alertas/${mio.id}/imagen`)).status).toBe(200);

    const deOtro = (await adm("post", "/alertas").send({ titulo: "X", mensaje: "Y", alcance: "Grupo", grupoId: ajeno.id })).body.alerta;
    const general = (await adm("post", "/alertas").send({ titulo: "X", mensaje: "Y", alcance: "Todos" })).body.alerta;
    for (const a of [deOtro, general]) {
      expect((await doc("post", `/alertas/${a.id}/imagen`).attach("imagen", PNG, { filename: "f.png", contentType: "image/png" })).status).toBe(403);
    }
    expect(archivos("alertas")).toHaveLength(0);
  });
});
