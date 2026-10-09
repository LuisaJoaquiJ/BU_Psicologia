// Informe de gestion (formato INFBI-002) que Salud integral prepara y envia
// al superadministrador: borrador prellenado, revision antes de enviar, foto
// de las cifras al enviar, descargas en PDF y Excel (con graficas nativas),
// revision del superadministrador y cifras historicas.

const os = require("os");
const path = require("path");
const fs = require("fs");

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "cbu-informe-")) });

const request = require("supertest");
const JSZip = require("jszip");
const ExcelJS = require("exceljs");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");

const binario = (res, cb) => {
  const partes = [];
  res.on("data", (d) => partes.push(d));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};

let salud;
let superadmin;
let orientacion;
let periodo;
beforeEach(async () => {
  prisma.__reset();
  salud = crearUsuario("Salud", "enfermeria@uniautonoma.edu.co");
  superadmin = crearUsuario("SuperAdministrador", "super@uniautonoma.edu.co");
  orientacion = crearUsuario("Administrador", "psicologia@uniautonoma.edu.co");
  periodo = (await api("get", "/catalogos")).body.periodoActual;
});

const api = (metodo, ruta, token = salud.token) => request(app)[metodo](`/api/v1/salud${ruta}`).set(auth(token));
const sup = (metodo, ruta, token = superadmin.token) => request(app)[metodo](`/api/v1/super${ruta}`).set(auth(token));

async function conAtenciones() {
  const actividad = (await api("post", "/actividades").send({ nombre: "Tamizaje visual", categoria: "PromocionPrevencion", meta: 1 })).body.actividad;
  const enfermeria = (await api("post", "/actividades").send({ nombre: "Atención básica", categoria: "AtencionEnfermeria", permanente: true, meta: 1 })).body.actividad;
  const personas = [
    { numeroDocumento: "1061700001", nombres: "Laura", apellidos: "Muñoz", poblacion: "Estudiante", programa: "Ingeniería Civil" },
    { numeroDocumento: "1061700002", nombres: "Jorge", apellidos: "Paz", poblacion: "Docente" },
    { numeroDocumento: "1061700003", nombres: "Ana", apellidos: "Ruiz", poblacion: "Administrativo" },
  ];
  for (const p of personas) {
    expect((await api("post", "/personas").send({ ...p, consentimientoDatos: true })).status).toBe(201);
    expect((await api("post", "/atenciones").send({ identificador: p.numeroDocumento, actividadId: actividad.id })).status).toBe(201);
  }
  expect((await api("post", "/atenciones").send({ identificador: "1061700001", actividadId: enfermeria.id })).status).toBe(201);
  return { actividad, enfermeria };
}

const completo = () => ({
  responsable: "Coordinación de Salud integral",
  fechaPresentacion: "2026-12-10",
  logros: "Se realizaron las jornadas programadas.",
  dificultades: "Baja participación nocturna.",
  accionesMejora: "Jornadas en horario nocturno.",
});

