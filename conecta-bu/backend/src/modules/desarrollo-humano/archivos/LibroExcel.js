const ExcelJS = require("exceljs");
const { XLS } = require("./formato");

// Libro de Excel con hojas de tabla: titulo, nota, encabezado institucional,
// filtros, filas alternas, totales y barras de datos en las tasas (los
// porcentajes quedan como numeros con formato %, para seguir calculando).
class LibroExcel {
  constructor(titulo, fecha = new Date()) {
    this.libro = new ExcelJS.Workbook();
    this.libro.creator = "Conecta BU";
    this.libro.created = fecha;
    this.libro.title = titulo;
  }

  hojaTabla(nombre, { titulo, nota, columnas, filas, totales }) {
    const hoja = this.libro.addWorksheet(nombre, { properties: { tabColor: { argb: XLS.AZUL } } });
    hoja.columns = columnas.map((c) => ({ key: c.clave, width: c.ancho || 16 }));

    hoja.getCell("A1").value = titulo;
    hoja.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: XLS.AZUL } };
    if (nota) {
      hoja.getCell("A2").value = nota;
      hoja.getCell("A2").font = { size: 10, italic: true, color: { argb: XLS.GRIS } };
    }

    const filaEncabezado = hoja.getRow(4);
    columnas.forEach((c, i) => {
      const celda = filaEncabezado.getCell(i + 1);
      celda.value = c.titulo;
      celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS.AZUL } };
      celda.alignment = { vertical: "middle", wrapText: true };
    });
    filaEncabezado.height = 30;

    filas.forEach((dato, i) => {
      const fila = hoja.getRow(5 + i);
      columnas.forEach((c, j) => {
        const celda = fila.getCell(j + 1);
        const valor = dato[c.clave];
        celda.value = valor === null || valor === undefined ? (c.pct ? "—" : "") : valor;
        if (c.pct) {
          celda.numFmt = XLS.PCT;
          celda.alignment = { horizontal: "right" };
        }
      });
      if (i % 2 === 1) {
        fila.eachCell({ includeEmpty: true }, (celda) => {
          celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS.MARFIL } };
        });
      }
    });

    if (totales && filas.length) {
      const fila = hoja.getRow(5 + filas.length);
      columnas.forEach((c, j) => {
        const celda = fila.getCell(j + 1);
        const valor = totales[c.clave];
        celda.value = valor === null || valor === undefined ? "" : valor;
        if (c.pct) celda.numFmt = XLS.PCT;
        celda.font = { bold: true };
        celda.border = { top: { style: "thin", color: { argb: XLS.AZUL } } };
      });
    }

    if (filas.length) {
      hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: columnas.length } };
      // Barra de datos en las columnas de tasa para leerlas de un vistazo.
      columnas.forEach((c, j) => {
        if (!c.barra) return;
        const letra = hoja.getColumn(j + 1).letter;
        hoja.addConditionalFormatting({
          ref: `${letra}5:${letra}${4 + filas.length}`,
          rules: [{ type: "dataBar", minLength: 0, maxLength: 100, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FF0D9488" } }],
        });
      });
    } else {
      hoja.getCell("A5").value = "Sin datos en el periodo.";
      hoja.getCell("A5").font = { italic: true, color: { argb: XLS.GRIS } };
    }
    hoja.views = [{ state: "frozen", ySplit: 4 }];
    return hoja;
  }
  aBuffer() {
    return this.libro.xlsx.writeBuffer();
  }
}

module.exports = { LibroExcel };
