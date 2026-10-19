const { AppError } = require("../../../common/utils/AppError");

// Limpieza y formato de valores que llegan en las peticiones.

// Texto sin espacios repetidos, recortado a "max" (o null si queda vacio).
function texto(valor, max) {
  const t = String(valor ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

// Fecha "AAAA-MM-DD" (o null).
const fechaISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Numero entero dentro de un rango, con un mensaje claro si no lo es.
function entero(valor, etiqueta, min = 0, max = 100000) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, `${etiqueta} debe ser un número entero entre ${min} y ${max}.`);
  return n;
}

const redondear = (n) => Math.round(n * 100) / 100;

// Porcentaje con un decimal (null si no hay base).
const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);

// Cuenta elementos por una clave: [{grupoId}] -> Map(grupoId -> n).
function contarPor(lista, clave, cantidad = () => 1) {
  const mapa = new Map();
  for (const x of lista) mapa.set(x[clave], (mapa.get(x[clave]) || 0) + cantidad(x));
  return mapa;
}

const porId = (lista) => new Map(lista.map((x) => [x.id, x]));

module.exports = { texto, fechaISO, entero, redondear, porcentaje, contarPor, porId };
