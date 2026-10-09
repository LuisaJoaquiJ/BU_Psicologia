// Informe de gestion en Excel con el formato INFBI-002 de la Uniautonoma:
// PROYECTO, INFORME - EVALUACIÓN, ATENDIDOS, ESTADÍSTICAS (con graficas
// nativas de Excel) y REGISTRO FOTOGRÁFICO.
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { agregarGraficas, rango } = require("../../common/utils/excelGraficas");
const base = require("./reportes.excel");
const { FORMATO, NOMBRE_PROYECTO } = require("./informe.plantilla");

const { AZUL, DORADO, MARFIL, GRIS, BORDES } = base;
const COLORES_POBLACION = { Estudiante: "163F86", Docente: "0D9488", Administrativo: "D97706", Externo: "9CA3AF", Egresado: "7C3AED" };
const ETIQUETAS = { Estudiante: "Estudiantes", Docente: "Docentes", Administrativo: "Administrativos", Externo: "Externos", Egresado: "Egresados" };
const ORDEN_POBLACION = ["Estudiante", "Docente", "Administrativo", "Externo", "Egresado"];

const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "assets", "logo-uniautonoma.png");
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

function hojaProyecto(libro, informe, idLogo) {
  const hoja = libro.addWorksheet("PROYECTO", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  encabezadoInstitucional(libro, hoja, informe, "INFORME DE GESTIÓN · PROYECTO", idLogo);
  let fila = 10;
  fila = bloqueTexto(hoja, fila, "DESCRIPCIÓN DEL PROYECTO", informe.descripcion);
  fila = bloqueTexto(hoja, fila, "JUSTIFICACIÓN DEL PROYECTO", informe.justificacion);
  fila = bloqueTexto(hoja, fila, "ALINEACIÓN ESTRATÉGICA", informe.alineacion);

  [["A", "F", "OBJETIVOS"], ["G", "L", "RESULTADOS"], ["M", "R", "BENEFICIOS ESPERADOS"]].forEach(([d, h, t]) => {
    hoja.mergeCells(`${d}${fila}:${h}${fila}`);
    const c = hoja.getCell(`${d}${fila}`);
    c.value = t;
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = relleno(AZUL);
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  hoja.getRow(fila).height = 20;
  fila += 1;
  for (const o of informe.objetivos || []) {
    const textos = [o.objetivo, o.resultado, o.beneficio];
    [["A", "F"], ["G", "L"], ["M", "R"]].forEach(([d, h], i) => {
      hoja.mergeCells(`${d}${fila}:${h}${fila}`);
      const c = hoja.getCell(`${d}${fila}`);
      c.value = textos[i] || "";
      c.font = { size: 9.5 };
      c.alignment = { wrapText: true, vertical: "top" };
    });
    for (let k = 1; k <= 18; k += 1) hoja.getCell(fila, k).border = BORDES;
    hoja.getRow(fila).height = Math.max(...textos.map((t) => altoTexto(t, 62, 40)));
    fila += 1;
  }
}

function hojaEvaluacion(libro, informe, cifras, idLogo) {
  const hoja = libro.addWorksheet("INFORME - EVALUACIÓN", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  encabezadoInstitucional(libro, hoja, informe, `INFORME DE GESTIÓN · EVALUACIÓN ${informe.periodo}`, idLogo);
  let fila = 10;
  fila = bloqueTexto(hoja, fila, "LOGROS SIGNIFICATIVOS", informe.logros);
  fila = bloqueTexto(hoja, fila, "DIFICULTADES PRESENTADAS", informe.dificultades);
  fila = bloqueTexto(hoja, fila, "ACCIONES DE MEJORA", informe.accionesMejora);

  // Indicadores del periodo (calculados de lo registrado en Conecta BU).
  hoja.mergeCells(fila, 1, fila, 18);
  const t = hoja.getCell(fila, 1);
  t.value = `INDICADORES DEL PERIODO ${informe.periodo} (registrados en Conecta BU)`;
  t.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  t.fill = relleno(AZUL);
  t.alignment = { horizontal: "center" };
  const k = cifras.kpis;
  const indicadores = [
    ["Atenciones", k.atenciones],
    ["Personas atendidas", k.personas],
    ["Actividades ejecutadas", k.actividades],
    ["Jornadas realizadas", k.jornadas],
    ["Cumplimiento promedio de metas", k.cumplimientoPromedio === null ? "—" : k.cumplimientoPromedio / 100],
    ["Atenciones del servicio de enfermería", k.enfermeria],
  ];
  indicadores.forEach(([nombre, v], i) => {
    const col = 1 + (i % 3) * 6;
    const f = fila + 1 + Math.floor(i / 3) * 2;
    hoja.mergeCells(f, col, f, col + 5);
    hoja.mergeCells(f + 1, col, f + 1, col + 5);
    const n = hoja.getCell(f, col);
    n.value = nombre;
    n.font = { size: 9, color: { argb: GRIS } };
    n.alignment = { horizontal: "center" };
    const c = hoja.getCell(f + 1, col);
    c.value = v;
    c.font = { bold: true, size: 16, color: { argb: AZUL } };
    c.alignment = { horizontal: "center" };
    if (typeof v === "number" && nombre.startsWith("Cumplimiento")) c.numFmt = "0.0%";
    else if (typeof v === "number") c.numFmt = "#,##0";
    for (let x = col; x <= col + 5; x += 1) {
      hoja.getCell(f, x).fill = relleno(MARFIL);
      hoja.getCell(f + 1, x).fill = relleno(MARFIL);
    }
    hoja.getRow(f + 1).height = 26;
  });
}

// Tabla con encabezado; devuelve las filas (base 1) de datos para las graficas.
function tabla(hoja, fila, tituloTabla, columnas, filas, col = 2) {
  const t = hoja.getCell(fila, col);
  t.value = tituloTabla;
  t.font = { bold: true, size: 12, color: { argb: AZUL } };
  hoja.getCell(fila, col).border = { bottom: { style: "medium", color: { argb: DORADO } } };
  columnas.forEach((c, i) => {
    const celda = hoja.getCell(fila + 1, col + i);
    celda.value = c.titulo;
    base.encabezado(celda, c.color ? { fondo: `FF${c.color}` } : {});
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

function hojaEstadisticas(libro, cifras) {
  const NOMBRE = "ESTADÍSTICAS";
  const hoja = libro.addWorksheet(NOMBRE, { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  hoja.getColumn(1).width = 3;
  hoja.getColumn(2).width = 34;
  for (let c = 3; c <= 8; c += 1) hoja.getColumn(c).width = 13;
  for (let c = 9; c <= 20; c += 1) hoja.getColumn(c).width = 9.5;
  base.titulo(hoja, "B1:T1", "ESTADÍSTICAS SALUD INTEGRAL", `Periodo ${cifras.periodo} · años anteriores tomados de los informes históricos · resaltado en amarillo: datos registrados en Conecta BU`);

  const graficas = [];
  const alto = (filasTabla) => Math.max(filasTabla + 3, 18);
  let fila = 4;

  // 1. Impacto poblacional (historico + Conecta BU).
  const impacto = tabla(
    hoja,
    fila,
    "IMPACTO POBLACIONAL",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      ...ORDEN_POBLACION.map((p) => ({ titulo: ETIQUETAS[p], valor: (f) => f[p] || 0, color: COLORES_POBLACION[p] })),
      { titulo: "Total", valor: (f) => f.total, negrita: true },
    ],
    cifras.impacto
  );
  if (cifras.impacto.length) {
    graficas.push({
      tipo: "barras",
      titulo: "Impacto poblacional por periodo",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.impacto.length) },
      categorias: { ref: rango(NOMBRE, 2, impacto.desde, 2, impacto.hasta), valores: cifras.impacto.map((f) => String(f.periodo)) },
      series: ORDEN_POBLACION.map((p, i) => ({
        nombre: ETIQUETAS[p],
        ref: rango(NOMBRE, 3 + i, impacto.desde, 3 + i, impacto.hasta),
        valores: cifras.impacto.map((f) => f[p] || 0),
        color: COLORES_POBLACION[p],
      })),
      ejeY: "Personas atendidas",
    });
  }
  fila = Math.max(impacto.siguiente, fila + alto(cifras.impacto.length)) + 1;

  // 2. Poblacion atendida en el periodo (torta).
  const poblacion = tabla(
    hoja,
    fila,
    `POBLACIÓN ATENDIDA ${cifras.periodo}`,
    [
      { titulo: "Población", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
      { titulo: "Porcentaje", valor: (f) => f.porcentaje, pct: true },
    ],
    cifras.porPoblacion
  );
  graficas.push({
    tipo: "torta",
    titulo: `Población atendida ${cifras.periodo}`,
    desde: { col: 9, fila: fila - 1 },
    hasta: { col: 16, fila: fila - 1 + 16 },
    categorias: { ref: rango(NOMBRE, 2, poblacion.desde, 2, poblacion.hasta), valores: cifras.porPoblacion.map((p) => p.nombre) },
    series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, poblacion.desde, 3, poblacion.hasta), valores: cifras.porPoblacion.map((p) => p.total) }],
    colores: cifras.porPoblacion.map((p) => COLORES_POBLACION[p.clave]),
  });
  fila += 18;

  // 3. Atencion servicio de enfermeria por periodo.
  const enf = tabla(
    hoja,
    fila,
    "ATENCIÓN SERVICIO DE ENFERMERÍA",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      { titulo: "Población atendida", valor: (f) => f.total },
    ],
    cifras.enfermeria.map((f) => ({ ...f, resaltar: !/^\d{4}$/.test(String(f.periodo)) }))
  );
  if (cifras.enfermeria.length) {
    graficas.push({
      tipo: "barras",
      titulo: "Atención servicio de enfermería",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.enfermeria.length) },
      categorias: { ref: rango(NOMBRE, 2, enf.desde, 2, enf.hasta), valores: cifras.enfermeria.map((f) => String(f.periodo)) },
      series: [{ nombre: "Población atendida", ref: rango(NOMBRE, 3, enf.desde, 3, enf.hasta), valores: cifras.enfermeria.map((f) => f.total), color: "0D9488" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  fila = Math.max(enf.siguiente, fila + alto(cifras.enfermeria.length)) + 1;

  // 4. Poblacion general por periodo.
  const general = tabla(
    hoja,
    fila,
    "POBLACIÓN GENERAL ATENDIDA",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      { titulo: "Población general", valor: (f) => f.total },
    ],
    cifras.poblacionGeneral.map((f) => ({ ...f, resaltar: !/^\d{4}$/.test(String(f.periodo)) }))
  );
  if (cifras.poblacionGeneral.length) {
    graficas.push({
      tipo: "lineas",
      titulo: `Población general frente a años anteriores`,
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.poblacionGeneral.length) },
      categorias: { ref: rango(NOMBRE, 2, general.desde, 2, general.hasta), valores: cifras.poblacionGeneral.map((f) => String(f.periodo)) },
      series: [{ nombre: "Población general", ref: rango(NOMBRE, 3, general.desde, 3, general.hasta), valores: cifras.poblacionGeneral.map((f) => f.total), color: "163F86" }],
      leyenda: false,
    });
  }
  fila = Math.max(general.siguiente, fila + alto(cifras.poblacionGeneral.length)) + 1;

  // 5. Asistencia poblacion objeto (programas).
  const objeto = tabla(
    hoja,
    fila,
    `ASISTENCIA POBLACIÓN OBJETO ${cifras.periodo}`,
    [
      { titulo: "Población / programa", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
    ],
    cifras.asistenciaObjeto
  );
  if (cifras.asistenciaObjeto.length) {
    graficas.push({
      tipo: "barrasHorizontales",
      titulo: "Asistencia población objeto",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + Math.max(cifras.asistenciaObjeto.length + 4, 18) },
      categorias: { ref: rango(NOMBRE, 2, objeto.desde, 2, objeto.hasta), valores: cifras.asistenciaObjeto.map((f) => f.nombre) },
      series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, objeto.desde, 3, objeto.hasta), valores: cifras.asistenciaObjeto.map((f) => f.total), color: "163F86" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  fila = Math.max(objeto.siguiente, fila + Math.max(cifras.asistenciaObjeto.length + 4, 18)) + 1;

  // 6. Atenciones por linea de accion.
  const lineas = tabla(
    hoja,
    fila,
    `ATENCIONES POR LÍNEA DE ACCIÓN ${cifras.periodo}`,
    [
      { titulo: "Línea de acción", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
    ],
    cifras.porCategoria
  );
  if (cifras.porCategoria.length) {
    graficas.push({
      tipo: "barrasHorizontales",
      titulo: "Atenciones por línea de acción",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + 14 },
      categorias: { ref: rango(NOMBRE, 2, lineas.desde, 2, lineas.hasta), valores: cifras.porCategoria.map((f) => f.nombre) },
      series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, lineas.desde, 3, lineas.hasta), valores: cifras.porCategoria.map((f) => f.total), color: "E8B23A" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  return { [NOMBRE]: graficas };
}

async function generarExcel(informe, cifras, leerArchivo) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU";
  libro.created = new Date();
  const logo = leerLogo();
  const idLogo = logo ? libro.addImage({ buffer: logo, extension: "png" }) : null;
  hojaProyecto(libro, informe, idLogo);
  hojaEvaluacion(libro, informe, cifras, idLogo);
  base.hojaAtendidos(libro, cifras.periodo, cifras.matriz);
  const graficas = hojaEstadisticas(libro, cifras);
  await base.hojaFotografica(libro, cifras.periodo, cifras.evidencias, leerArchivo);
  const buffer = await libro.xlsx.writeBuffer();
  return agregarGraficas(Buffer.from(buffer), graficas);
}

module.exports = { generarExcel, fechaLarga };
