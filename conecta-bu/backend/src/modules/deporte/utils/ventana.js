const { AppError } = require("../../../common/utils/AppError");

// Ventana de asistencia: se toma desde la hora de inicio de la clase (o del
// evento) y solo se registra o corrige hasta su hora final. Horas de Bogota (UTC-5).

// Instante real de una fecha (dia a medianoche UTC) y una hora "HH:mm" de Bogota.
function instanteBogota(fecha, hhmm) {
  const f = new Date(fecha);
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), h + 5, m || 0));
}

function exigirQueEmpiece(fecha, hhmm, que = "la clase") {
  if (instanteBogota(fecha, hhmm).getTime() > Date.now()) {
    throw new AppError(409, `La asistencia se activa a la hora de inicio de ${que} (${hhmm}).`, "ASISTENCIA_AUN_NO");
  }
}

function exigirQueNoTermine(fecha, hhmm, que = "la clase") {
  if (instanteBogota(fecha, hhmm).getTime() < Date.now()) {
    throw new AppError(409, `${que[0].toUpperCase()}${que.slice(1)} terminó a las ${hhmm}: la asistencia ya no se puede registrar ni editar.`, "VENTANA_CERRADA");
  }
}

module.exports = { instanteBogota, exigirQueEmpiece, exigirQueNoTermine };
