const { AZUL, MARFIL, GRIS, BORDES } = require("../estiloExcel");
const { FORMATO } = require("../../utils/informe/plantilla");
const { relleno, altoTexto, encabezadoInstitucional, bloqueTexto } = require("./formatoExcel");

// Hojas PROYECTO e INFORME - EVALUACIÓN del informe de gestion.

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

module.exports = { hojaProyecto, hojaEvaluacion };
