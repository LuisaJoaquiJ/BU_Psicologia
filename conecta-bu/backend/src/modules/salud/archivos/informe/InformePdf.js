const { PdfInformeSecciones } = require("./PdfInformeSecciones");
const { FORMATO, NOMBRE_PROYECTO } = require("../../utils/informe/plantilla");
const { dimensiones } = require("../estiloExcel");
const { C, ESTADO_TEXTO, MARGEN, ALTO_ENCABEZADO, ALTO_PIE, num, pct, fechaTexto } = require("./formatoPdf");

// Informe de gestion en PDF con el formato INFBI-002: encabezado
// institucional en cada pagina (codigo, version, fecha, pagina X de Y),
// proyecto, evaluacion, resultados con graficas, relacion de atendidos,
// avances por actividad y registro fotografico.
class InformePdf extends PdfInformeSecciones {
  atendidos(cifras) {
    // ---- 4. Relacion de atendidos (horizontal) --------------------------------
    this.nuevaPagina("landscape");
    this.tituloSeccion(`INFORME RELACIÓN ATENDIDOS ${cifras.periodo}`, "Una fila por jornada (actividades puntuales) o por servicio permanente. El detalle por programa está en el Excel.");
    const grupo = (f, prefijo) => Object.entries(f.conteo).filter(([c]) => c.startsWith(prefijo)).reduce((s, [, v]) => s + v, 0);
    const SEMAFORO = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo };
    const filasMatriz = cifras.matriz.filas;
    this.tabla(
      [
        { titulo: "Línea de acción", ancho: 2.2, valor: (f) => (f.primeraFila ? f.categoria : "") },
        { titulo: "Actividad / jornada", ancho: 2.6, valor: (f) => f.actividad },
        { titulo: "Fecha de ejecución", ancho: 1.5, valor: (f) => f.fecha },
        { titulo: "Admin.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Administrativo) },
        { titulo: "Docentes", ancho: 0.8, alinear: "right", valor: (f) => num(f.conteo.Docente) },
        { titulo: "Egres.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Egresado) },
        { titulo: "Extern.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Externo) },
        { titulo: "Posgrado", ancho: 0.8, alinear: "right", valor: (f) => num(grupo(f, "pos:")) },
        { titulo: "Pregrado", ancho: 0.8, alinear: "right", valor: (f) => num(grupo(f, "pre:")) },
        { titulo: "Total", ancho: 0.7, alinear: "right", valor: (f) => num(f.total) },
        { titulo: "Meta", ancho: 0.6, alinear: "right", valor: (f) => (f.primeraFila ? num(f.meta) : "") },
        { titulo: "Logro", ancho: 0.6, alinear: "right", valor: (f) => (f.primeraFila ? num(f.logro) : "") },
        { titulo: "Cumpl.", ancho: 0.8, alinear: "right", valor: (f) => (f.primeraFila && f.cumplimiento !== null ? pct(f.cumplimiento) : "") },
      ],
      filasMatriz,
      {
        tam: 7.5,
        total: filasMatriz.length
          ? {
              primeraFila: true,
              categoria: "TOTAL",
              actividad: "",
              fecha: "",
              conteo: cifras.matriz.totales,
              total: cifras.matriz.total,
              meta: null,
              logro: null,
              cumplimiento: null,
            }
          : null,
        estilos: (c, f) => (c.titulo === "Cumpl." && f.semaforo ? SEMAFORO[f.semaforo] : null),
      }
    );
  }

  avances(cifras) {
    // ---- 5. Avances por actividad ----------------------------------------------
    this.nuevaPagina();
    this.tituloSeccion("AVANCES, DIFICULTADES Y APRENDIZAJES POR ACTIVIDAD");
    if (!cifras.actividades.length) this.parrafo("", "No hay actividades con atenciones en el periodo.");
    for (const a of cifras.actividades) {
      this.asegurar(70);
      const y = this.doc.y;
      this.doc.font("Helvetica-Bold").fontSize(10).fillColor(C.azul).text(a.nombre, MARGEN, y, { width: this.ancho() - 150 });
      const etiqueta = a.cumplimiento === null ? "Sin meta" : `Cumplimiento ${pct(a.cumplimiento)}`;
      const color = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo }[a.semaforo] || C.grisClaro;
      this.doc.roundedRect(MARGEN + this.ancho() - 140, y - 1, 140, 15, 7).fill(color);
      this.doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(etiqueta, MARGEN + this.ancho() - 140, y + 2.5, { width: 140, align: "center", lineBreak: false });
      this.doc.font("Helvetica").fontSize(8).fillColor(C.gris).text(
        `${a.categoria} · ${num(a.atenciones)} atenciones · meta ${num(a.meta)} · logro ${num(a.logro)}${a.presupuesto ? ` · presupuesto ejecutado $${num(a.presupuesto)}` : ""}`,
        MARGEN,
        this.doc.y + 1,
        { width: this.ancho() }
      );
      this.doc.moveDown(0.3);
      for (const [titulo, valor] of [
        ["Avances", a.avances],
        ["Dificultades", a.dificultades],
        ["Aprendizajes", a.aprendizajes],
        ["Pendientes", a.pendientes],
        ["Observaciones", a.observaciones],
      ]) {
        if (!String(valor || "").trim()) continue;
        this.asegurar(28);
        this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.tinta).text(`${titulo}: `, MARGEN, this.doc.y, { continued: true });
        this.doc.font("Helvetica").fillColor(C.tinta).text(String(valor), { width: this.ancho(), align: "justify" });
      }
      this.doc.moveDown(0.3);
      this.doc.moveTo(MARGEN, this.doc.y).lineTo(MARGEN + this.ancho(), this.doc.y).lineWidth(0.4).strokeColor(C.borde).stroke();
      this.doc.moveDown(0.5);
    }
  }

