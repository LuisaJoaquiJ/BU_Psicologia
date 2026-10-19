const fs = require("fs");
const PDFDocument = require("pdfkit");
const { NOMBRE_PROYECTO } = require("../../utils/informe/plantilla");
const { C, MARGEN, ALTO_ENCABEZADO, ALTO_PIE, RUTA_LOGO } = require("./formatoPdf");

// Base del PDF del informe de gestion: pagina A4 con espacio para el
// encabezado institucional, titulos, parrafos y tablas que repiten el
// encabezado al saltar de pagina. Usa las fuentes estandar de PDF.
class PdfInformeBase {
  constructor(informe) {
    this.doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGEN + ALTO_ENCABEZADO, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN },
      bufferPages: true,
      info: { Title: `Informe de gestión ${NOMBRE_PROYECTO[informe.modulo] || ""} ${informe.periodo}`, Author: "Conecta BU · Uniautónoma del Cauca" },
    });
    const partes = [];
    this.doc.on("data", (p) => partes.push(p));
    this.fin = new Promise((resolve) => this.doc.on("end", () => resolve(Buffer.concat(partes))));
    try {
      this.logo = fs.readFileSync(RUTA_LOGO);
    } catch {
      this.logo = null;
    }
  }

  ancho() {
    return this.doc.page.width - MARGEN * 2;
  }

  limite() {
    return this.doc.page.height - MARGEN - ALTO_PIE;
  }

  asegurar(alto) {
    if (this.doc.y + alto > this.limite()) this.doc.addPage();
  }

  nuevaPagina(layout = "portrait") {
    this.doc.addPage({ size: "A4", layout, margins: { top: MARGEN + ALTO_ENCABEZADO, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN } });
  }

  tituloSeccion(texto, subtitulo) {
    this.asegurar(60);
    this.doc.moveDown(0.4);
    const y = this.doc.y;
    this.doc.rect(MARGEN, y, this.ancho(), 20).fill(C.azul);
    this.doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text(texto, MARGEN + 8, y + 5.5, { width: this.ancho() - 16, lineBreak: false });
    this.doc.y = y + 26;
    if (subtitulo) {
      this.doc.font("Helvetica").fontSize(8.5).fillColor(C.gris).text(subtitulo, MARGEN, this.doc.y, { width: this.ancho() });
      this.doc.moveDown(0.4);
    }
  }

  subtitulo(texto, espacio = 0) {
    this.asegurar(40 + espacio);
    this.doc.moveDown(0.3);
    this.doc.font("Times-Bold").fontSize(13).fillColor(C.azul).text(texto, MARGEN, this.doc.y, { width: this.ancho() });
    const y = this.doc.y + 2;
    this.doc.rect(MARGEN, y, 30, 2).fill(C.dorado);
    this.doc.y = y + 8;
  }

  parrafo(texto, vacio = "Sin diligenciar.") {
    const t = String(texto || "").trim();
    this.doc
      .font(t ? "Helvetica" : "Helvetica-Oblique")
      .fontSize(9.5)
      .fillColor(t ? C.tinta : C.gris)
      .text(t || vacio, MARGEN, this.doc.y, { width: this.ancho(), align: "justify", lineGap: 2 });
    this.doc.moveDown(0.6);
  }

  tabla(columnas, filas, { total, tam = 8, estilos } = {}) {
    const anchoTotal = columnas.reduce((a, c) => a + c.ancho, 0);
    const escala = this.ancho() / anchoTotal;
    const cols = columnas.map((c) => ({ ...c, w: c.ancho * escala }));
    const pad = 4;
    const encabezado = () => {
      this.doc.font("Helvetica-Bold").fontSize(tam);
      const alto = Math.max(...cols.map((c) => this.doc.heightOfString(c.titulo, { width: c.w - pad * 2 }))) + pad * 2;
      this.asegurar(alto + 30);
      const y = this.doc.y;
      this.doc.rect(MARGEN, y, this.ancho(), alto).fill(C.azul);
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
    const fila = (f, i, negrita) => {
      this.doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(tam);
      const textos = cols.map((c) => {
        const v = c.valor(f);
        return v === null || v === undefined ? "" : String(v);
      });
      const alto = Math.max(...cols.map((c, j) => this.doc.heightOfString(textos[j] || " ", { width: c.w - pad * 2 }))) + pad * 2;
      if (this.doc.y + alto > this.limite()) {
        this.doc.addPage({ size: "A4", layout: this.doc.page.layout, margins: this.doc.page.margins });
        encabezado();
        this.doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(tam);
      }
      const y = this.doc.y;
      if (negrita || i % 2 === 1) this.doc.rect(MARGEN, y, this.ancho(), alto).fill(C.marfil);
      let x = MARGEN;
      cols.forEach((c, j) => {
        const fondo = estilos?.(c, f);
        if (fondo) this.doc.rect(x, y, c.w, alto).fill(fondo);
        this.doc.fillColor(C.tinta).text(textos[j], x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      });
      this.doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + this.ancho(), y + alto).lineWidth(0.4).strokeColor(negrita ? C.azul : C.borde).stroke();
      this.doc.y = y + alto;
    };
    filas.forEach((f, i) => fila(f, i, false));
    if (total) fila(total, 0, true);
    this.doc.moveDown(0.6);
  }
}

module.exports = { PdfInformeBase };