describe("Informe de gestión del módulo Salud", () => {
  it("es solo para el personal de Salud", async () => {
    expect((await api("get", `/informes/${periodo}`, orientacion.token)).status).toBe(403);
  });

  it("arma un borrador prellenado con el formato vigente y las cifras del periodo", async () => {
    await conAtenciones();
    const res = await api("get", `/informes/${periodo}`);
    expect(res.status).toBe(200);
    expect(res.body.informe).toMatchObject({ estado: "Borrador", editable: true, copiadoDe: "plantilla", accionMejora: true });
    expect(res.body.informe.descripcion).toMatch(/Unidad de Salud Integral/);
    expect(res.body.informe.objetivos).toHaveLength(2);
    expect(res.body.cifras.kpis).toMatchObject({ atenciones: 4, personas: 3, actividades: 2, enfermeria: 1 });
    expect(res.body.cifras.porPoblacion.find((p) => p.clave === "Estudiante").total).toBe(2);
    expect(res.body.cifras.asistenciaObjeto.find((p) => p.nombre === "Ingeniería Civil").total).toBe(2);
    expect(res.body.revision.listo).toBe(false);
    expect(res.body.revision.faltantes).toEqual(expect.arrayContaining(["Logros significativos", "Responsable del proyecto"]));
    expect(res.body.revision.avisos.map((a) => a.tipo)).toContain("avances");
  });

  it("compara con las cifras históricas sin contar dos veces el mismo año", async () => {
    await conAtenciones();
    const anio = periodo.split("-")[0];
    const guardado = await api("put", "/informes/historicos").send({
      historicos: [
        { periodo: "2024", estudiantes: 2324, docentes: 581, administrativos: 1436, externos: 90, egresados: 3, enfermeria: 1514, poblacionGeneral: 4434 },
        { periodo: "2025", estudiantes: 3385, docentes: 990, administrativos: 1232, externos: 6, egresados: 1, enfermeria: 779 },
      ],
    });
    expect(guardado.status).toBe(200);
    expect(guardado.body.historicos.map((h) => h.periodo)).toEqual(["2024", "2025"]);
    const { cifras } = (await api("get", `/informes/${periodo}`)).body;
    expect(cifras.impacto.map((f) => f.periodo)).toEqual(["2024", "2025", periodo]);
    expect(cifras.impacto.find((f) => f.periodo === "2025").total).toBe(5614);
    expect(cifras.poblacionGeneral.find((f) => f.periodo === "2025").total).toBe(5614);
    expect(cifras.enfermeria.find((f) => f.periodo === periodo).total).toBe(1);
    // Un semestre no se compara con un año completo.
    expect(cifras.comparacion).toBeNull();

    // Si el año actual esta en los historicos, no se suman sus semestres de Conecta BU.
    await api("put", "/informes/historicos").send({ historicos: [{ periodo: anio, estudiantes: 10 }] });
    const otra = (await api("get", `/informes/${periodo}`)).body.cifras;
    expect(otra.impacto.map((f) => f.periodo)).toEqual([anio]);

    expect((await api("put", "/informes/historicos").send({ historicos: [{ periodo: "20x5" }] })).status).toBe(400);
    expect((await api("put", "/informes/historicos").send({ historicos: [{ periodo: "2024" }, { periodo: "2024" }] })).status).toBe(400);
  });

  it("no deja enviar un informe incompleto y lo envía con la foto de las cifras", async () => {
    await conAtenciones();
    expect((await api("post", `/informes/${periodo}/enviar`)).status).toBe(400);
    await api("put", `/informes/${periodo}`).send({ responsable: "Coordinación" });
    const incompleto = await api("post", `/informes/${periodo}/enviar`);
    expect(incompleto.status).toBe(400);
    expect(incompleto.body.message).toMatch(/Logros significativos/);

    const guardado = await api("put", `/informes/${periodo}`).send(completo());
    expect(guardado.body.revision.listo).toBe(true);
    const enviado = await api("post", `/informes/${periodo}/enviar`);
    expect(enviado.status).toBe(200);
    expect(enviado.body.informe).toMatchObject({ estado: "Enviado", version: 1, editable: false, enviadoPor: "enfermeria@uniautonoma.edu.co" });
    expect((await api("put", `/informes/${periodo}`).send({ logros: "cambio" })).status).toBe(409);

    // Lo enviado no cambia aunque se sigan registrando atenciones.
    const act = (await api("post", "/actividades").send({ nombre: "Pausas activas", categoria: "PromocionPrevencion" })).body.actividad;
    await api("post", "/atenciones").send({ identificador: "1061700002", actividadId: act.id });
    expect((await api("get", `/informes/${periodo}`)).body.cifras.kpis.atenciones).toBe(4);
  });

  it("descarga el informe en PDF y en Excel con las hojas del formato y gráficas nativas", async () => {
    await conAtenciones();
    await api("put", `/informes/${periodo}`).send(completo());
    const pdf = await api("get", `/informes/${periodo}/archivo?formato=pdf`).buffer(true).parse(binario);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
    expect(pdf.headers["content-disposition"]).toMatch(/borrador\.pdf/);
    expect(pdf.body.slice(0, 5).toString()).toBe("%PDF-");

    const xlsx = await api("get", `/informes/${periodo}/archivo?formato=xlsx`).buffer(true).parse(binario);
    expect(xlsx.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(xlsx.body);
    expect(libro.worksheets.map((h) => h.name)).toEqual(["PROYECTO", "INFORME - EVALUACIÓN", "ATENDIDOS", "ESTADÍSTICAS", "REGISTRO FOTOGRÁFICO"]);
    expect(libro.getWorksheet("PROYECTO").getCell("Q1").value).toBe("INFBI-002");
    expect(libro.getWorksheet("PROYECTO").getCell("O8").value).toBe("Coordinación de Salud integral");
    expect(libro.getWorksheet("INFORME - EVALUACIÓN").getCell("A11").value).toMatch(/jornadas programadas/);
    const zip = await JSZip.loadAsync(xlsx.body);
    const graficas = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f));
    expect(graficas.length).toBeGreaterThanOrEqual(4);
    expect(await zip.file("[Content_Types].xml").async("string")).toMatch(/drawingml\.chart\+xml/);
    expect(await zip.file(graficas[0]).async("string")).toMatch(/'ESTADÍSTICAS'!\$B\$\d+:\$B\$\d+/);

    expect((await api("get", `/informes/${periodo}/archivo?formato=doc`)).status).toBe(400);
    // El Excel del informe de gestion de Reportes usa el mismo formato.
    const reporte = await api("get", `/reportes/gestion?periodo=${periodo}`).buffer(true).parse(binario);
    expect(reporte.status).toBe(200);
  });

  it("un informe nuevo copia los textos del informe anterior", async () => {
    const [anio, sem] = periodo.split("-").map(Number);
    const siguiente = sem === 1 ? `${anio}-2` : `${anio + 1}-1`;
    await api("put", `/informes/${periodo}`).send({ ...completo(), descripcion: "Descripción propia del equipo" });
    const nuevo = (await api("get", `/informes/${siguiente}`)).body.informe;
    expect(nuevo).toMatchObject({ copiadoDe: periodo, descripcion: "Descripción propia del equipo", responsable: "Coordinación de Salud integral", logros: null });
    expect((await api("get", "/informes")).body.informes).toHaveLength(1);
  });
});