  async fotos(cifras, leerArchivo) {
    // ---- 6. Registro fotografico -------------------------------------------------
    const fotos = cifras.evidencias.filter((e) => ["image/jpeg", "image/png"].includes(e.tipoMime)).slice(0, 48);
    this.nuevaPagina();
    this.tituloSeccion(`REGISTRO FOTOGRÁFICO ${cifras.periodo}`, fotos.length ? null : "No hay fotos cargadas como evidencia en este periodo.");
    const anchoFoto = (this.ancho() - 14) / 2;
    const altoFoto = 190;
    let columna = 0;
    for (const e of fotos) {
      const buffer = await leerArchivo(e).catch(() => null);
      if (!buffer) continue;
      if (columna === 0) this.asegurar(altoFoto + 34);
      const x = MARGEN + columna * (anchoFoto + 14);
      const y = this.doc.y;
      this.doc.rect(x, y, anchoFoto, altoFoto).fill(C.marfil);
      const dim = dimensiones(buffer) || { ancho: 4, alto: 3 };
      const escala = Math.min(anchoFoto / dim.ancho, altoFoto / dim.alto);
      const w = dim.ancho * escala;
      const h = dim.alto * escala;
      try {
        this.doc.image(buffer, x + (anchoFoto - w) / 2, y + (altoFoto - h) / 2, { width: w, height: h });
      } catch {
        /* imagen danada: se deja el recuadro */
      }
      this.doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(e.actividad, x, y + altoFoto + 4, { width: anchoFoto, lineBreak: false, ellipsis: true });
      this.doc.font("Helvetica").fontSize(7.5).fillColor(C.gris).text(`${fechaTexto(e.fecha)}${e.descripcion ? ` · ${e.descripcion}` : ""}`, x, y + altoFoto + 15, { width: anchoFoto, lineBreak: false, ellipsis: true });
      if (columna === 1) this.doc.y = y + altoFoto + 34;
      else this.doc.y = y;
      columna = (columna + 1) % 2;
    }
    if (columna === 1) this.doc.y += altoFoto + 34;
    const otros = cifras.evidencias.filter((e) => !["image/jpeg", "image/png"].includes(e.tipoMime));
    if (otros.length) {
      this.subtitulo("Otros soportes (PDF y otros formatos, disponibles en Conecta BU)");
      for (const e of otros) {
        this.asegurar(14);
        this.doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(`• ${e.nombreArchivo} — ${e.actividad} (${fechaTexto(e.fecha)})`, MARGEN, this.doc.y, { width: this.ancho() });
      }
    }
  }

