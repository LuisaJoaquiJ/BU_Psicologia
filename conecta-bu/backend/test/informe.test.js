// Pruebas del informe descargable (RF-015): Excel y PDF con resumen de
// asistencia a citas y eventos, detalle y estudiantes para seguimiento.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

// supertest no convierte binarios en Buffer por defecto.
const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

beforeEach(() => prisma.__reset());

async function sembrarDatos() {
  const a = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez");
  const b = crearUsuario("Estudiante", "beto@uniautonoma.edu.co", "Beto Ruiz");
  const cita = async (usuarioId, estado, dias, hora = 9) => {
    const horario = prisma.__seedHorario({
      fecha: diasDesdeHoy(dias),
      horaInicio: new Date(Date.UTC(1970, 0, 1, hora, 0, 0)),
      ocupado: true,
    });
    return prisma.cita.create({ data: { usuarioId, horarioId: horario.id, estado } });
  };
  await cita(a.usuario.id, "Atendida", -3);
  await cita(a.usuario.id, "Atendida", -2, 10);
  await cita(b.usuario.id, "NoAsistio", -3);
  await cita(b.usuario.id, "NoAsistio", -1, 14);
  await cita(b.usuario.id, "Cancelada", 2);

  const evento = prisma.__seedEvento({ nombre: "Taller de manejo del estrés", cupos: 20, fecha: diasDesdeHoy(-1), fechaLimiteInscripcion: diasDesdeHoy(-2) });
  const insA = await prisma.inscripcion.create({ data: { usuarioId: a.usuario.id, eventoId: evento.id } });
  const insB = await prisma.inscripcion.create({ data: { usuarioId: b.usuario.id, eventoId: evento.id } });
  for (const [ins, asistio] of [[insA, true], [insB, false]]) {
    await prisma.asistenciaEvento.upsert({
      where: { inscripcionId: ins.id },
      create: { inscripcionId: ins.id, asistio, registradoPorId: "x" },
      update: {},
    });
  }
}

describe("RF-015: informe descargable", () => {
  test("solo el administrador puede descargarlo", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/admin/estadisticas/informe?formato=xlsx").set(auth(token));
    expect(res.status).toBe(403);
  });

  test("rechaza formatos no soportados", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const res = await request(app).get("/api/v1/admin/estadisticas/informe?formato=doc").set(auth(token));
    expect(res.status).toBe(400);
  });

  test("Excel: resumen, eventos, detalle y seguimiento", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    await sembrarDatos();

    const res = await request(app)
      .get("/api/v1/admin/estadisticas/informe?formato=xlsx")
      .set(auth(token))
      .buffer(true)
      .parse(binario);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="informe-bienestar-.*\.xlsx"/);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(res.body);
    const nombres = libro.worksheets.map((h) => h.name);
    expect(nombres).toEqual(
      expect.arrayContaining(["Resumen", "Citas por servicio", "Citas por día", "Eventos", "Asistentes a eventos", "Detalle de citas", "Estudiantes", "Seguimiento"])
    );

    // Resumen: busca el valor por su etiqueta.
    const resumen = libro.getWorksheet("Resumen");
    const valor = (etiqueta) => {
      let encontrado;
      resumen.eachRow((fila) => {
        if (encontrado === undefined && fila.getCell(1).value === etiqueta) encontrado = fila.getCell(2).value;
      });
      return encontrado;
    };
    expect(valor("Citas en el periodo")).toBe(5);
    expect(valor("Atendidas (asistieron)")).toBe(2);
    expect(valor("No asistieron")).toBe(2);
    expect(valor("Canceladas")).toBe(1);
    expect(valor("Tasa de asistencia")).toBeCloseTo(0.5);
    expect(valor("Asistieron")).toBe(1);

    const eventos = libro.getWorksheet("Eventos");
    expect(eventos.getRow(5).getCell(1).value).toBe("Taller de manejo del estrés");
    expect(eventos.getRow(5).getCell(6).value).toBe(1); // asistieron
    expect(eventos.getRow(5).getCell(7).value).toBe(1); // no asistieron

    expect(libro.getWorksheet("Detalle de citas").getRow(9).getCell(1).value).toBeTruthy();
    // Beto: 2 citas sin asistir + 1 evento sin asistir => seguimiento.
    const seguimiento = libro.getWorksheet("Seguimiento");
    expect(seguimiento.getRow(5).getCell(1).value).toBe("Beto Ruiz");
    expect(seguimiento.getRow(5).getCell(10).value).toBe(3);
    expect(seguimiento.getRow(6).getCell(1).value).toBeFalsy();
  });

  test("PDF: se genera un documento valido, tambien sin datos", async () => {
    const { token } = crearUsuario("Administrador", "admin@uniautonoma.edu.co");

    const vacio = await request(app)
      .get("/api/v1/admin/estadisticas/informe?formato=pdf")
      .set(auth(token))
      .buffer(true)
      .parse(binario);
    expect(vacio.status).toBe(200);
    expect(vacio.headers["content-type"]).toBe("application/pdf");
    expect(vacio.body.subarray(0, 5).toString()).toBe("%PDF-");

    await sembrarDatos();
    const iso = (d) => diasDesdeHoy(d).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/admin/estadisticas/informe?formato=pdf&desde=${iso(-7)}&hasta=${iso(7)}`)
      .set(auth(token))
      .buffer(true)
      .parse(binario);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(`informe-bienestar-${iso(-7)}_a_${iso(7)}.pdf`);
    expect(res.body.length).toBeGreaterThan(vacio.body.length);
  });
});
