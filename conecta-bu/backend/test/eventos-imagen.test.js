// Foto de los talleres y eventos: el personal la sube, la reemplaza o la
// quita; se ve en la lista del estudiante y en la agenda publica.

const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-eventos-"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

// PNG de 1x1 pixel.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let admin;
let evento;
beforeEach(() => {
  fs.rmSync(path.join(carpeta, "eventos"), { recursive: true, force: true });
  prisma.__reset();
  admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
  evento = prisma.__seedEvento({ fecha: diasDesdeHoy(5), fechaLimiteInscripcion: diasDesdeHoy(4) });
});
afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

describe("Imagen de talleres y eventos", () => {
  test("el personal sube una imagen y queda visible para todos", async () => {
    const res = await request(app).post(`/api/v1/admin/eventos/${evento.id}/imagen`).set(auth(admin.token)).attach("imagen", PNG, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(res.body.imagenUrl).toMatch(new RegExp(`^/api/v1/eventos/${evento.id}/imagen\\?v=`));

    const lista = await request(app).get("/api/v1/admin/eventos").set(auth(admin.token));
    expect(lista.body.eventos[0].imagenUrl).toBe(res.body.imagenUrl);

    const publicos = await request(app).get("/api/v1/eventos/publicos");
    expect(publicos.body.eventos[0].imagenUrl).toBe(res.body.imagenUrl);

    const archivo = await request(app).get(`/api/v1/eventos/${evento.id}/imagen`);
    expect(archivo.status).toBe(200);
    expect(archivo.headers["content-type"]).toMatch(/image\/png/);
    // Se puede mostrar desde el frontend en otro puerto (helmet lo bloquearia).
    expect(archivo.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  test("reemplazar borra la anterior y quitar la deja sin imagen", async () => {
    const subir = () =>
      request(app).post(`/api/v1/admin/eventos/${evento.id}/imagen`).set(auth(admin.token)).attach("imagen", PNG, { filename: "f.png", contentType: "image/png" });
    await subir();
    await subir();
    expect(fs.readdirSync(path.join(carpeta, "eventos"))).toHaveLength(1);

    const quitar = await request(app).delete(`/api/v1/admin/eventos/${evento.id}/imagen`).set(auth(admin.token));
    expect(quitar.status).toBe(200);
    expect((await request(app).get(`/api/v1/eventos/${evento.id}/imagen`)).status).toBe(404);
  });

  test("rechaza archivos que no son imagen y a quien no es personal", async () => {
    const pdf = await request(app)
      .post(`/api/v1/admin/eventos/${evento.id}/imagen`)
      .set(auth(admin.token))
      .attach("imagen", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" });
    expect(pdf.status).toBe(400);
    const est = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).post(`/api/v1/admin/eventos/${evento.id}/imagen`).set(auth(est.token)).attach("imagen", PNG, { filename: "f.png", contentType: "image/png" });
    expect(res.status).toBe(403);
  });
});
