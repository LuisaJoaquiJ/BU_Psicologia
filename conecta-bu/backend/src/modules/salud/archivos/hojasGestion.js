const { fechaISO } = require("../utils/reportesDatos");
const { AZUL, MARFIL, GRIS, BORDES, SEMAFORO, encabezado, titulo, dimensiones } = require("./estiloExcel");

// Hojas del informe de gestion INFBI-002: matriz de atendidos y registro
// fotografico (las usa tambien el informe para el superadministrador).

function hojaAtendidos(libro, periodo, matriz) {
  const hoja = libro.addWorksheet("ATENDIDOS", {
    views: [{ state: "frozen", xSplit: 6, ySplit: 3 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const fijas = ["AÑO", "SEMESTRE", "CÓDIGO", "ACTIVIDAD", "ACTIVIDAD / JORNADA", "FECHA DE EJECUCIÓN"];
  const finales = ["TOTAL", "META", "LOGRO", "CUMPLIMIENTO", "AVANCES", "DIFICULTADES", "APRENDIZAJES", "PRESUPUESTO EJECUTADO", "PENDIENTES", "OBSERVACIONES"];
  const nCols = fijas.length + matriz.columnas.length + finales.length;
  const colConteo = fijas.length + 1;
  const colTotal = colConteo + matriz.columnas.length;

  titulo(hoja, `A1:${hoja.getColumn(nCols).letter}1`, `INFORME RELACIÓN ATENDIDOS · SALUD INTEGRAL · ${periodo}`);

  // Fila 2: grupos; fila 3: titulos de columna.
  fijas.forEach((t, i) => {
    hoja.mergeCells(2, i + 1, 3, i + 1);
    hoja.getCell(2, i + 1).value = t;
    encabezado(hoja.getCell(2, i + 1));
  });
  let col = colConteo;
  const grupos = [];
  for (const c of matriz.columnas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.grupo === c.grupo) ultimo.hasta = col;
    else grupos.push({ grupo: c.grupo, desde: col, hasta: col });
    const celda = hoja.getCell(3, col);
    celda.value = c.titulo;
    encabezado(celda, { fondo: c.grupo.startsWith("ESTUDIANTES") ? "FF163F86" : AZUL, rotar: true });
    col += 1;
  }
  for (const g of grupos) {
    // Grupos de una sola columna (ADMIN, DOCENTES...) ocupan las dos filas.
    if (g.hasta > g.desde) hoja.mergeCells(2, g.desde, 2, g.hasta);
    else hoja.mergeCells(2, g.desde, 3, g.desde);
    const celda = hoja.getCell(2, g.desde);
    celda.value = g.grupo;
    encabezado(celda, { rotar: g.hasta === g.desde });
  }
  finales.forEach((t, i) => {
    hoja.mergeCells(2, colTotal + i, 3, colTotal + i);
    hoja.getCell(2, colTotal + i).value = t;
    encabezado(hoja.getCell(2, colTotal + i), { fondo: i < 4 ? "FF9A6B07" : AZUL });
  });
  hoja.getRow(3).height = 150;
  hoja.getRow(2).height = 30;

  const [anio, semestre] = periodo.split("-");
  let fila = 4;
  let inicioCategoria = 4;
  matriz.filas.forEach((f, i) => {
    const r = hoja.getRow(fila);
    const valores = [Number(anio), semestre === "1" ? "I" : "II", f.codigo, f.categoria, f.actividad, f.fecha];
    valores.forEach((v, j) => (r.getCell(j + 1).value = v));
    matriz.columnas.forEach((c, j) => (r.getCell(colConteo + j).value = f.conteo[c.clave]));
    r.getCell(colTotal).value = f.total;
    r.getCell(colTotal).font = { bold: true };
    if (f.primeraFila) {
      r.getCell(colTotal + 1).value = f.meta;
      r.getCell(colTotal + 2).value = f.logro;
      const cumplimiento = r.getCell(colTotal + 3);
      cumplimiento.value = f.cumplimiento === null ? null : f.cumplimiento / 100;
      cumplimiento.numFmt = "0%";
      if (f.semaforo) cumplimiento.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SEMAFORO[f.semaforo] } };
      r.getCell(colTotal + 4).value = f.avances;
      r.getCell(colTotal + 5).value = f.dificultades;
      r.getCell(colTotal + 6).value = f.aprendizajes;
      r.getCell(colTotal + 7).value = f.presupuesto;
      r.getCell(colTotal + 7).numFmt = '"$"#,##0';
      r.getCell(colTotal + 8).value = f.pendientes;
      r.getCell(colTotal + 9).value = f.observaciones;
    }
    r.eachCell({ includeEmpty: true }, (celda, n) => {
      if (n > nCols) return;
      celda.border = BORDES;
      celda.font = { ...(celda.font || {}), size: 9 };
      celda.alignment = { vertical: "top", wrapText: n >= colTotal + 4 || n === 4 || n === 5 };
    });
    // Categoria combinada verticalmente, como en el formato original.
    const siguiente = matriz.filas[i + 1];
    if (!siguiente || siguiente.categoria !== f.categoria) {
      if (fila > inicioCategoria) hoja.mergeCells(inicioCategoria, 4, fila, 4);
      hoja.getCell(inicioCategoria, 4).alignment = { vertical: "middle", wrapText: true };
      hoja.getCell(inicioCategoria, 4).font = { bold: true, size: 9, color: { argb: AZUL } };
      inicioCategoria = fila + 1;
    }
    fila += 1;
  });

  if (!matriz.filas.length) {
    hoja.getCell(4, 1).value = "Sin atenciones registradas en el periodo.";
    hoja.getCell(4, 1).font = { italic: true, color: { argb: GRIS } };
  } else {
    const r = hoja.getRow(fila);
    r.getCell(5).value = "TOTAL";
    matriz.columnas.forEach((c, j) => (r.getCell(colConteo + j).value = matriz.totales[c.clave]));
    r.getCell(colTotal).value = matriz.total;
    r.eachCell({ includeEmpty: true }, (celda, n) => {
      if (n > colTotal) return;
      celda.font = { bold: true, size: 9 };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARFIL } };
      celda.border = BORDES;
    });
  }

  hoja.getColumn(1).width = 6;
  hoja.getColumn(2).width = 6;
  hoja.getColumn(3).width = 7;
  hoja.getColumn(4).width = 24;
  hoja.getColumn(5).width = 34;
  hoja.getColumn(6).width = 23;
  for (let c = colConteo; c < colTotal; c += 1) hoja.getColumn(c).width = 5;
  hoja.getColumn(colTotal).width = 8;
  [7, 7, 11, 34, 34, 34, 13, 26, 30].forEach((w, i) => (hoja.getColumn(colTotal + 1 + i).width = w));
}

