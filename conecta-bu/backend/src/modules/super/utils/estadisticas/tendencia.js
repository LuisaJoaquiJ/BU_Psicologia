const { aDia, aDiaBogota, iso, mesActual } = require("../periodos");
const { MODULOS_TABLERO } = require("../etiquetas");

// Participaciones de cada modulo: una cita no cancelada, una inscripcion a
// un evento, una atencion de salud o una asistencia a una clase de deporte.
// Cada fuente es [lista, fecha de cada elemento].
function fuentes({ citas, eventos, inscripciones, atenciones, deporte }) {
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const sesionPorId = new Map(deporte.sesiones.map((s) => [s.id, s]));
  const visibles = (i) => i.estado === "Confirmada" && ["Publicado", "Cerrado"].includes(eventoPorId.get(i.eventoId)?.estado);
  const citasDe = (m) => citas.filter((c) => c.estado !== "Cancelada" && c.modulo === m);
  return {
    "desarrollo-humano": [
      [citasDe("desarrollo-humano"), (c) => c.horario?.fecha],
      [inscripciones.filter(visibles), (i) => aDiaBogota(i.fechaInscripcion)],
    ],
    salud: [
      [atenciones, (a) => a.fecha],
      [citasDe("salud"), (c) => c.horario?.fecha],
    ],
    deporte: [[deporte.asistencias, (a) => sesionPorId.get(a.sesionId)?.fecha]],
  };
}

// Recorre cada participacion con su modulo y su fecha.
function recorrer(fs, fn) {
  for (const [modulo, lista] of Object.entries(fs)) {
    for (const [items, fecha] of lista) for (const x of items) fn(modulo, fecha(x));
  }
}

// Serie por cubeta del periodo y total del periodo anterior por modulo.
function tendencia(fs, p) {
  const serie = p.cubetas.map((c) => ({ mes: c.clave, etiqueta: c.etiqueta, "desarrollo-humano": 0, salud: 0, deporte: 0 }));
  const porClave = new Map(serie.map((t) => [t.mes, t]));
  const anterior = { "desarrollo-humano": 0, salud: 0, deporte: 0 };
  recorrer(fs, (modulo, f) => {
    const k = p.cubetaDe(f);
    if (k) porClave.get(k)[modulo] += 1;
    else if (p.enAnterior(f)) anterior[modulo] += 1;
  });
  const total = (m) => serie.reduce((s, t) => s + t[m], 0);
  const totales = Object.fromEntries(MODULOS_TABLERO.map((m) => [m, total(m)]));
  return { serie, anterior, totales };
}

// Calendario del mes en curso: actividad por dia y modulo.
function calendario(fs) {
  const mes = mesActual();
  const dias = {};
  recorrer(fs, (modulo, fecha) => {
    const d = aDia(fecha);
    if (!d || d < mes.desde || d > mes.hasta) return;
    const k = iso(d);
    dias[k] = dias[k] || { "desarrollo-humano": 0, salud: 0, deporte: 0 };
    dias[k][modulo] += 1;
  });
  return { mes: mes.clave, hoy: mes.hoy, dias };
}

module.exports = { fuentes, tendencia, calendario };
