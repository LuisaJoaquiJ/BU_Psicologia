// Archivos del modulo Deporte: constancia de horas (PDF) para el estudiante
// y reporte en Excel para el personal.
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const AZUL = "#0B2A5B";
const DORADO = "#E8B23A";
const GRIS = "#5B6478";
const TINTA = "#0E1726";
const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "assets", "logo-uniautonoma.png");
const num = (x) => Number(x || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
const fechaTexto = (d) =>
  new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });

function constanciaPdf(detalle) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 64, right: 64 }, info: { Title: "Constancia de horas de deporte", Author: "Conecta BU" } });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    const ancho = doc.page.width - 128;

    try {
      doc.image(fs.readFileSync(RUTA_LOGO), 64, 48, { fit: [70, 74] });
    } catch {
      /* sin logo */
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(AZUL).text("CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA", 150, 60, { width: ancho - 86 });
    doc.font("Helvetica").fontSize(9).fillColor(GRIS).text("Bienestar Universitario · Módulo Deporte", 150, 76, { width: ancho - 86 });
    doc.rect(64, 134, ancho, 3).fill(DORADO);

    doc.y = 166;
    doc.font("Times-Bold").fontSize(24).fillColor(AZUL).text("Constancia de horas de deporte", 64, doc.y, { width: ancho, align: "center" });
    doc.moveDown(1.2);
    const { estudiante } = detalle;
    doc
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(TINTA)
      .text(`Bienestar Universitario hace constar que ${estudiante.nombre} (${estudiante.email}) registra en Conecta BU `, 64, doc.y, {
        width: ancho,
        align: "justify",
        continued: true,
        lineGap: 3,
      })
      .font("Helvetica-Bold")
      .text(`${num(detalle.total)} horas`, { continued: true })
      .font("Helvetica")
      .text(` de práctica deportiva, de ${num(detalle.requeridas)} horas requeridas.`, { lineGap: 3 });
    doc.moveDown(1);

    // Estado.
    const y = doc.y;
    const cumplido = detalle.cumplido;
    doc.roundedRect(64, y, ancho, 56, 10).fill(cumplido ? "#E3F4F1" : "#FDF3DC");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(cumplido ? "#0B6B61" : "#7A5405").text(cumplido ? "REQUISITO CUMPLIDO" : "REQUISITO EN CURSO", 84, y + 12);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(TINTA)
      .text(cumplido ? `Completó ${num(detalle.total)} de ${num(detalle.requeridas)} horas.` : `Le faltan ${num(detalle.faltan)} horas para completar las ${num(detalle.requeridas)} requeridas.`, 84, y + 31);
    doc.y = y + 76;

    const tabla = (titulo, filas, columnas) => {
      if (!filas.length) return;
      doc.font("Helvetica-Bold").fontSize(11).fillColor(AZUL).text(titulo, 64, doc.y);
      doc.moveDown(0.3);
      const anchos = columnas.map((c) => c.ancho * ancho);
      let yy = doc.y;
      doc.rect(64, yy, ancho, 20).fill(AZUL);
      let x = 64;
      columnas.forEach((c, i) => {
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF").text(c.titulo, x + 6, yy + 6, { width: anchos[i] - 12, align: c.derecha ? "right" : "left" });
        x += anchos[i];
      });
      yy += 20;
      filas.forEach((f, j) => {
        if (yy > doc.page.height - 110) {
          doc.addPage();
          yy = 56;
        }
        if (j % 2) doc.rect(64, yy, ancho, 18).fill("#FBF7EE");
        x = 64;
        columnas.forEach((c, i) => {
          doc.font("Helvetica").fontSize(9).fillColor(TINTA).text(String(c.valor(f) ?? ""), x + 6, yy + 5, { width: anchos[i] - 12, align: c.derecha ? "right" : "left", lineBreak: false, ellipsis: true });
          x += anchos[i];
        });
        yy += 18;
      });
      doc.y = yy + 14;
    };
    tabla("Horas por disciplina", detalle.porDisciplina, [
      { titulo: "Disciplina", ancho: 0.7, valor: (f) => f.nombre },
      { titulo: "Horas", ancho: 0.3, derecha: true, valor: (f) => num(f.horas) },
    ]);
    tabla("Horas por periodo", detalle.porPeriodo, [
      { titulo: "Periodo", ancho: 0.7, valor: (f) => f.periodo },
      { titulo: "Horas", ancho: 0.3, derecha: true, valor: (f) => num(f.horas) },
    ]);

    doc.font("Helvetica").fontSize(8.5).fillColor(GRIS).text(
      `Expedida el ${fechaTexto(new Date())} desde Conecta BU con la asistencia registrada por los instructores y las horas reconocidas por Bienestar Universitario.`,
      64,
      doc.page.height - 96,
      { width: ancho, align: "center" }
    );
    doc.end();
  });
}

