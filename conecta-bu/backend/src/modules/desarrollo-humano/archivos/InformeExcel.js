const { ResumenExcel } = require("./ResumenExcel");

// Informe de participacion y asistencia (RF-015) en Excel: hoja de resumen
// y una hoja por tabla.

const COLS_CITAS = [
  { clave: "total", titulo: "Total", ancho: 10 },
  { clave: "atendidas", titulo: "Atendidas", ancho: 11 },
  { clave: "noAsistieron", titulo: "No asistieron", ancho: 13 },
  { clave: "canceladas", titulo: "Canceladas", ancho: 12 },
  { clave: "agendadas", titulo: "Agendadas (pendientes)", ancho: 14 },
  { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 13, pct: true, barra: true },
  { clave: "tasaCancelacion", titulo: "Tasa de cancelación", ancho: 13, pct: true },
];

function totalCitas(filas) {
  const t = { total: 0, atendidas: 0, noAsistieron: 0, canceladas: 0, agendadas: 0 };
  filas.forEach((f) => Object.keys(t).forEach((k) => (t[k] += f[k])));
  t.tasaAsistencia = t.atendidas + t.noAsistieron ? t.atendidas / (t.atendidas + t.noAsistieron) : null;
  t.tasaCancelacion = t.total ? t.canceladas / t.total : null;
  return t;
}

class InformeExcel extends ResumenExcel {
  constructor(informe) {
    super("Informe de Bienestar Universitario", informe.generado);
    this.informe = informe;
  }

  hojasDeCitas(informe) {

    this.hojaTabla("Citas por servicio", {
      titulo: "Citas por servicio",
      columnas: [{ clave: "servicio", titulo: "Servicio", ancho: 34 }, ...COLS_CITAS],
      filas: informe.citasPorServicio,
      totales: { servicio: "Total", ...totalCitas(informe.citasPorServicio) },
    });

    this.hojaTabla("Citas por día", {
      titulo: "Citas y asistencia según el día de la semana",
      nota: "IC 95 %: intervalo de confianza de la tasa de asistencia (Wilson).",
      columnas: [
        { clave: "clave", titulo: "Día", ancho: 14 },
        ...COLS_CITAS,
        { clave: "icBajo", titulo: "IC bajo (%)", ancho: 11 },
        { clave: "icAlto", titulo: "IC alto (%)", ancho: 11 },
      ],
      filas: informe.citasPorDia,
      totales: { clave: "Total", ...totalCitas(informe.citasPorDia) },
    });

    this.hojaTabla("Citas por hora", {
      titulo: "Citas según la hora de inicio",
      columnas: [{ clave: "clave", titulo: "Hora", ancho: 10 }, ...COLS_CITAS],
      filas: informe.citasPorHora,
      totales: { clave: "Total", ...totalCitas(informe.citasPorHora) },
    });

    this.hojaTabla("Citas por mes", {
      titulo: "Citas por mes",
      columnas: [{ clave: "mes", titulo: "Mes", ancho: 12 }, ...COLS_CITAS],
      filas: informe.citasPorMes,
      totales: { mes: "Total", ...totalCitas(informe.citasPorMes) },
    });

    this.hojaTabla("Tendencia semanal", {
      titulo: "Citas por semana (semana que inicia el lunes)",
      columnas: [
        { clave: "semana", titulo: "Semana (lunes)", ancho: 15 },
        { clave: "total", titulo: "Total", ancho: 10 },
        { clave: "Atendida", titulo: "Atendidas", ancho: 11 },
        { clave: "NoAsistio", titulo: "No asistieron", ancho: 13 },
        { clave: "Cancelada", titulo: "Canceladas", ancho: 12 },
        { clave: "Agendada", titulo: "Agendadas", ancho: 11 },
      ],
      filas: informe.tendenciaSemanal,
    });
  }

