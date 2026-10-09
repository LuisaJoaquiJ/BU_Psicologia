// Archivos Excel del modulo Salud integral: informe de gestion (INFBI-002),
// plantilla SNIES "Actividad de bienestar" y registro general de atenciones.
const ExcelJS = require("exceljs");
const { CATEGORIAS, TIPOS_DOCUMENTO, EXAMENES_LABORALES } = require("./catalogos");
const { fechaISO, cargoRegistro } = require("./reportes.datos");

const AZUL = "FF0B2A5B";
const DORADO = "FFE8B23A";
const MARFIL = "FFFBF7EE";
const GRIS = "FF5B6478";
const BORDE = { style: "thin", color: { argb: "FFD5DBE8" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const SEMAFORO = { verde: "FFC8EBD9", amarillo: "FFFBE6B0", rojo: "FFF6CACA" };

function encabezado(celda, { fondo = AZUL, color = "FFFFFFFF", rotar = false } = {}) {
  celda.font = { bold: true, color: { argb: color }, size: 9 };
  celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo } };
  celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true, ...(rotar ? { textRotation: 90 } : {}) };
  celda.border = BORDES;
}

function titulo(hoja, rango, texto, subtitulo) {
  hoja.mergeCells(rango);
  const celda = hoja.getCell(rango.split(":")[0]);
  celda.value = texto;
  celda.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  celda.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(celda.row).height = 30;
  if (subtitulo) {
    const sig = hoja.getCell(celda.row + 1, celda.col);
    sig.value = subtitulo;
    sig.font = { italic: true, size: 9, color: { argb: GRIS } };
  }
}

// Ancho y alto de una imagen PNG o JPEG (para no deformarla en el Excel).
function dimensiones(buffer) {
  try {
    if (buffer.readUInt32BE(0) === 0x89504e47) return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20) };
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2;
      while (i < buffer.length) {
        if (buffer[i] !== 0xff) return null;
        const marca = buffer[i + 1];
        const largo = buffer.readUInt16BE(i + 2);
        if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
          return { alto: buffer.readUInt16BE(i + 5), ancho: buffer.readUInt16BE(i + 7) };
        }
        i += 2 + largo;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Informe de gestion
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SNIES
// ---------------------------------------------------------------------------

function hojaPlana(libro, nombre, columnas, filas) {
  const hoja = libro.addWorksheet(nombre);
  hoja.columns = columnas.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  hoja.getRow(1).font = { bold: true };
  for (const f of filas) hoja.addRow(f);
  return hoja;
}

