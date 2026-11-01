const { hoyBogota } = require("../../common/utils/fechas");

function periodoActual() {
  const d = hoyBogota();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

function iso(fecha) {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toISOString().slice(0, 10);
}

module.exports = { periodoActual, iso };