  hojasDeEventosYEstudiantes(informe) {
    this.hojaTabla("Eventos", {
      titulo: "Asistencia por evento",
      columnas: [
        { clave: "nombre", titulo: "Evento", ancho: 36 },
        { clave: "fecha", titulo: "Fecha", ancho: 12 },
        { clave: "estado", titulo: "Estado", ancho: 11 },
        { clave: "cupos", titulo: "Cupos", ancho: 8 },
        { clave: "inscritos", titulo: "Inscritos", ancho: 10 },
        { clave: "asistieron", titulo: "Asistieron", ancho: 11 },
        { clave: "noAsistieron", titulo: "No asistieron", ancho: 13 },
        { clave: "sinRegistrar", titulo: "Sin registrar", ancho: 12 },
        { clave: "ocupacion", titulo: "Ocupación de cupos", ancho: 12, pct: true },
        { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 13, pct: true, barra: true },
      ],
      filas: informe.eventos,
      totales: {
        nombre: "Total",
        cupos: informe.eventos.reduce((a, e) => a + e.cupos, 0),
        inscritos: informe.resumen.eventos.inscritos,
        asistieron: informe.resumen.eventos.asistieron,
        noAsistieron: informe.resumen.eventos.noAsistieron,
        sinRegistrar: informe.resumen.eventos.sinRegistrar,
        tasaAsistencia: informe.resumen.eventos.tasaAsistencia,
      },
    });

    this.hojaTabla("Asistentes a eventos", {
      titulo: "Inscritos a eventos y su asistencia",
      columnas: [
        { clave: "evento", titulo: "Evento", ancho: 34 },
        { clave: "fecha", titulo: "Fecha", ancho: 12 },
        { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
        { clave: "correo", titulo: "Correo", ancho: 32 },
        { clave: "inscritoEl", titulo: "Inscrito el", ancho: 12 },
        { clave: "asistencia", titulo: "Asistencia", ancho: 14 },
      ],
      filas: informe.asistentesEventos,
    });

    this.hojaTabla("Ocupación horarios", {
      titulo: "Ocupación de horarios por servicio",
      columnas: [
        { clave: "servicio", titulo: "Servicio", ancho: 34 },
        { clave: "publicados", titulo: "Publicados", ancho: 11 },
        { clave: "ocupados", titulo: "Ocupados", ancho: 11 },
        { clave: "libres", titulo: "Libres", ancho: 10 },
        { clave: "ocupacion", titulo: "Ocupación", ancho: 12, pct: true, barra: true },
      ],
      filas: informe.ocupacionPorServicio,
    });

    this.hojaTabla("Detalle de citas", {
      titulo: "Detalle de citas",
      nota: "Información confidencial: uso interno de Bienestar Universitario.",
      columnas: [
        { clave: "fecha", titulo: "Fecha", ancho: 12 },
        { clave: "dia", titulo: "Día", ancho: 11 },
        { clave: "hora", titulo: "Hora", ancho: 8 },
        { clave: "servicio", titulo: "Servicio", ancho: 30 },
        { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
        { clave: "correo", titulo: "Correo", ancho: 32 },
        { clave: "estado", titulo: "Estado", ancho: 12 },
        { clave: "agendadaEl", titulo: "Agendada el", ancho: 12 },
      ],
      filas: informe.detalleCitas,
    });

    const COLS_ESTUDIANTE = [
      { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
      { clave: "correo", titulo: "Correo", ancho: 32 },
      { clave: "citas", titulo: "Citas", ancho: 8 },
      { clave: "atendidas", titulo: "Atendidas", ancho: 10 },
      { clave: "noAsistieron", titulo: "No asistió (citas)", ancho: 12 },
      { clave: "canceladas", titulo: "Canceladas", ancho: 11 },
      { clave: "eventosInscritos", titulo: "Eventos inscritos", ancho: 11 },
      { clave: "eventosAsistidos", titulo: "Eventos asistidos", ancho: 11 },
      { clave: "eventosNoAsistidos", titulo: "No asistió (eventos)", ancho: 12 },
      { clave: "inasistencias", titulo: "Inasistencias totales", ancho: 12 },
      { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 12, pct: true, barra: true },
    ];

    this.hojaTabla("Estudiantes", {
      titulo: "Participación por estudiante",
      nota: "Información confidencial: uso interno de Bienestar Universitario.",
      columnas: COLS_ESTUDIANTE,
      filas: informe.estudiantes,
    });

    this.hojaTabla("Seguimiento", {
      titulo: "Estudiantes con 2 o más inasistencias (citas + eventos)",
      nota: "Sugerencia: contactar para conocer la causa y ofrecer reagendar. Información confidencial.",
      columnas: COLS_ESTUDIANTE,
      filas: informe.seguimiento,
    });
  }

  generar() {
    this.hojaResumen(this.informe);
    this.hojasDeCitas(this.informe);
    this.hojasDeEventosYEstudiantes(this.informe);
    return this.aBuffer();
  }
}

const generarExcel = (informe) => new InformeExcel(informe).generar();

module.exports = { InformeExcel, generarExcel };
