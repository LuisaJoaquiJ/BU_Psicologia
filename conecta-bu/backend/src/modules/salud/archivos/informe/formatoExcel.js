const fs = require("fs");
const path = require("path");
const { AZUL, DORADO, MARFIL, BORDES, encabezado } = require("../estiloExcel");
const { FORMATO, NOMBRE_PROYECTO } = require("../../utils/informe/plantilla");

// Formato INFBI-002 en Excel: colores por poblacion, logo, encabezado
// institucional, bloques de texto y tablas.

const COLORES_POBLACION = { Estudiante: "163F86", Docente: "0D9488", Administrativo: "D97706", Externo: "9CA3AF", Egresado: "7C3AED" };
const ETIQUETAS = { Estudiante: "Estudiantes", Docente: "Docentes", Administrativo: "Administrativos", Externo: "Externos", Egresado: "Egresados" };
const ORDEN_POBLACION = ["Estudiante", "Docente", "Administrativo", "Externo", "Egresado"];

const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "..", "..", "assets", "logo-uniautonoma.png");
const leerLogo = () => {
  try {
    return fs.readFileSync(RUTA_LOGO);
  } catch {
    return null;
  }
};

const fechaLarga = (iso) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";

function relleno(argb) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

// Alto de una fila con texto largo combinado en A:R (unos 150 caracteres por linea).
function altoTexto(texto, caracteresPorLinea = 150, minimo = 30) {
  const lineas = String(texto || "")
    .split("\n")
    .reduce((s, p) => s + Math.max(1, Math.ceil(p.length / caracteresPorLinea)), 0);
  return Math.min(409, Math.max(minimo, lineas * 14.5 + 8));
}

// Encabezado institucional (filas 1 a 8) comun a PROYECTO y EVALUACIÓN.
function encabezadoInstitucional(libro, hoja, informe, subtitulo, idLogo) {
  for (let c = 1; c <= 18; c += 1) hoja.getColumn(c).width = 9.5;
  hoja.mergeCells("A1:B4");
  if (idLogo !== null) hoja.addImage(idLogo, { tl: { col: 0.25, row: 0.15 }, ext: { width: 92, height: 97 } });
  hoja.mergeCells("C1:O3");
  const nombre = hoja.getCell("C1");
  nombre.value = `CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA\n${subtitulo}`;
  nombre.font = { bold: true, size: 13, color: { argb: AZUL } };
  nombre.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  hoja.mergeCells("C4:O4");
  const proceso = hoja.getCell("C4");
  proceso.value = FORMATO.proceso;
  proceso.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  proceso.fill = relleno(AZUL);
  proceso.alignment = { horizontal: "center", vertical: "middle" };
  const meta = [
    ["Código", FORMATO.codigo],
    ["Versión", FORMATO.version],
    ["Fecha:", new Date(`${FORMATO.fecha}T12:00:00Z`)],
    ["Página:", "1 de 1"],
  ];
  meta.forEach(([k, v], i) => {
    const fila = i + 1;
    hoja.getCell(fila, 16).value = k;
    hoja.getCell(fila, 16).font = { bold: true, size: 9 };
    hoja.mergeCells(fila, 17, fila, 18);
    const celda = hoja.getCell(fila, 17);
    celda.value = v;
    celda.font = { size: 9 };
    celda.alignment = { horizontal: "center" };
    if (v instanceof Date) celda.numFmt = "d-mmm-yy";
  });
  for (let f = 1; f <= 4; f += 1) for (let c = 1; c <= 18; c += 1) hoja.getCell(f, c).border = BORDES;
  [1, 2, 3, 4].forEach((f) => (hoja.getRow(f).height = 21));

  const etiqueta = (ref, texto) => {
    hoja.mergeCells(ref);
    const c = hoja.getCell(ref.split(":")[0]);
    c.value = texto;
    c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    c.fill = relleno(AZUL);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  };
  const valor = (ref, texto, opciones = {}) => {
    hoja.mergeCells(ref);
    const c = hoja.getCell(ref.split(":")[0]);
    c.value = texto;
    c.font = { size: 10, bold: Boolean(opciones.negrita) };
    c.alignment = { vertical: "middle", horizontal: opciones.izquierda ? "left" : "center", wrapText: true };
    if (opciones.numFmt) c.numFmt = opciones.numFmt;
  };
  etiqueta("A6:B6", "NOMBRE PROYECTO");
  valor("C6:M6", NOMBRE_PROYECTO[informe.modulo] || String(informe.modulo).toUpperCase(), { negrita: true });
  etiqueta("N6:O6", "FECHA PRESENTACIÓN");
  valor("P6:R6", informe.fechaPresentacion ? new Date(`${String(informe.fechaPresentacion).slice(0, 10)}T12:00:00Z`) : "", { numFmt: "d-mmm-yy" });
  etiqueta("A8:B8", "TIPO DE ACCIÓN");
  valor("C8:D8", "Mejora continua");
  hoja.getCell("E8").value = informe.accionMejora ? "X" : "";
  valor("F8:G8", "Correctivo");
  hoja.getCell("H8").value = informe.accionCorrectiva ? "X" : "";
  valor("I8:J8", "Preventivo");
  hoja.getCell("K8").value = informe.accionPreventiva ? "X" : "";
  ["E8", "H8", "K8"].forEach((r) => {
    hoja.getCell(r).font = { bold: true, color: { argb: AZUL } };
    hoja.getCell(r).alignment = { horizontal: "center", vertical: "middle" };
  });
  etiqueta("L8:N8", "RESPONSABLE DEL PROYECTO");
  valor("O8:R8", informe.responsable || "");
  for (const f of [6, 8]) {
    hoja.getRow(f).height = 26;
    for (let c = 1; c <= 18; c += 1) hoja.getCell(f, c).border = BORDES;
  }
}

