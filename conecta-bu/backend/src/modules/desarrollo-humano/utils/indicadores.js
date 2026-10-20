const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC } = require("../../../common/utils/fechas");
const analitica = require("./analitica");

// Indicadores del panel de estadisticas de Desarrollo Humano (RF-015).

// Porcentaje con un decimal; null cuando no hay base para calcularlo
// (el frontend muestra "sin datos" en lugar de un 0% enganoso).
function porcentaje(parte, total) {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}

function rangoFechas({ desde, hasta }) {
  const rango = {};
  if (desde) rango.gte = aFechaUTC(desde, "fecha desde");
  if (hasta) rango.lte = aFechaUTC(hasta, "fecha hasta");
  if (rango.gte && rango.lte && rango.gte > rango.lte) {
    throw new AppError(400, "La fecha desde no puede ser posterior a la fecha hasta.");
  }
  return Object.keys(rango).length ? rango : undefined;
}

// Indicadores de citas (asistencia a citas), en total y por servicio.
function calcularIndicadoresCitas(citas) {
  const base = () => ({ total: 0, Agendada: 0, Atendida: 0, NoAsistio: 0, Cancelada: 0 });
  const total = base();
  const porServicio = new Map();

  for (const cita of citas) {
    const nombre = cita.horario?.servicio?.nombre || "Sin servicio";
    if (!porServicio.has(nombre)) porServicio.set(nombre, base());
    for (const grupo of [total, porServicio.get(nombre)]) {
      grupo.total += 1;
      grupo[cita.estado] = (grupo[cita.estado] || 0) + 1;
    }
  }

  const resumir = (g) => ({
    total: g.total,
    agendadas: g.Agendada,
    atendidas: g.Atendida,
    noAsistieron: g.NoAsistio,
    canceladas: g.Cancelada,
    // Asistencia sobre las citas que ya tienen asistencia registrada.
    tasaAsistencia: porcentaje(g.Atendida, g.Atendida + g.NoAsistio),
  });

  return {
    resumen: resumir(total),
    porServicio: [...porServicio.entries()]
      .map(([servicio, g]) => ({ servicio, ...resumir(g) }))
      .sort((a, b) => b.total - a.total),
  };
}

// Indicadores de eventos: inscritos, asistieron, no asistieron, por evento.
function calcularIndicadoresEventos(eventos) {
  const porEvento = eventos.map((evento) => {
    const inscritos = evento.inscripciones.length;
    const asistieron = evento.inscripciones.filter((i) => i.asistencia?.asistio === true).length;
    const noAsistieron = evento.inscripciones.filter((i) => i.asistencia?.asistio === false).length;
    return {
      id: evento.id,
      nombre: evento.nombre,
      fecha: evento.fecha,
      estado: evento.estado,
      cupos: evento.cupos,
      inscritos,
      asistieron,
      noAsistieron,
      sinRegistrar: inscritos - asistieron - noAsistieron,
      ocupacion: porcentaje(inscritos, evento.cupos),
      tasaAsistencia: porcentaje(asistieron, asistieron + noAsistieron),
    };
  });

  const suma = (campo) => porEvento.reduce((acc, e) => acc + e[campo], 0);
  const asistieron = suma("asistieron");
  const noAsistieron = suma("noAsistieron");
  return {
    resumen: {
      eventos: porEvento.length,
      inscritos: suma("inscritos"),
      asistieron,
      noAsistieron,
      sinRegistrar: suma("sinRegistrar"),
      tasaAsistencia: porcentaje(asistieron, asistieron + noAsistieron),
    },
    porEvento,
  };
}

function armarEstadisticas({ citas, eventos, estudiantes, horarios }, { desde, hasta } = {}) {
  const indicadoresCitas = calcularIndicadoresCitas(citas);
  const indicadoresEventos = calcularIndicadoresEventos(eventos);

  return {
    filtro: { desde: desde || null, hasta: hasta || null },
    hayDatos: citas.length > 0 || eventos.length > 0,
    estudiantesRegistrados: estudiantes,
    citas: indicadoresCitas.resumen,
    citasPorServicio: indicadoresCitas.porServicio,
    eventos: indicadoresEventos.resumen,
    eventosDetalle: indicadoresEventos.porEvento,
    // Ampliacion del dashboard: tendencia, demanda, probabilidades y participacion.
    tendenciaSemanal: analitica.tendenciaSemanal(citas, { desde, hasta }),
    mapaDemanda: analitica.mapaDemanda(citas),
    probabilidades: analitica.calcularProbabilidades(citas, eventos),
    participacion: analitica.calcularParticipacion(citas, eventos, estudiantes),
    ocupacionHorarios: analitica.calcularOcupacionHorarios(horarios),
  };
}

module.exports = { porcentaje, rangoFechas, calcularIndicadoresCitas, calcularIndicadoresEventos, armarEstadisticas };