describe("Informes recibidos por el superadministrador", () => {
  async function enviar() {
    await conAtenciones();
    await api("put", `/informes/${periodo}`).send(completo());
    return (await api("post", `/informes/${periodo}/enviar`)).body.informe;
  }

  it("solo el superadministrador los ve; los borradores no aparecen", async () => {
    await api("put", `/informes/${periodo}`).send(completo());
    expect((await sup("get", "/informes")).body.informes).toHaveLength(0);
    expect((await sup("get", "/informes", salud.token)).status).toBe(403);
    const borrador = (await api("get", "/informes")).body.informes[0];
    expect((await sup("get", `/informes/${borrador.id}/archivo?formato=pdf`)).status).toBe(404);
  });

  it("lista lo enviado con su resumen, lo descarga y lo cuenta en el inicio", async () => {
    const informe = await enviar();
    const lista = await sup("get", "/informes");
    expect(lista.body.informes).toHaveLength(1);
    expect(lista.body.informes[0]).toMatchObject({ modulo: "salud", periodo, estado: "Enviado", resumen: { atenciones: 4, personas: 3 } });
    expect(lista.body.informes[0].datosEnviados).toBeUndefined();
    expect((await sup("get", "/resumen")).body.informesPorRevisar).toBe(1);
    const pdf = await sup("get", `/informes/${informe.id}/archivo?formato=pdf`).buffer(true).parse(binario);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-disposition"]).not.toMatch(/borrador/);
    const xlsx = await sup("get", `/informes/${informe.id}/archivo?formato=xlsx`).buffer(true).parse(binario);
    expect(xlsx.status).toBe(200);
  });

  it("devuelve con observación, el módulo corrige y reenvía, y luego se aprueba", async () => {
    const informe = await enviar();
    expect((await sup("patch", `/informes/${informe.id}`).send({ estado: "Devuelto" })).status).toBe(400);
    const devuelto = await sup("patch", `/informes/${informe.id}`).send({ estado: "Devuelto", observacion: "Agregar el presupuesto ejecutado." });
    expect(devuelto.body.informe).toMatchObject({ estado: "Devuelto", observacionRevision: "Agregar el presupuesto ejecutado.", revisadoPor: "super@uniautonoma.edu.co" });
    expect((await sup("patch", `/informes/${informe.id}`).send({ estado: "Aprobado" })).status).toBe(409);

    const visto = (await api("get", `/informes/${periodo}`)).body.informe;
    expect(visto).toMatchObject({ estado: "Devuelto", editable: true, observacionRevision: "Agregar el presupuesto ejecutado." });
    await api("put", `/informes/${periodo}`).send({ logros: "Logros corregidos." });
    const reenviado = await api("post", `/informes/${periodo}/enviar`);
    expect(reenviado.body.informe).toMatchObject({ estado: "Enviado", version: 2 });

    const aprobado = await sup("patch", `/informes/${informe.id}`).send({ estado: "Aprobado" });
    expect(aprobado.body.informe.estado).toBe("Aprobado");
    expect((await sup("get", "/informes?estado=Aprobado")).body.informes).toHaveLength(1);
    expect((await api("put", `/informes/${periodo}`).send({ logros: "x" })).status).toBe(409);
  });
});
