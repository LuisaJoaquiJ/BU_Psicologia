const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Listado de asistencia para la visita de pares: reemplaza la hoja firmada.
// La constancia de cada persona es su ingreso con la cuenta institucional.
const MARINO = "#1E3A5F";
const GRIS = "#5B6478";
const TINTA = "#0E1726";
const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "assets", "logo-uniautonoma.png");
const MARGEN = 44;
const COLUMNAS = [
  ["Nombre", 0.28, (f) => f.nombre],
  ["Correo institucional", 0.3, (f) => f.correo],
  ["Programa", 0.22, (f) => f.programa],
  ["Registro", 0.2, (f) => `${f.registro}${f.fecha ? ` ${new Date(f.fecha).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })}` : ""}`],
];

function escribirFila(doc, ancho, celdas, negrita) {
  doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(TINTA);
  const alto = Math.max(...celdas.map((t, i) => doc.heightOfString(String(t), { width: ancho * COLUMNAS[i][1] - 6 }))) + 6;
  if (doc.y + alto > doc.page.height - 50) doc.addPage();
  const y = doc.y;
  let x = MARGEN;
  celdas.forEach((t, i) => {
    doc.text(String(t), x, y + 3, { width: ancho * COLUMNAS[i][1] - 6 });
    x += ancho * COLUMNAS[i][1];
  });
  doc.y = y + alto;
  doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + ancho, doc.y).strokeColor("#DDE3EE").lineWidth(0.5).stroke();
}

function generarListado({ titulo, detalle, filas, sinCuenta }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 44, bottom: 44, left: MARGEN, right: MARGEN }, info: { Title: `Listado de asistencia: ${titulo}`, Author: "Conecta BU" } });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    const ancho = doc.page.width - MARGEN * 2;
    if (fs.existsSync(RUTA_LOGO)) doc.image(RUTA_LOGO, MARGEN, 40, { height: 42 });
    doc.font("Helvetica-Bold").fontSize(16).fillColor(MARINO).text("Listado de asistencia", MARGEN, 96);
    doc.font("Helvetica").fontSize(10).fillColor(GRIS).text("Arte y Cultura, Bienestar Institucional, Corporación Universitaria Autónoma del Cauca");
    doc.moveDown(0.6);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(TINTA).text(titulo);
    doc.font("Helvetica").fontSize(10).fillColor(GRIS).text(detalle);
    doc.moveDown(0.8);
    escribirFila(doc, ancho, COLUMNAS.map((c) => c[0]), true);
    for (const f of filas) escribirFila(doc, ancho, COLUMNAS.map((c) => c[2](f)));
    doc.x = MARGEN;
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(9).fillColor(GRIS);
    if (!filas.length) doc.text("Sin asistentes registrados con cuenta.", MARGEN);
    if (sinCuenta) doc.text(`Asistentes sin cuenta contados por el personal: ${sinCuenta}.`, MARGEN);
    doc.end();
  });
}

module.exports = { generarListado };
