// Utilidades de conteo para el tablero del superadministrador.

// "2026-10" a partir de una fecha (las fechas @db.Date llegan en UTC).
function claveMes(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function contarPor(lista, clave) {
  const mapa = {};
  for (const x of lista) {
    const k = clave(x);
    if (k === null || k === undefined) continue;
    mapa[k] = (mapa[k] || 0) + 1;
  }
  return mapa;
}

const ordenar = (mapa, etiquetas = {}) =>
  Object.entries(mapa)
    .map(([id, total]) => ({ id, nombre: etiquetas[id] || id, total }))
    .sort((a, b) => b.total - a.total);

const tasa = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);
const redondear = (n) => Math.round(n * 10) / 10;

module.exports = { claveMes, contarPor, ordenar, tasa, redondear };
