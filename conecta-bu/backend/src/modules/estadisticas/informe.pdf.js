// Exporta el informe (RF-015) a PDF con la identidad visual de Conecta BU:
// portada con indicadores, lectura rapida, graficas sencillas dibujadas con
// vectores y tablas de detalle. Usa las fuentes estandar de PDF (Helvetica y
// Times), que ya incluyen tildes y la ñ, asi no hay que distribuir fuentes.
const PDFDocument = require("pdfkit");
const { textoPeriodo } = require("./informe.excel");

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

function crearPdf(informe) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGEN, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: "Informe de Bienestar Universitario · Conecta BU", Author: "Conecta BU" },
  });
  const ancho = doc.page.width - MARGEN * 2;
  const limiteInferior = () => doc.page.height - MARGEN - ALTO_PIE;

  function asegurar(alto) {
    if (doc.y + alto > limiteInferior()) doc.addPage();
  }

  function tituloSeccion(texto, subtitulo) {
    asegurar(70);
    doc.moveDown(0.6);
    doc.font("Times-Bold").fontSize(17).fillColor(C.azul).text(texto, MARGEN, doc.y);
    const y = doc.y + 3;
    doc.rect(MARGEN, y, 36, 2.5).fill(C.dorado);
    doc.y = y + 9;
    if (subtitulo) {
      doc.font("Helvetica").fontSize(9).fillColor(C.gris).text(subtitulo, MARGEN, doc.y, { width: ancho });
      doc.moveDown(0.5);
    }
  }

  function leyenda(claves, y, etiquetas = ETIQUETA) {
    let x = MARGEN;
    doc.font("Helvetica").fontSize(8.5);
    for (const k of claves) {
      doc.rect(x, y + 1, 8, 8).fill(C[k]);
      doc.fillColor(C.gris).text(etiquetas[k], x + 12, y, { lineBreak: false });
      x += 12 + doc.widthOfString(etiquetas[k]) + 16;
    }
    doc.y = y + 16;
  }

  // Tabla con encabezado azul, filas alternas y repeticion del encabezado al
  // saltar de pagina.
  function tabla(columnas, filas, { total } = {}) {
    const anchoTotal = columnas.reduce((a, c) => a + c.ancho, 0);
    const escala = ancho / anchoTotal;
    const cols = columnas.map((c) => ({ ...c, w: c.ancho * escala }));
    const pad = 5;

    const encabezado = () => {
      doc.font("Helvetica-Bold").fontSize(8);
      const alto = Math.max(...cols.map((c) => doc.heightOfString(c.titulo, { width: c.w - pad * 2 }))) + pad * 2;
      asegurar(alto + 50);
      const y = doc.y;
      doc.rect(MARGEN, y, ancho, alto).fill(C.azul);
      let x = MARGEN;
      for (const c of cols) {
        doc.fillColor("#FFFFFF").text(c.titulo, x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      }
      doc.y = y + alto;
    };

    if (!filas.length) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(C.gris).text("Sin datos en el periodo.", MARGEN, doc.y);
      doc.moveDown(0.5);
      return;
    }

    encabezado();
    const dibujarFila = (fila, i, negrita) => {
      doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const textos = cols.map((c) => {
        const v = fila[c.clave];
        return c.formato ? c.formato(v, fila) : v === null || v === undefined ? "" : String(v);
      });
      const alto = Math.max(...cols.map((c, j) => doc.heightOfString(textos[j], { width: c.w - pad * 2 }))) + pad * 2;
      if (doc.y + alto > limiteInferior()) {
        doc.addPage();
        encabezado();
        doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      }
      const y = doc.y;
      if (negrita) doc.rect(MARGEN, y, ancho, alto).fill(C.marfil);
      else if (i % 2 === 1) doc.rect(MARGEN, y, ancho, alto).fill(C.marfil);
      let x = MARGEN;
      cols.forEach((c, j) => {
        doc.fillColor(C.tinta).text(textos[j], x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      });
      doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + ancho, y + alto).lineWidth(0.5).strokeColor(negrita ? C.azul : C.borde).stroke();
      doc.y = y + alto;
    };
    filas.forEach((f, i) => dibujarFila(f, i, false));
    if (total) dibujarFila(total, 0, true);
    doc.moveDown(0.6);
  }

  // Barra horizontal apilada (asistencia por estado) con etiquetas.
  function barraApilada(etiqueta, partes, maximo, anchoEtiqueta = 130) {
    asegurar(22);
    const y = doc.y;
    const anchoBarra = ancho - anchoEtiqueta - 40;
    doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(etiqueta, MARGEN, y + 2, { width: anchoEtiqueta - 8, ellipsis: true, lineBreak: false });
    let x = MARGEN + anchoEtiqueta;
    const total = partes.reduce((a, p) => a + p.valor, 0);
    if (total === 0) doc.rect(x, y, anchoBarra, 12).fill(C.grisClaro);
    for (const p of partes) {
      if (!p.valor) continue;
      const w = (p.valor / maximo) * anchoBarra;
      doc.rect(x, y, Math.max(w - 1, 0.5), 12).fill(p.color);
      if (w > 16) {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(p.color === C.Cancelada || p.color === C.grisClaro ? C.tinta : "#FFFFFF");
        doc.text(String(p.valor), x, y + 2.5, { width: w - 1, align: "center", lineBreak: false });
      }
      x += w;
    }
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.gris).text(String(total), x + 5, y + 2, { lineBreak: false });
    doc.y = y + 19;
  }

  // Columnas apiladas por semana.
  function columnasSemanales(semanas) {
    const alto = 150;
    asegurar(alto + 50);
    const estados = ["Atendida", "NoAsistio", "Cancelada", "Agendada"];
    leyenda(estados, doc.y);
    const y0 = doc.y + 6;
    const maximo = Math.max(1, ...semanas.map((s) => s.total));
    const paso = Math.max(1, Math.ceil(maximo / 4));
    const tope = paso * 4;
    const ejeX = MARGEN + 22;
    const anchoGraf = ancho - 22;

    doc.font("Helvetica").fontSize(7).fillColor(C.gris);
    for (let v = 0; v <= tope; v += paso) {
      const y = y0 + alto - (v / tope) * alto;
      doc.moveTo(ejeX, y).lineTo(ejeX + anchoGraf, y).lineWidth(0.4).strokeColor(C.borde).stroke();
      doc.fillColor(C.gris).text(String(v), MARGEN, y - 3.5, { width: 18, align: "right", lineBreak: false });
    }
    const n = semanas.length || 1;
    const hueco = anchoGraf / n;
    const w = Math.min(26, hueco * 0.62);
    semanas.forEach((s, i) => {
      let y = y0 + alto;
      const x = ejeX + i * hueco + (hueco - w) / 2;
      for (const e of estados) {
        if (!s[e]) continue;
        const h = (s[e] / tope) * alto;
        doc.rect(x, y - h, w, Math.max(h - 0.8, 0.5)).fill(C[e]);
        y -= h;
      }
      if (n <= 14 || i % 2 === 0) {
        const f = new Date(`${s.semana}T00:00:00Z`);
        const texto = f.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
        doc.font("Helvetica").fontSize(6.5).fillColor(C.gris).text(texto, x - 10, y0 + alto + 4, { width: w + 20, align: "center", lineBreak: false });
      }
    });
    doc.y = y0 + alto + 20;
  }

  // Probabilidad con intervalo de confianza: banda clara + punto.
  function probabilidad(etiqueta, p, color) {
    asegurar(34);
    const y = doc.y;
    const anchoEtiqueta = 190;
    const anchoEscala = ancho - anchoEtiqueta - 70;
    const x0 = MARGEN + anchoEtiqueta;
    doc.font("Helvetica").fontSize(9).fillColor(C.tinta).text(etiqueta, MARGEN, y + 3, { width: anchoEtiqueta - 10 });
    doc.rect(x0, y + 6, anchoEscala, 4).fill(C.grisClaro);
    if (p.probabilidad === null) {
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(C.gris).text("Sin datos", x0 + anchoEscala + 8, y + 3, { lineBreak: false });
    } else {
      const xb = x0 + (p.bajo / 100) * anchoEscala;
      const xa = x0 + (p.alto / 100) * anchoEscala;
      doc.save().fillOpacity(0.28).rect(xb, y + 3, Math.max(xa - xb, 1), 10).fill(color).restore();
      doc.circle(x0 + (p.probabilidad / 100) * anchoEscala, y + 8, 4.5).fill(color);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(C.azul).text(`${p.probabilidad.toLocaleString("es-CO")} %`, x0 + anchoEscala + 8, y + 2, { lineBreak: false });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.gris)
        .text(`IC 95 %: ${p.bajo.toLocaleString("es-CO")} – ${p.alto.toLocaleString("es-CO")} %  ·  n = ${p.n}`, x0, y + 16, { lineBreak: false });
    }
    doc.y = y + 30;
  }

  // ---------- Portada / encabezado ----------
  doc.rect(0, 0, doc.page.width, 150).fill(C.azul);
  doc.save().circle(doc.page.width - 40, 150, 120).lineWidth(1).strokeColor(C.dorado).strokeOpacity(0.35).stroke().restore();
  doc.save().circle(doc.page.width - 40, 150, 80).lineWidth(1).strokeColor("#FFFFFF").strokeOpacity(0.12).stroke().restore();
  doc.roundedRect(MARGEN, 38, 34, 34, 8).fill(C.dorado);
  doc.font("Times-Bold").fontSize(15).fillColor(C.azul).text("UA", MARGEN, 48, { width: 34, align: "center" });
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF").text("Conecta BU", MARGEN + 44, 41);
  doc.font("Helvetica").fontSize(8.5).fillColor("#C3CCE0").text("Bienestar Universitario · Uniautónoma del Cauca", MARGEN + 44, 57);
  doc.font("Times-Bold").fontSize(24).fillColor("#FFFFFF").text("Informe de participación y asistencia", MARGEN, 90);
  doc.font("Helvetica").fontSize(9.5).fillColor("#D6DDEC").text(
    `Periodo: ${textoPeriodo(informe.filtro)}   ·   Generado el ${informe.generado.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" })}`,
    MARGEN,
    122
  );
  doc.y = 172;

  // ---------- Indicadores ----------
  const { citas, eventos, participacion, ocupacionHorarios } = informe.resumen;
  const tarjetas = [
    { titulo: "Citas", valor: num(citas.total), detalle: `${num(citas.atendidas)} atendidas · ${num(citas.noAsistieron)} no asistieron` },
    { titulo: "Asistencia a citas", valor: pct(citas.tasaAsistencia), detalle: `${num(citas.canceladas)} canceladas (${pct(citas.tasaCancelacion)})`, destacado: true },
    { titulo: "Eventos", valor: num(eventos.eventos), detalle: `${num(eventos.inscritos)} inscritos` },
    { titulo: "Asistencia a eventos", valor: pct(eventos.tasaAsistencia), detalle: `${num(eventos.asistieron)} asistieron · ${num(eventos.noAsistieron)} no` },
    { titulo: "Estudiantes activos", valor: num(participacion.estudiantesActivos), detalle: `de ${num(informe.resumen.estudiantesRegistrados)} registrados` },
    { titulo: "Ocupación de horarios", valor: ocupacionHorarios.porcentaje === null ? "—" : `${ocupacionHorarios.porcentaje.toLocaleString("es-CO")} %`, detalle: `${num(ocupacionHorarios.ocupados)} de ${num(ocupacionHorarios.total)} horarios` },
  ];
  const porFila = 3;
  const gap = 10;
  const wT = (ancho - gap * (porFila - 1)) / porFila;
  const hT = 70;
  const yTarjetas = doc.y;
  tarjetas.forEach((t, i) => {
    const x = MARGEN + (i % porFila) * (wT + gap);
    const y = yTarjetas + Math.floor(i / porFila) * (hT + gap);
    if (t.destacado) doc.roundedRect(x, y, wT, hT, 10).fill(C.azul);
    else doc.roundedRect(x, y, wT, hT, 10).fillAndStroke("#FFFFFF", C.borde);
    doc.font("Helvetica").fontSize(8.5).fillColor(t.destacado ? "#C3CCE0" : C.gris).text(t.titulo, x + 12, y + 10, { width: wT - 24 });
    doc.font("Times-Bold").fontSize(22).fillColor(t.destacado ? C.dorado : C.azul).text(t.valor, x + 12, y + 24, { width: wT - 24 });
    doc.font("Helvetica").fontSize(7.5).fillColor(t.destacado ? "#D6DDEC" : C.gris).text(t.detalle, x + 12, y + 52, { width: wT - 24, lineBreak: false, ellipsis: true });
  });
  doc.y = yTarjetas + Math.ceil(tarjetas.length / porFila) * (hT + gap);

  // ---------- Lectura rapida ----------
  tituloSeccion("Lectura rápida", "Conclusiones generadas automáticamente a partir de los datos del periodo.");
  for (const texto of informe.conclusiones) {
    asegurar(24);
    const y = doc.y;
    doc.circle(MARGEN + 3, y + 5, 2.5).fill(C.dorado);
    doc.font("Helvetica").fontSize(9.5).fillColor(C.tinta).text(texto, MARGEN + 12, y, { width: ancho - 12 });
    doc.moveDown(0.35);
  }

  // ---------- Citas ----------
  tituloSeccion("Citas por estado", "Cuántas citas se atendieron, cuántas no asistieron, cuántas se cancelaron y cuántas siguen pendientes.");
  leyenda(["Atendida", "NoAsistio", "Cancelada", "Agendada"], doc.y);
  const partesCita = (g) => [
    { valor: g.atendidas, color: C.Atendida },
    { valor: g.noAsistieron, color: C.NoAsistio },
    { valor: g.canceladas, color: C.Cancelada },
    { valor: g.agendadas, color: C.Agendada },
  ];
  barraApilada("Todas las citas", partesCita(citas), Math.max(1, citas.total));

  tituloSeccion("Citas por servicio");
  const maxServicio = Math.max(1, ...informe.citasPorServicio.map((s) => s.total));
  informe.citasPorServicio.forEach((s) => barraApilada(s.servicio, partesCita(s), maxServicio, 170));
  if (!informe.citasPorServicio.length) tabla([], []);
  doc.moveDown(0.4);
  const colsCitas = [
    { clave: "total", titulo: "Total", ancho: 7, alinear: "right" },
    { clave: "atendidas", titulo: "Atendidas", ancho: 9, alinear: "right" },
    { clave: "noAsistieron", titulo: "No asistieron", ancho: 10, alinear: "right" },
    { clave: "canceladas", titulo: "Canceladas", ancho: 9, alinear: "right" },
    { clave: "tasaAsistencia", titulo: "Asistencia", ancho: 9, alinear: "right", formato: pct },
    { clave: "tasaCancelacion", titulo: "Cancelación", ancho: 11, alinear: "right", formato: pct },
  ];
  const totalDe = (filas, etiqueta, clave) => {
    const t = { [clave]: etiqueta, total: 0, atendidas: 0, noAsistieron: 0, canceladas: 0 };
    filas.forEach((f) => ["total", "atendidas", "noAsistieron", "canceladas"].forEach((k) => (t[k] += f[k])));
    t.tasaAsistencia = t.atendidas + t.noAsistieron ? t.atendidas / (t.atendidas + t.noAsistieron) : null;
    t.tasaCancelacion = t.total ? t.canceladas / t.total : null;
    return t;
  };
  tabla([{ clave: "servicio", titulo: "Servicio", ancho: 26 }, ...colsCitas], informe.citasPorServicio, {
    total: informe.citasPorServicio.length > 1 ? totalDe(informe.citasPorServicio, "Total", "servicio") : null,
  });

  tituloSeccion("Citas por semana", "Semanas de lunes a domingo; las semanas futuras muestran citas ya agendadas.");
  columnasSemanales(informe.tendenciaSemanal);

  tituloSeccion("Asistencia según el día de la semana", "Ayuda a decidir en qué días reforzar recordatorios o abrir más horarios.");
  tabla(
    [
      { clave: "clave", titulo: "Día", ancho: 14 },
      ...colsCitas,
      { clave: "icBajo", titulo: "IC 95 %", ancho: 12, alinear: "right", formato: (v, f) => (v === null ? "—" : `${f.icBajo.toLocaleString("es-CO")}–${f.icAlto.toLocaleString("es-CO")} %`) },
    ],
    informe.citasPorDia
  );

  tituloSeccion("Citas según la hora de inicio");
  tabla([{ clave: "clave", titulo: "Hora", ancho: 12 }, ...colsCitas], informe.citasPorHora);

  if (informe.citasPorMes.length > 1) {
    tituloSeccion("Citas por mes");
    tabla([{ clave: "mes", titulo: "Mes", ancho: 12 }, ...colsCitas], informe.citasPorMes);
  }

  // ---------- Probabilidades ----------
  tituloSeccion(
    "Probabilidades",
    "Estimadas con el histórico del periodo. El punto es el valor observado y la banda, el intervalo de confianza del 95 % (Wilson): " +
      "si la banda es ancha, todavía hay pocos datos."
  );
  const p = informe.probabilidades;
  probabilidad("Asistir a una cita agendada", p.asistenciaCita, C.Atendida);
  probabilidad("Asistir a un evento inscrito", p.asistenciaEvento, C.azulSuave);
  probabilidad("Cancelar una cita", p.cancelacionCita, C.NoAsistio);

  // ---------- Eventos ----------
  tituloSeccion("Asistencia por evento", "Eventos publicados o cerrados del periodo.");
  if (informe.eventos.length) {
    leyenda(["Atendida", "NoAsistio"], doc.y, { Atendida: "Asistieron", NoAsistio: "No asistieron" });
    const maxEv = Math.max(1, ...informe.eventos.map((e) => e.inscritos));
    informe.eventos.forEach((e) =>
      barraApilada(e.nombre, [
        { valor: e.asistieron, color: C.Atendida },
        { valor: e.noAsistieron, color: C.NoAsistio },
        { valor: e.sinRegistrar, color: C.grisClaro },
      ], maxEv, 170)
    );
    doc.font("Helvetica").fontSize(7.5).fillColor(C.gris).text("Gris: inscritos sin asistencia registrada.", MARGEN, doc.y);
    doc.moveDown(0.5);
  }
  tabla(
    [
      { clave: "nombre", titulo: "Evento", ancho: 26 },
      { clave: "fecha", titulo: "Fecha", ancho: 11 },
      { clave: "inscritos", titulo: "Inscritos", ancho: 8, alinear: "right" },
      { clave: "cupos", titulo: "Cupos", ancho: 7, alinear: "right" },
      { clave: "asistieron", titulo: "Asistieron", ancho: 9, alinear: "right" },
      { clave: "noAsistieron", titulo: "No asistieron", ancho: 9, alinear: "right" },
      { clave: "sinRegistrar", titulo: "Sin registrar", ancho: 9, alinear: "right" },
      { clave: "tasaAsistencia", titulo: "Asistencia", ancho: 9, alinear: "right", formato: pct },
    ],
    informe.eventos,
    {
      total: informe.eventos.length > 1
        ? {
            nombre: "Total",
            inscritos: eventos.inscritos,
            cupos: informe.eventos.reduce((a, e) => a + e.cupos, 0),
            asistieron: eventos.asistieron,
            noAsistieron: eventos.noAsistieron,
            sinRegistrar: eventos.sinRegistrar,
            tasaAsistencia: eventos.tasaAsistencia,
          }
        : null,
    }
  );

  // ---------- Ocupacion ----------
  tituloSeccion("Ocupación de horarios por servicio");
  tabla(
    [
      { clave: "servicio", titulo: "Servicio", ancho: 30 },
      { clave: "publicados", titulo: "Publicados", ancho: 10, alinear: "right" },
      { clave: "ocupados", titulo: "Ocupados", ancho: 10, alinear: "right" },
      { clave: "libres", titulo: "Libres", ancho: 10, alinear: "right" },
      { clave: "ocupacion", titulo: "Ocupación", ancho: 10, alinear: "right", formato: pct },
    ],
    informe.ocupacionPorServicio
  );

  // ---------- Seguimiento ----------
  tituloSeccion(
    "Estudiantes para seguimiento",
    "Estudiantes con 2 o más inasistencias (citas y eventos). Información confidencial, de uso interno de Bienestar."
  );
  tabla(
    [
      { clave: "estudiante", titulo: "Estudiante", ancho: 24 },
      { clave: "correo", titulo: "Correo", ancho: 28 },
      { clave: "noAsistieron", titulo: "No asistió (citas)", ancho: 10, alinear: "right" },
      { clave: "eventosNoAsistidos", titulo: "No asistió (eventos)", ancho: 10, alinear: "right" },
      { clave: "tasaAsistencia", titulo: "Asistencia", ancho: 10, alinear: "right", formato: pct },
    ],
    informe.seguimiento.slice(0, 30)
  );
  if (informe.seguimiento.length > 30) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.gris)
      .text(`Y ${informe.seguimiento.length - 30} más; la lista completa está en el informe de Excel.`, MARGEN, doc.y);
  }

  asegurar(40);
  doc.moveDown(0.8);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.gris).text(
    "El detalle de cada cita, la lista de asistentes por evento y el resumen por estudiante están en la versión Excel de este informe.",
    MARGEN,
    doc.y,
    { width: ancho }
  );

  // ---------- Pie de pagina ----------
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i += 1) {
    doc.switchToPage(i);
    const margenAnterior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEN + 6;
    doc.moveTo(MARGEN, y - 8).lineTo(doc.page.width - MARGEN, y - 8).lineWidth(0.5).strokeColor(C.borde).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(C.gris)
      .text("Conecta BU · Bienestar Universitario · Documento confidencial", MARGEN, y, { lineBreak: false });
    doc.text(`Página ${i + 1} de ${rango.count}`, MARGEN, y, { width: ancho, align: "right", lineBreak: false });
    doc.page.margins.bottom = margenAnterior;
  }

  return doc;
}

function generarPdf(informe) {
  return new Promise((resolve, reject) => {
    const doc = crearPdf(informe);
    const partes = [];
    doc.on("data", (d) => partes.push(d));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    doc.end();
  });
}

module.exports = { generarPdf };
