const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");

// Periodos academicos ("2026-1" de enero a junio, "2026-2" de julio a diciembre).

function periodoDeFecha(fecha) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

const periodoActual = () => periodoDeFecha(hoyBogota());

function validarPeriodo(periodo) {
  const p = String(periodo || "").trim();
  if (!/^\d{4}-[12]$/.test(p)) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return p;
}

// Dia de la semana de una fecha (1 lunes ... 7 domingo).
function diaSemana(fecha) {
  const d = new Date(fecha).getUTCDay();
  return d === 0 ? 7 : d;
}

module.exports = { periodoDeFecha, periodoActual, validarPeriodo, diaSemana };
