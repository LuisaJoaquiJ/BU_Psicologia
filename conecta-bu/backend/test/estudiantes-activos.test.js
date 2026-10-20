// Lista de estudiantes activos de Salud integral: plantilla, carga del Excel
// con vista previa, descarga de la lista y datos al inscribirse a salidas.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

async function excel(filas, cabeceras = ["Tipo de documento", "Número de documento", "Código estudiantil", "Nombres", "Apellidos", "Programa", "Correo institucional", "Teléfono"]) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Lista");
  hoja.addRow(cabeceras);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const ANA = ["CC", 1061700123, "20231001", "ANA MARÍA", "PÉREZ ruiz", "Ingeniería Civil", "Ana.Perez@uniautonoma.edu.co", "3104567890"];
const LUIS = ["TI", "1002003004", "", "Luis", "Gómez", "Derecho", "", ""];

let salud;
beforeEach(() => {
  prisma.__reset();
  salud = crearUsuario("Salud", "salud@uniautonoma.edu.co");
});

const subir = async (filas, confirmar = false, cabeceras) =>
  request(app)
    .post(`/api/v1/salud/personas/estudiantes-activos/importar${confirmar ? "?confirmar=true" : ""}`)
    .set(auth(salud.token))
    .attach("archivo", await excel(filas, cabeceras), { filename: "activos.xlsx" });

describe("Estudiantes activos de Salud integral", () => {
  test("la vista previa no guarda; al confirmar quedan cargados como estudiantes activos", async () => {
    const previa = await subir([ANA, LUIS, ["CC", "", "", "Sin", "Documento"], ANA]);
    expect(previa.status).toBe(200);
    expect(previa.body).toMatchObject({ confirmado: false, estudiantes: 2, nuevos: 2, actualizados: 0, filasConError: 1, repetidas: 1 });
    expect(await prisma.personaSalud.count()).toBe(0);

    const res = await subir([ANA, LUIS], true);
    expect(res.status).toBe(201);
    const ana = await prisma.personaSalud.findUnique({ where: { numeroDocumento: "1061700123" } });
    expect(ana).toMatchObject({ nombres: "Ana María", apellidos: "Pérez Ruiz", codigoEstudiantil: "20231001", correo: "ana.perez@uniautonoma.edu.co", poblacion: "Estudiante", estudianteActivo: true });
    expect((await request(app).get("/api/v1/salud/personas/estudiantes-activos").set(auth(salud.token))).body.activos).toBe(2);
  });

  test("una lista nueva actualiza a los que siguen y desactiva a los que ya no están", async () => {
    await subir([ANA, LUIS], true);
    const previa = await subir([[...ANA.slice(0, 5), "Ingeniería Ambiental", "", ""]]);
    expect(previa.body).toMatchObject({ nuevos: 0, actualizados: 1, dejanDeEstarActivos: 1 });
    await subir([[...ANA.slice(0, 5), "Ingeniería Ambiental", "", ""]], true);
    const ana = await prisma.personaSalud.findUnique({ where: { numeroDocumento: "1061700123" } });
    expect(ana).toMatchObject({ programa: "Ingeniería Ambiental y de Saneamiento", correo: "ana.perez@uniautonoma.edu.co", estudianteActivo: true });
    expect((await prisma.personaSalud.findUnique({ where: { numeroDocumento: "1002003004" } })).estudianteActivo).toBe(false);
  });

  test("acepta columnas con otros nombres y rechaza archivos sin las obligatorias", async () => {
    const otra = await subir([["1061700999", "Carlos", "Díaz"]], false, ["Cédula", "Nombre", "Apellido"]);
    expect(otra.body).toMatchObject({ estudiantes: 1, nuevos: 1 });
    const mala = await subir([["x", "y"]], false, ["Hola", "Mundo"]);
    expect(mala.status).toBe(400);
  });

  test("descarga la plantilla y la lista; solo el personal de Salud", async () => {
    await subir([ANA, LUIS], true);
    const res = await request(app).get("/api/v1/salud/personas/estudiantes-activos/exportar").set(auth(salud.token)).buffer(true).parse(binario);
    expect(res.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(res.body);
    const hoja = libro.getWorksheet("Estudiantes activos");
    expect(hoja.rowCount).toBe(3);
    expect(hoja.getRow(2).getCell(2).value).toBe("1002003004"); // Gómez antes que Pérez
    const plantilla = await request(app).get("/api/v1/salud/personas/estudiantes-activos/plantilla").set(auth(salud.token)).buffer(true).parse(binario);
    expect(plantilla.status).toBe(200);
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    expect((await request(app).get("/api/v1/salud/personas/estudiantes-activos/exportar").set(auth(est.token))).status).toBe(403);
  });

  test("el estudiante de la lista ve sus datos llenos al inscribirse a una salida", async () => {
    await subir([ANA], true);
    const ana = crearUsuario("Estudiante", "ana.perez@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/salud/estudiante/salidas").set(auth(ana.token));
    expect(res.body.misDatos).toEqual({ tipoDocumento: "CC", documento: "1061700123", programa: "Ingeniería Civil", celular: "3104567890" });
  });
});
