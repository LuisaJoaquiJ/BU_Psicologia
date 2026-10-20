const { PdfGraficas } = require("./PdfGraficas");
const { C, MARGEN, pct, num } = require("./PdfDocumento");
const { textoPeriodo } = require("./formato");

// Informe de participacion y asistencia (RF-015) en PDF: portada con
// indicadores, lectura rapida, graficas y tablas de detalle.
class InformePdf extends PdfGraficas {
  constructor() {
    super("Informe de Bienestar Universitario · Conecta BU");
  }

  portada(informe) {
    // ---------- Portada / encabezado ----------
    this.doc.rect(0, 0, this.doc.page.width, 150).fill(C.azul);
    this.doc.save().circle(this.doc.page.width - 40, 150, 120).lineWidth(1).strokeColor(C.dorado).strokeOpacity(0.35).stroke().restore();
    this.doc.save().circle(this.doc.page.width - 40, 150, 80).lineWidth(1).strokeColor("#FFFFFF").strokeOpacity(0.12).stroke().restore();
    this.doc.roundedRect(MARGEN, 38, 34, 34, 8).fill(C.dorado);
    this.doc.font("Times-Bold").fontSize(15).fillColor(C.azul).text("UA", MARGEN, 48, { width: 34, align: "center" });
    this.doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF").text("Conecta BU", MARGEN + 44, 41);
    this.doc.font("Helvetica").fontSize(8.5).fillColor("#C3CCE0").text("Bienestar Universitario · Uniautónoma del Cauca", MARGEN + 44, 57);
    this.doc.font("Times-Bold").fontSize(24).fillColor("#FFFFFF").text("Informe de participación y asistencia", MARGEN, 90);
    this.doc.font("Helvetica").fontSize(9.5).fillColor("#D6DDEC").text(
      `Periodo: ${textoPeriodo(informe.filtro)}   ·   Generado el ${informe.generado.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" })}`,
      MARGEN,
      122
    );
    this.doc.y = 172;
  }

  indicadores(informe) {
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
    const wT = (this.ancho - gap * (porFila - 1)) / porFila;
    const hT = 70;
    const yTarjetas = this.doc.y;
    tarjetas.forEach((t, i) => {
      const x = MARGEN + (i % porFila) * (wT + gap);
      const y = yTarjetas + Math.floor(i / porFila) * (hT + gap);
      if (t.destacado) this.doc.roundedRect(x, y, wT, hT, 10).fill(C.azul);
      else this.doc.roundedRect(x, y, wT, hT, 10).fillAndStroke("#FFFFFF", C.borde);
      this.doc.font("Helvetica").fontSize(8.5).fillColor(t.destacado ? "#C3CCE0" : C.gris).text(t.titulo, x + 12, y + 10, { width: wT - 24 });
      this.doc.font("Times-Bold").fontSize(22).fillColor(t.destacado ? C.dorado : C.azul).text(t.valor, x + 12, y + 24, { width: wT - 24 });
      this.doc.font("Helvetica").fontSize(7.5).fillColor(t.destacado ? "#D6DDEC" : C.gris).text(t.detalle, x + 12, y + 52, { width: wT - 24, lineBreak: false, ellipsis: true });
    });
    this.doc.y = yTarjetas + Math.ceil(tarjetas.length / porFila) * (hT + gap);
  }

  lecturaRapida(informe) {
    // ---------- Lectura rapida ----------
    this.tituloSeccion("Lectura rápida", "Conclusiones generadas automáticamente a partir de los datos del periodo.");
    for (const texto of informe.conclusiones) {
      this.asegurar(24);
      const y = this.doc.y;
      this.doc.circle(MARGEN + 3, y + 5, 2.5).fill(C.dorado);
      this.doc.font("Helvetica").fontSize(9.5).fillColor(C.tinta).text(texto, MARGEN + 12, y, { width: this.ancho - 12 });
      this.doc.moveDown(0.35);
    }
  }