async function hojaFotografica(libro, periodo, evidencias, leerArchivo) {
  const hoja = libro.addWorksheet("REGISTRO FOTOGRÁFICO");
  hoja.getColumn(1).width = 3;
  hoja.getColumn(2).width = 52;
  hoja.getColumn(3).width = 3;
  hoja.getColumn(4).width = 52;
  titulo(hoja, "B1:D1", `REGISTRO FOTOGRÁFICO · SALUD INTEGRAL · ${periodo}`);

  const fotos = evidencias.filter((e) => ["image/jpeg", "image/png"].includes(e.tipoMime)).slice(0, 60);
  const otros = evidencias.filter((e) => !["image/jpeg", "image/png"].includes(e.tipoMime));
  let fila = 3;
  for (let i = 0; i < fotos.length; i += 2) {
    const par = fotos.slice(i, i + 2);
    let altoFila = 0;
    for (const [j, e] of par.entries()) {
      const buffer = await leerArchivo(e).catch(() => null);
      if (!buffer) continue;
      const dim = dimensiones(buffer) || { ancho: 4, alto: 3 };
      const ancho = 360;
      const alto = Math.round((ancho * dim.alto) / dim.ancho) || 270;
      altoFila = Math.max(altoFila, Math.min(alto, 420));
      const id = libro.addImage({ buffer, extension: e.tipoMime === "image/png" ? "png" : "jpeg" });
      hoja.addImage(id, { tl: { col: j === 0 ? 1 : 3, row: fila - 1 }, ext: { width: ancho, height: Math.min(alto, 420) } });
      const pie = hoja.getCell(fila + 1, j === 0 ? 2 : 4);
      const actividad = typeof e.actividad === "string" ? e.actividad : e.actividad?.nombre || "";
      pie.value = `${actividad} · ${String(fechaISO(e.fecha)).slice(0, 10)}${e.descripcion ? ` · ${e.descripcion}` : ""}`;
      pie.font = { size: 9, italic: true, color: { argb: GRIS } };
      pie.alignment = { wrapText: true, vertical: "top" };
    }
    hoja.getRow(fila).height = (altoFila || 270) * 0.75;
    hoja.getRow(fila + 1).height = 30;
    fila += 3;
  }
  if (!fotos.length) {
    hoja.getCell(3, 2).value = "No hay fotos cargadas como evidencia en este periodo.";
    hoja.getCell(3, 2).font = { italic: true, color: { argb: GRIS } };
    fila = 5;
  }
  if (otros.length) {
    hoja.getCell(fila, 2).value = "Otros soportes (PDF y otros formatos, disponibles en Conecta BU)";
    hoja.getCell(fila, 2).font = { bold: true, color: { argb: AZUL } };
    otros.forEach((e, k) => {
      const actividad = typeof e.actividad === "string" ? e.actividad : e.actividad?.nombre || "";
      hoja.getCell(fila + 1 + k, 2).value = `${e.nombreArchivo} — ${actividad} (${String(fechaISO(e.fecha)).slice(0, 10)})`;
    });
  }
}

module.exports = { hojaAtendidos, hojaFotografica };
