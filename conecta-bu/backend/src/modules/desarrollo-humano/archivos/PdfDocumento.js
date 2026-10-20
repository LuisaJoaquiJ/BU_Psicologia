const PDFDocument = require("pdfkit");

// Base de los PDF de Desarrollo Humano con la identidad visual de Conecta BU:
// pagina A4, titulos de seccion, leyendas, tablas que repiten el encabezado
// al saltar de pagina y pie con numero de pagina. Usa las fuentes estandar
// de PDF (Helvetica y Times), que ya incluyen tildes y la ñ.

const C = {
  azul: "#0B2A5B",
  azulSuave: "#163F86",
  dorado: "#E8B23A",
  doradoTexto: "#9A6B07",
  marfil: "#FBF7EE",
  borde: "#EDE5D3",
  tinta: "#0E1726",
  gris: "#5B6478",
  grisClaro: "#E5E7EB",
  Agendada: "#163F86",
  Atendida: "#0d9488",
  NoAsistio: "#d97706",
  Cancelada: "#CBD2DE",
};
const ETIQUETA = { Atendida: "Atendidas", NoAsistio: "No asistieron", Cancelada: "Canceladas", Agendada: "Agendadas" };
const MARGEN = 48;
const ALTO_PIE = 36;

const pct = (x) => (x === null || x === undefined ? "—" : `${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const num = (x) => (x === null || x === undefined ? "—" : x.toLocaleString("es-CO"));

class PdfDocumento {
  constructor(titulo) {
    this.doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGEN, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN },
      bufferPages: true,
      info: { Title: titulo, Author: "Conecta BU" },
    });
    this.ancho = this.doc.page.width - MARGEN * 2;
  }

  limiteInferior() {
    return this.doc.page.height - MARGEN - ALTO_PIE;
  }

  asegurar(alto) {
    if (this.doc.y + alto > this.limiteInferior()) this.doc.addPage();
  }

  tituloSeccion(texto, subtitulo) {
    this.asegurar(70);
    this.doc.moveDown(0.6);
    this.doc.font("Times-Bold").fontSize(17).fillColor(C.azul).text(texto, MARGEN, this.doc.y);
    const y = this.doc.y + 3;
    this.doc.rect(MARGEN, y, 36, 2.5).fill(C.dorado);
    this.doc.y = y + 9;
    if (subtitulo) {
      this.doc.font("Helvetica").fontSize(9).fillColor(C.gris).text(subtitulo, MARGEN, this.doc.y, { width: this.ancho });
      this.doc.moveDown(0.5);
    }
  }

  leyenda(claves, y, etiquetas = ETIQUETA) {
    let x = MARGEN;
    this.doc.font("Helvetica").fontSize(8.5);
    for (const k of claves) {
      this.doc.rect(x, y + 1, 8, 8).fill(C[k]);
      this.doc.fillColor(C.gris).text(etiquetas[k], x + 12, y, { lineBreak: false });
      x += 12 + this.doc.widthOfString(etiquetas[k]) + 16;
    }
    this.doc.y = y + 16;
  }

  tabla(columnas, filas, { total } = {}) {
    const anchoTotal = columnas.reduce((a, c) => a + c.ancho, 0);
    const escala = this.ancho / anchoTotal;
    const cols = columnas.map((c) => ({ ...c, w: c.ancho * escala }));
    const pad = 5;

    const encabezado = () => {
      this.doc.font("Helvetica-Bold").fontSize(8);
      const alto = Math.max(...cols.map((c) => this.doc.heightOfString(c.titulo, { width: c.w - pad * 2 }))) + pad * 2;
      this.asegurar(alto + 50);
      const y = this.doc.y;
      this.doc.rect(MARGEN, y, this.ancho, alto).fill(C.azul);
      let x = MARGEN;
      for (const c of cols) {
        this.doc.fillColor("#FFFFFF").text(c.titulo, x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      }
      this.doc.y = y + alto;
    };

    if (!filas.length) {
      this.doc.font("Helvetica-Oblique").fontSize(9).fillColor(C.gris).text("Sin datos en el periodo.", MARGEN, this.doc.y);
      this.doc.moveDown(0.5);
      return;
    }

    encabezado();
    const dibujarFila = (fila, i, negrita) => {
      this.doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const textos = cols.map((c) => {
        const v = fila[c.clave];
        return c.formato ? c.formato(v, fila) : v === null || v === undefined ? "" : String(v);
      });
      const alto = Math.max(...cols.map((c, j) => this.doc.heightOfString(textos[j], { width: c.w - pad * 2 }))) + pad * 2;
      if (this.doc.y + alto > this.limiteInferior()) {
        this.doc.addPage();
        encabezado();
        this.doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      }
      const y = this.doc.y;
      if (negrita) this.doc.rect(MARGEN, y, this.ancho, alto).fill(C.marfil);
      else if (i % 2 === 1) this.doc.rect(MARGEN, y, this.ancho, alto).fill(C.marfil);
      let x = MARGEN;
      cols.forEach((c, j) => {
        this.doc.fillColor(C.tinta).text(textos[j], x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      });
      this.doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + this.ancho, y + alto).lineWidth(0.5).strokeColor(negrita ? C.azul : C.borde).stroke();
      this.doc.y = y + alto;
    };
    filas.forEach((f, i) => dibujarFila(f, i, false));
    if (total) dibujarFila(total, 0, true);
    this.doc.moveDown(0.6);
  }

  // Pie de pagina en todas las paginas.
  pie(texto) {
    const rango = this.doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i += 1) {
      this.doc.switchToPage(i);
      const margenAnterior = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;
      const y = this.doc.page.height - MARGEN + 6;
      this.doc.moveTo(MARGEN, y - 8).lineTo(this.doc.page.width - MARGEN, y - 8).lineWidth(0.5).strokeColor(C.borde).stroke();
      this.doc.font("Helvetica").fontSize(7.5).fillColor(C.gris).text(texto, MARGEN, y, { lineBreak: false });
      this.doc.text(`Página ${i + 1} de ${rango.count}`, MARGEN, y, { width: this.ancho, align: "right", lineBreak: false });
      this.doc.page.margins.bottom = margenAnterior;
    }
  }

  // Cierra el documento y devuelve su contenido.
  aBuffer() {
    return new Promise((resolve, reject) => {
      const partes = [];
      this.doc.on("data", (d) => partes.push(d));
      this.doc.on("end", () => resolve(Buffer.concat(partes)));
      this.doc.on("error", reject);
      this.doc.end();
    });
  }
}

module.exports = { PdfDocumento, C, ETIQUETA, MARGEN, pct, num };
