// Estilo comun de los Excel de Salud integral (colores institucionales,
// encabezados, titulos y tablas) y medidas de las fotos.

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

function hojaPlana(libro, nombre, columnas, filas) {
  const hoja = libro.addWorksheet(nombre);
  hoja.columns = columnas.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  hoja.getRow(1).font = { bold: true };
  for (const f of filas) hoja.addRow(f);
  return hoja;
}

function estiloTabla(hoja) {
  const cab = hoja.getRow(1);
  cab.eachCell((celda) => encabezado(celda));
  cab.height = 32;
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(hoja.rowCount, 1), column: hoja.columnCount } };
}

module.exports = { AZUL, DORADO, MARFIL, GRIS, BORDE, BORDES, SEMAFORO, encabezado, titulo, dimensiones, hojaPlana, estiloTabla };