  encabezados(informe, cifras) {
    // ---- Encabezado y pie en todas las paginas ------------------------------------
    const rango = this.doc.bufferedPageRange();
    const generado = new Date(cifras.generado || Date.now()).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
    for (let i = rango.start; i < rango.start + rango.count; i += 1) {
      this.doc.switchToPage(i);
      const anchoPagina = this.doc.page.width;
      const anchoUtil = anchoPagina - MARGEN * 2;
      const y = MARGEN - 8;
      const h = ALTO_ENCABEZADO - 12;
      const wLogo = 64;
      const wMeta = 130;
      // El encabezado y el pie se dibujan dentro de los margenes: se quitan
      // temporalmente para que pdfkit no agregue paginas.
      const margenes = this.doc.page.margins;
      this.doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
      this.doc.lineWidth(0.6).strokeColor(C.azul);
      this.doc.rect(MARGEN, y, anchoUtil, h).stroke();
      this.doc.moveTo(MARGEN + wLogo, y).lineTo(MARGEN + wLogo, y + h).stroke();
      this.doc.moveTo(MARGEN + anchoUtil - wMeta, y).lineTo(MARGEN + anchoUtil - wMeta, y + h).stroke();
      if (this.logo) this.doc.image(this.logo, MARGEN + 8, y + 4, { fit: [wLogo - 16, h - 8], align: "center", valign: "center" });
      const xc = MARGEN + wLogo;
      const wc = anchoUtil - wLogo - wMeta;
      this.doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.azul).text("CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA", xc, y + 8, { width: wc, align: "center", lineBreak: false });
      this.doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(`INFORME DE GESTIÓN · ${NOMBRE_PROYECTO[informe.modulo] || ""} · ${informe.periodo}`, xc, y + 22, { width: wc, align: "center", lineBreak: false });
      this.doc.rect(xc, y + h - 18, wc, 18).fill(C.azul);
      this.doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF").text(FORMATO.proceso, xc, y + h - 13, { width: wc, align: "center", lineBreak: false });
      const meta = [
        ["Código", FORMATO.codigo],
        ["Versión", String(FORMATO.version)],
        ["Fecha", new Date(`${FORMATO.fecha}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" })],
        ["Página", `${i - rango.start + 1} de ${rango.count}`],
      ];
      const xm = MARGEN + anchoUtil - wMeta;
      meta.forEach(([kk, v], j) => {
        const yy = y + (h / 4) * j;
        if (j) this.doc.moveTo(xm, yy).lineTo(xm + wMeta, yy).lineWidth(0.4).strokeColor(C.borde).stroke();
        this.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.gris).text(kk, xm + 6, yy + h / 8 - 4, { width: 50, lineBreak: false });
        this.doc.font("Helvetica").fontSize(7.5).fillColor(C.tinta).text(v, xm + 54, yy + h / 8 - 4, { width: wMeta - 60, lineBreak: false });
      });
      // Pie.
      const yp = this.doc.page.height - MARGEN - ALTO_PIE + 10;
      this.doc.moveTo(MARGEN, yp).lineTo(MARGEN + anchoUtil, yp).lineWidth(0.4).strokeColor(C.borde).stroke();
      this.doc.font("Helvetica").fontSize(7).fillColor(C.gris).text(
        `Conecta BU · Bienestar Universitario · generado el ${generado}`,
        MARGEN,
        yp + 6,
        { width: anchoUtil / 2, lineBreak: false }
      );
      const estado = `${ESTADO_TEXTO[informe.estado] || informe.estado}${informe.version ? ` · versión ${informe.version}` : ""}`;
      this.doc.font("Helvetica-Bold").fontSize(7).fillColor(informe.estado === "Borrador" ? C.doradoTexto : C.azul).text(estado, MARGEN + anchoUtil / 2, yp + 6, {
        width: anchoUtil / 2,
        align: "right",
        lineBreak: false,
      });
      this.doc.page.margins = margenes;
    }
  }

  async generar(informe, cifras, leerArchivo) {
    this.proyecto(informe);
    this.evaluacion(informe);
    this.resultados(cifras);
    this.atendidos(cifras);
    this.avances(cifras);
    await this.fotos(cifras, leerArchivo);
    this.encabezados(informe, cifras);
    this.doc.end();
    return this.fin;
  }
}

const generarPdf = (informe, cifras, leerArchivo) => new InformePdf(informe).generar(informe, cifras, leerArchivo);

module.exports = { InformePdf, generarPdf };
