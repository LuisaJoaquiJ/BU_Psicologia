const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Constancia de horas de deporte del estudiante (PDF A4).
const AZUL = "#0B2A5B";
const DORADO = "#E8B23A";
const GRIS = "#5B6478";
const TINTA = "#0E1726";
const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "..", "assets", "logo-uniautonoma.png");
const MARGEN = 64;
const num = (x) => Number(x || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
const fechaTexto = (d) => new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

class ConstanciaPdf {
  generar(detalle) {
    return new Promise((resolve) => {
      this.doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: MARGEN, right: MARGEN }, info: { Title: "Constancia de horas de deporte", Author: "Conecta BU" } });
      const partes = [];
      this.doc.on("data", (p) => partes.push(p));
      this.doc.on("end", () => resolve(Buffer.concat(partes)));
      this.ancho = this.doc.page.width - MARGEN * 2;
      this.encabezado();
      this.texto(detalle);
      this.estado(detalle);
      this.tabla("Horas por disciplina", detalle.porDisciplina, [
        { titulo: "Disciplina", ancho: 0.7, valor: (f) => f.nombre },
        { titulo: "Horas", ancho: 0.3, derecha: true, valor: (f) => num(f.horas) },
      ]);
      this.tabla("Horas por periodo", detalle.porPeriodo, [
        { titulo: "Periodo", ancho: 0.7, valor: (f) => f.periodo },
        { titulo: "Horas", ancho: 0.3, derecha: true, valor: (f) => num(f.horas) },
      ]);
      this.pie();
      this.doc.end();
    });
  }

  encabezado() {
    const { doc, ancho } = this;
    try {
      doc.image(fs.readFileSync(RUTA_LOGO), MARGEN, 48, { fit: [70, 74] });
    } catch {
      /* sin logo */
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(AZUL).text("CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA", 150, 60, { width: ancho - 86 });
    doc.font("Helvetica").fontSize(9).fillColor(GRIS).text("Bienestar Universitario · Módulo Deporte", 150, 76, { width: ancho - 86 });
    doc.rect(MARGEN, 134, ancho, 3).fill(DORADO);
    doc.y = 166;
    doc.font("Times-Bold").fontSize(24).fillColor(AZUL).text("Constancia de horas de deporte", MARGEN, doc.y, { width: ancho, align: "center" });
    doc.moveDown(1.2);
  }

  texto(detalle) {
    const { estudiante } = detalle;
    this.doc
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(TINTA)
      .text(`Bienestar Universitario hace constar que ${estudiante.nombre} (${estudiante.email}) registra en Conecta BU `, MARGEN, this.doc.y, { width: this.ancho, align: "justify", continued: true, lineGap: 3 })
      .font("Helvetica-Bold")
      .text(`${num(detalle.total)} horas`, { continued: true })
      .font("Helvetica")
      .text(` de práctica deportiva, de ${num(detalle.requeridas)} horas requeridas.`, { lineGap: 3 });
    this.doc.moveDown(1);
  }

  estado({ cumplido, total, requeridas, faltan }) {
    const { doc } = this;
    const y = doc.y;
    doc.roundedRect(MARGEN, y, this.ancho, 56, 10).fill(cumplido ? "#E3F4F1" : "#FDF3DC");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(cumplido ? "#0B6B61" : "#7A5405").text(cumplido ? "REQUISITO CUMPLIDO" : "REQUISITO EN CURSO", 84, y + 12);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(TINTA)
      .text(cumplido ? `Completó ${num(total)} de ${num(requeridas)} horas.` : `Le faltan ${num(faltan)} horas para completar las ${num(requeridas)} requeridas.`, 84, y + 31);
    doc.y = y + 76;
  }

  tabla(titulo, filas, columnas) {
    if (!filas.length) return;
    const { doc, ancho } = this;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(AZUL).text(titulo, MARGEN, doc.y);
    doc.moveDown(0.3);
    const anchos = columnas.map((c) => c.ancho * ancho);
    let y = doc.y;
    doc.rect(MARGEN, y, ancho, 20).fill(AZUL);
    this.fila(columnas, anchos, y + 6, (c) => c.titulo, { font: "Helvetica-Bold", color: "#FFFFFF" });
    y += 20;
    filas.forEach((f, j) => {
      if (y > doc.page.height - 110) {
        doc.addPage();
        y = 56;
      }
      if (j % 2) doc.rect(MARGEN, y, ancho, 18).fill("#FBF7EE");
      this.fila(columnas, anchos, y + 5, (c) => String(c.valor(f) ?? ""), { font: "Helvetica", color: TINTA, lineBreak: false, ellipsis: true });
      y += 18;
    });
    doc.y = y + 14;
  }

  fila(columnas, anchos, y, texto, { font, color, ...opciones }) {
    let x = MARGEN;
    columnas.forEach((c, i) => {
      this.doc.font(font).fontSize(9).fillColor(color).text(texto(c), x + 6, y, { width: anchos[i] - 12, align: c.derecha ? "right" : "left", ...opciones });
      x += anchos[i];
    });
  }

  pie() {
    this.doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(`Expedida el ${fechaTexto(new Date())} desde Conecta BU con la asistencia registrada por los instructores y las horas reconocidas por Bienestar Universitario.`, MARGEN, this.doc.page.height - 96, {
        width: this.ancho,
        align: "center",
      });
  }
}

module.exports = { ConstanciaPdf };
