const ExcelJS = require("exceljs");

// Base de los Excel de Deporte: un libro con hojas de encabezado azul,
// primera fila fija y filtro.
class LibroExcel {
  constructor() {
    this.libro = new ExcelJS.Workbook();
    this.libro.creator = "Conecta BU";
  }

  // columnas: [{ titulo, clave, ancho, valor: (fila) => ... }]
  hoja(nombre, columnas, filas) {
    const h = this.libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
    h.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho || 16 }));
    this.estiloEncabezado(h.getRow(1));
    for (const f of filas) h.addRow(Object.fromEntries(columnas.map((c) => [c.clave, c.valor(f)])));
    if (filas.length) h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
    return h;
  }

  estiloEncabezado(fila) {
    fila.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2A5B" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    fila.height = 28;
  }

  // Resalta la celda "clave" de las filas cuyo valor es "valor".
  resaltar(hoja, clave, valor, argb) {
    hoja.eachRow((r, n) => {
      if (n > 1 && r.getCell(clave).value === valor) r.getCell(clave).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    });
  }

  async buffer() {
    return Buffer.from(await this.libro.xlsx.writeBuffer());
  }
}

module.exports = { LibroExcel };
