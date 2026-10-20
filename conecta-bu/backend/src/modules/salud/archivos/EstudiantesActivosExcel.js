const ExcelJS = require("exceljs");
const { encabezado } = require("./estiloExcel");

// Lista de estudiantes activos de Salud integral. La misma hoja sirve de
// plantilla (sin filas) y de descarga: se puede editar y volver a subir.
const COLUMNAS = [
  { titulo: "Tipo de documento", clave: "tipoDocumento", ancho: 12 },
  { titulo: "Número de documento", clave: "numeroDocumento", ancho: 18 },
  { titulo: "Código estudiantil", clave: "codigoEstudiantil", ancho: 16 },
  { titulo: "Nombres", clave: "nombres", ancho: 24 },
  { titulo: "Apellidos", clave: "apellidos", ancho: 24 },
  { titulo: "Programa", clave: "programa", ancho: 36 },
  { titulo: "Correo institucional", clave: "correo", ancho: 32 },
  { titulo: "Teléfono", clave: "telefono", ancho: 14 },
];

async function generarListaActivos(personas = []) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU · Salud integral";
  const hoja = libro.addWorksheet("Estudiantes activos", { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));
  hoja.getRow(1).eachCell((celda) => encabezado(celda));
  hoja.getRow(1).height = 28;
  // Documento y codigo como texto: Excel no les quita los ceros ni los vuelve notacion cientifica.
  hoja.getColumn("numeroDocumento").numFmt = "@";
  hoja.getColumn("codigoEstudiantil").numFmt = "@";
  for (const p of personas) hoja.addRow(Object.fromEntries(COLUMNAS.map((c) => [c.clave, p[c.clave] ?? ""])));

  const ayuda = libro.addWorksheet("Instrucciones");
  ayuda.getColumn(1).width = 110;
  [
    "Una fila por estudiante matriculado en el periodo. Obligatorios: número de documento, nombres y apellidos.",
    "Tipo de documento: CC, TI, CE, PA o RC (vacío = CC).",
    "Al subir la lista, los estudiantes que no estén en ella dejan de figurar como activos (su historial se conserva).",
    "El correo institucional permite reconocer al estudiante cuando entra a Conecta BU y llenar sus datos al inscribirse a salidas.",
  ].forEach((t) => ayuda.addRow([t]));
  return libro.xlsx.writeBuffer();
}

module.exports = { COLUMNAS, generarListaActivos };