function estiloEncabezado(fila) {
  fila.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2A5B" } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  fila.height = 28;
}

function hoja(libro, nombre, columnas, filas) {
  const h = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  h.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho || 16 }));
  estiloEncabezado(h.getRow(1));
  for (const f of filas) h.addRow(Object.fromEntries(columnas.map((c) => [c.clave, c.valor(f)])));
  if (filas.length) h.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  return h;
}

async function reporteExcel({ periodo, requeridas, estudiantes, grupos, asistencias }) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU";
  const est = hoja(
    libro,
    "ESTUDIANTES",
    [
      { titulo: "Estudiante", clave: "nombre", ancho: 32, valor: (f) => f.nombre },
      { titulo: "Correo", clave: "email", ancho: 34, valor: (f) => f.email },
      { titulo: `Horas ${periodo}`, clave: "periodo", ancho: 12, valor: (f) => f.horasPeriodo },
      { titulo: "Horas acumuladas", clave: "total", ancho: 14, valor: (f) => f.total },
      { titulo: "Horas requeridas", clave: "req", ancho: 14, valor: () => requeridas },
      { titulo: "Avance", clave: "avance", ancho: 10, valor: (f) => f.porcentaje / 100 },
      { titulo: "Estado", clave: "estado", ancho: 14, valor: (f) => (f.cumplido ? "Cumplió" : "En curso") },
      { titulo: "Grupos activos", clave: "grupos", ancho: 40, valor: (f) => f.gruposActivos.join("; ") },
    ],
    estudiantes
  );
  est.getColumn("avance").numFmt = "0%";
  est.eachRow((r, n) => {
    if (n > 1 && r.getCell("estado").value === "Cumplió") r.getCell("estado").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8EBD9" } };
  });
  hoja(
    libro,
    "GRUPOS",
    [
      { titulo: "Disciplina", clave: "disciplina", ancho: 18, valor: (f) => f.disciplina?.nombre },
      { titulo: "Grupo", clave: "nombre", ancho: 26, valor: (f) => f.nombre },
      { titulo: "Instructor", clave: "instructor", ancho: 24, valor: (f) => f.instructor },
      { titulo: "Lugar", clave: "lugar", ancho: 22, valor: (f) => f.lugar },
      { titulo: "Horario", clave: "horario", ancho: 34, valor: (f) => f.horarioTexto },
      { titulo: "Cupo", clave: "cupo", ancho: 8, valor: (f) => f.cupo },
      { titulo: "Inscritos", clave: "inscritos", ancho: 10, valor: (f) => f.inscritos },
      { titulo: "Sesiones", clave: "sesiones", ancho: 10, valor: (f) => f.sesiones },
      { titulo: "Horas dictadas", clave: "horas", ancho: 12, valor: (f) => f.horasDictadas },
    ],
    grupos
  );
  hoja(
    libro,
    "ASISTENCIA",
    [
      { titulo: "Fecha", clave: "fecha", ancho: 12, valor: (f) => f.fecha },
      { titulo: "Disciplina", clave: "disciplina", ancho: 18, valor: (f) => f.disciplina },
      { titulo: "Grupo", clave: "grupo", ancho: 26, valor: (f) => f.grupo },
      { titulo: "Estudiante", clave: "nombre", ancho: 30, valor: (f) => f.nombre },
      { titulo: "Correo", clave: "email", ancho: 32, valor: (f) => f.email },
      { titulo: "Asistió", clave: "presente", ancho: 9, valor: (f) => (f.presente ? "Sí" : "No") },
      { titulo: "Horas", clave: "horas", ancho: 8, valor: (f) => (f.presente ? f.horas : 0) },
    ],
    asistencias
  );
  return Buffer.from(await libro.xlsx.writeBuffer());
}

module.exports = { constanciaPdf, reporteExcel };