function bloqueTexto(hoja, fila, tituloBloque, texto) {
  hoja.mergeCells(fila, 1, fila, 18);
  const t = hoja.getCell(fila, 1);
  t.value = tituloBloque;
  t.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  t.fill = relleno(AZUL);
  t.alignment = { horizontal: "center", vertical: "middle" };
  hoja.getRow(fila).height = 20;
  hoja.mergeCells(fila + 1, 1, fila + 1, 18);
  const c = hoja.getCell(fila + 1, 1);
  c.value = texto || "";
  c.font = { size: 10 };
  c.alignment = { wrapText: true, vertical: "top", horizontal: "justify" };
  for (let k = 1; k <= 18; k += 1) hoja.getCell(fila + 1, k).border = BORDES;
  hoja.getRow(fila + 1).height = altoTexto(texto);
  return fila + 3;
}

function tabla(hoja, fila, tituloTabla, columnas, filas, col = 2) {
  const t = hoja.getCell(fila, col);
  t.value = tituloTabla;
  t.font = { bold: true, size: 12, color: { argb: AZUL } };
  hoja.getCell(fila, col).border = { bottom: { style: "medium", color: { argb: DORADO } } };
  columnas.forEach((c, i) => {
    const celda = hoja.getCell(fila + 1, col + i);
    celda.value = c.titulo;
    encabezado(celda, c.color ? { fondo: `FF${c.color}` } : {});
  });
  hoja.getRow(fila + 1).height = 30;
  filas.forEach((f, j) => {
    columnas.forEach((c, i) => {
      const celda = hoja.getCell(fila + 2 + j, col + i);
      celda.value = c.valor(f);
      celda.border = BORDES;
      celda.font = { size: 10, bold: Boolean(c.negrita) };
      if (c.pct) celda.numFmt = "0.0%";
      else if (i > 0) celda.numFmt = "#,##0";
      if (f.fuente === "conecta" || f.resaltar) celda.fill = relleno("FFFBE6B0");
      else if (j % 2) celda.fill = relleno(MARFIL);
    });
  });
  return { desde: fila + 2, hasta: fila + 1 + Math.max(filas.length, 1), siguiente: fila + 3 + Math.max(filas.length, 1) };
}

module.exports = { COLORES_POBLACION, ETIQUETAS, ORDEN_POBLACION, leerLogo, fechaLarga, relleno, altoTexto, encabezadoInstitucional, bloqueTexto, tabla };