  citas(informe) {
    const { citas } = informe.resumen;
    // ---------- Citas ----------
    this.tituloSeccion("Citas por estado", "Cuántas citas se atendieron, cuántas no asistieron, cuántas se cancelaron y cuántas siguen pendientes.");
    this.leyenda(["Atendida", "NoAsistio", "Cancelada", "Agendada"], this.doc.y);
    const partesCita = (g) => [
      { valor: g.atendidas, color: C.Atendida },
      { valor: g.noAsistieron, color: C.NoAsistio },
      { valor: g.canceladas, color: C.Cancelada },
      { valor: g.agendadas, color: C.Agendada },
    ];
    this.barraApilada("Todas las citas", partesCita(citas), Math.max(1, citas.total));

    this.tituloSeccion("Citas por servicio");
    const maxServicio = Math.max(1, ...informe.citasPorServicio.map((s) => s.total));
    informe.citasPorServicio.forEach((s) => this.barraApilada(s.servicio, partesCita(s), maxServicio, 170));
    if (!informe.citasPorServicio.length) this.tabla([], []);
    this.doc.moveDown(0.4);
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
    this.tabla([{ clave: "servicio", titulo: "Servicio", ancho: 26 }, ...colsCitas], informe.citasPorServicio, {
      total: informe.citasPorServicio.length > 1 ? totalDe(informe.citasPorServicio, "Total", "servicio") : null,
    });

    this.tituloSeccion("Citas por semana", "Semanas de lunes a domingo; las semanas futuras muestran citas ya agendadas.");
    this.columnasSemanales(informe.tendenciaSemanal);

    this.tituloSeccion("Asistencia según el día de la semana", "Ayuda a decidir en qué días reforzar recordatorios o abrir más horarios.");
    this.tabla(
      [
        { clave: "clave", titulo: "Día", ancho: 14 },
        ...colsCitas,
        { clave: "icBajo", titulo: "IC 95 %", ancho: 12, alinear: "right", formato: (v, f) => (v === null ? "—" : `${f.icBajo.toLocaleString("es-CO")}–${f.icAlto.toLocaleString("es-CO")} %`) },
      ],
      informe.citasPorDia
    );

    this.tituloSeccion("Citas según la hora de inicio");
    this.tabla([{ clave: "clave", titulo: "Hora", ancho: 12 }, ...colsCitas], informe.citasPorHora);

    if (informe.citasPorMes.length > 1) {
      this.tituloSeccion("Citas por mes");
      this.tabla([{ clave: "mes", titulo: "Mes", ancho: 12 }, ...colsCitas], informe.citasPorMes);
    }
  }

  probabilidades(informe) {
    // ---------- Probabilidades ----------
    this.tituloSeccion(
      "Probabilidades",
      "Estimadas con el histórico del periodo. El punto es el valor observado y la banda, el intervalo de confianza del 95 % (Wilson): " +
        "si la banda es ancha, todavía hay pocos datos."
    );
    const p = informe.probabilidades;
    this.probabilidad("Asistir a una cita agendada", p.asistenciaCita, C.Atendida);
    this.probabilidad("Asistir a un evento inscrito", p.asistenciaEvento, C.azulSuave);
    this.probabilidad("Cancelar una cita", p.cancelacionCita, C.NoAsistio);
  }

  eventos(informe) {
    const { eventos } = informe.resumen;
    // ---------- Eventos ----------
    this.tituloSeccion("Asistencia por evento", "Eventos publicados o cerrados del periodo.");
    if (informe.eventos.length) {
      this.leyenda(["Atendida", "NoAsistio"], this.doc.y, { Atendida: "Asistieron", NoAsistio: "No asistieron" });
      const maxEv = Math.max(1, ...informe.eventos.map((e) => e.inscritos));
      informe.eventos.forEach((e) =>
        this.barraApilada(e.nombre, [
          { valor: e.asistieron, color: C.Atendida },
          { valor: e.noAsistieron, color: C.NoAsistio },
          { valor: e.sinRegistrar, color: C.grisClaro },
        ], maxEv, 170)
      );
      this.doc.font("Helvetica").fontSize(7.5).fillColor(C.gris).text("Gris: inscritos sin asistencia registrada.", MARGEN, this.doc.y);
      this.doc.moveDown(0.5);
    }
    this.tabla(
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
  }

  ocupacionYSeguimiento(informe) {
    // ---------- Ocupacion ----------
    this.tituloSeccion("Ocupación de horarios por servicio");
    this.tabla(
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
    this.tituloSeccion(
      "Estudiantes para seguimiento",
      "Estudiantes con 2 o más inasistencias (citas y eventos). Información confidencial, de uso interno de Bienestar."
    );
    this.tabla(
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
      this.doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.gris)
        .text(`Y ${informe.seguimiento.length - 30} más; la lista completa está en el informe de Excel.`, MARGEN, this.doc.y);
    }

    this.asegurar(40);
    this.doc.moveDown(0.8);
    this.doc.font("Helvetica-Oblique").fontSize(8).fillColor(C.gris).text(
      "El detalle de cada cita, la lista de asistentes por evento y el resumen por estudiante están en la versión Excel de este informe.",
      MARGEN,
      this.doc.y,
      { width: this.ancho }
    );
  }

  generar(informe) {
    for (const seccion of ["portada", "indicadores", "lecturaRapida", "citas", "probabilidades", "eventos", "ocupacionYSeguimiento"]) this[seccion](informe);
    this.pie("Conecta BU · Bienestar Universitario · Documento confidencial");
    return this.aBuffer();
  }
}

const generarPdf = (informe) => new InformePdf().generar(informe);

module.exports = { InformePdf, generarPdf };