async function generarSnies(snies) {
  const libro = new ExcelJS.Workbook();
  hojaPlana(
    libro,
    "ACTIVIDAD_BIENESTAR",
    [
      "AÑO",
      "SEMESTRE",
      "CODIGO_UNIDAD_ORGANIZACIONAL",
      "CODIGO_ACTIVIDAD",
      "DESCRIPCION_ACTIVIDAD",
      "ID_TIPO_ACTIVIDAD_BIENESTAR",
      "FECHA_INICIO",
      "FECHA_FINAL",
      "ID_FUENTE_NACIONAL",
      "VLR_FINANCIACION_NACIONAL",
      "ID_PAIS_FINANCIADOR",
      "NOMBRE_ENTIDAD_FTE_INTERNAC",
      "ID_FUENTE_INTERNACIONAL",
      "VLR_FINANCIACION_INTERNACIONAL",
    ],
    snies.actividades.map((a) => ({
      ...a,
      FECHA_INICIO: a.FECHA_INICIO ? new Date(`${a.FECHA_INICIO}T00:00:00Z`) : null,
      FECHA_FINAL: a.FECHA_FINAL ? new Date(`${a.FECHA_FINAL}T00:00:00Z`) : null,
    }))
  ).getColumn(5).width = 60;
  const hojaAct = libro.getWorksheet("ACTIVIDAD_BIENESTAR");
  hojaAct.getColumn(7).numFmt = "yyyy-mm-dd";
  hojaAct.getColumn(8).numFmt = "yyyy-mm-dd";
  hojaPlana(
    libro,
    "ACT_BIENESTAR_BENEFICIARIOS",
    ["AÑO", "SEMESTRE", "CODIGO_UNIDAD_ORGANIZACIONAL", "CODIGO_ACTIVIDAD", "ID_TIPO_BENEFICIARIO", "CANTIDAD_BENEFICIARIOS"],
    snies.beneficiarios
  );
  hojaPlana(
    libro,
    "ACT_BIENESTAR_REC_HUMANO",
    ["AÑO", "SEMESTRE", "CODIGO_ACTIVIDAD", "CODIGO_UNIDAD_ORGANIZACIONAL", "ID_TIPO_DOCUMENTO", "NUM_DOCUMENTO", "DEDICACION"],
    snies.recursoHumano
  );
  const info = libro.addWorksheet("INFO");
  info.addRows([
    ["Información de Control. No editar, mover"],
    ["Nombre de la Plantilla", "Actividad de bienestar"],
    ["Descripción de la Plantilla", "Actividad de Bienestar"],
    ["Código de la Plantilla", 92],
  ]);
  info.getColumn(1).width = 34;
  info.getColumn(2).width = 28;
  return libro.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Registro general (formato SPADIEZ) y atenciones de enfermeria
// ---------------------------------------------------------------------------

async function generarRegistro(atenciones, { desde, hasta }) {
  const libro = new ExcelJS.Workbook();
  const general = libro.addWorksheet("REGISTRO GENERAL", { views: [{ state: "frozen", ySplit: 1 }] });
  general.columns = [
    { header: "APELLIDOS", key: "apellidos", width: 24 },
    { header: "NOMBRES", key: "nombres", width: 22 },
    { header: "TIPO DE DOCUMENTO", key: "tipo", width: 22 },
    { header: "Nº DE DOCUMENTO", key: "documento", width: 16 },
    { header: "CÓDIGO ESTUDIANTIL", key: "codigo", width: 14 },
    { header: "TELEFONO", key: "telefono", width: 14 },
    { header: "CARGO", key: "cargo", width: 34 },
    { header: "POBLACIÓN", key: "poblacion", width: 14 },
    { header: "FECHA", key: "fecha", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "TIPO DE ACTIVIDAD", key: "actividad", width: 34 },
    { header: "MEDICO LABORAL", key: "laboral", width: 16 },
    { header: "TIPO DE INSUMO", key: "insumo", width: 20 },
    { header: "REGISTRADO POR", key: "registro", width: 22 },
  ];
  for (const at of atenciones) {
    general.addRow({
      apellidos: (at.persona?.apellidos || "").toUpperCase(),
      nombres: (at.persona?.nombres || "").toUpperCase(),
      tipo: (TIPOS_DOCUMENTO[at.persona?.tipoDocumento] || "").toUpperCase(),
      documento: at.persona?.numeroDocumento,
      codigo: at.persona?.codigoEstudiantil || "",
      telefono: at.persona?.telefono || "",
      cargo: cargoRegistro(at.poblacion, at.programa),
      poblacion: at.poblacion,
      fecha: new Date(at.fecha),
      actividad: (at.actividad?.nombre || "").toUpperCase(),
      laboral: at.examenLaboral ? EXAMENES_LABORALES[at.examenLaboral].toUpperCase() : "",
      insumo: at.insumo || "",
      registro: at.registradoPor?.nombre || (at.origen === "importado" ? "Importado de Excel" : ""),
    });
  }
  estiloTabla(general);

  const clinicas = atenciones.filter((at) => at.actividad?.clinica || at.tensionArterial || at.descripcion);
  const enfermeria = libro.addWorksheet("ATENCIÓN ENFERMERÍA", { views: [{ state: "frozen", ySplit: 1 }] });
  enfermeria.columns = [
    { header: "FECHA DE LA ATENCIÓN", key: "fecha", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "APELLIDOS", key: "apellidos", width: 22 },
    { header: "NOMBRES", key: "nombres", width: 20 },
    { header: "DOCUMENTO", key: "documento", width: 15 },
    { header: "TELÉFONO", key: "telefono", width: 13 },
    { header: "PROGRAMA / CARGO", key: "cargo", width: 32 },
    { header: "TIPO DE ATENCIÓN", key: "actividad", width: 24 },
    { header: "TIPO DE INSUMO", key: "insumo", width: 18 },
    { header: "TENSIÓN ARTERIAL", key: "ta", width: 11 },
    { header: "FRECUENCIA CARDIACA", key: "fc", width: 11 },
    { header: "FRECUENCIA RESPIRATORIA", key: "fr", width: 12 },
    { header: "PESO (kg)", key: "peso", width: 9 },
    { header: "TALLA (cm)", key: "talla", width: 9 },
    { header: "GLUCOMETRÍA", key: "gluco", width: 11 },
    { header: "DESCRIPCIÓN BREVE DEL EVENTO", key: "descripcion", width: 50 },
    { header: "REMITIDO", key: "remitido", width: 10 },
  ];
  for (const at of clinicas) {
    enfermeria.addRow({
      fecha: new Date(at.fecha),
      apellidos: at.persona?.apellidos,
      nombres: at.persona?.nombres,
      documento: at.persona?.numeroDocumento,
      telefono: at.persona?.telefono || "",
      cargo: cargoRegistro(at.poblacion, at.programa),
      actividad: at.actividad?.nombre,
      insumo: at.insumo || "",
      ta: at.tensionArterial || "",
      fc: at.frecuenciaCardiaca ?? "",
      fr: at.frecuenciaRespiratoria ?? "",
      peso: at.pesoKg ?? "",
      talla: at.tallaCm ?? "",
      gluco: at.glucometria || "",
      descripcion: at.descripcion || "",
      remitido: at.remitido ? "SÍ" : "",
    });
  }
  estiloTabla(enfermeria);
  enfermeria.getColumn("descripcion").alignment = { wrapText: true, vertical: "top" };

  const info = libro.addWorksheet("INFO");
  info.addRows([
    ["Conecta BU · Salud integral"],
    ["Registro de atenciones", `${desde || "inicio"} a ${hasta || "hoy"}`],
    ["Generado", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })],
    ["Aviso", "Contiene datos personales y de salud (Ley 1581 de 2012). Uso exclusivo de la Unidad de Salud Integral."],
  ]);
  info.getColumn(1).width = 26;
  info.getColumn(2).width = 90;
  return libro.xlsx.writeBuffer();
}

function estiloTabla(hoja) {
  const cab = hoja.getRow(1);
  cab.eachCell((celda) => encabezado(celda));
  cab.height = 32;
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(hoja.rowCount, 1), column: hoja.columnCount } };
}

module.exports = {
  generarSnies,
  generarRegistro,
  dimensiones,
  CATEGORIAS,
  hojaAtendidos,
  hojaFotografica,
  encabezado,
  titulo,
  BORDES,
  AZUL,
  DORADO,
  MARFIL,
  GRIS,
  SEMAFORO,
};
