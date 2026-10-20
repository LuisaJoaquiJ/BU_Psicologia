const { AppError } = require("../../../../common/utils/AppError");
const { aFechaUTC } = require("../../../../common/utils/fechas");

// Estados y datos editables del informe de gestion.
const MODULO = "salud";
const EDITABLES = ["Borrador", "Devuelto"];
const ESTADOS = { Borrador: "Borrador", Enviado: "Enviado", Devuelto: "Devuelto", Aprobado: "Aprobado" };

function texto(v, max = 8000) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

function limpiarObjetivos(lista) {
  if (!Array.isArray(lista)) return null;
  return lista
    .slice(0, 12)
    .map((o) => ({ objetivo: texto(o?.objetivo, 3000), resultado: texto(o?.resultado, 3000), beneficio: texto(o?.beneficio, 3000) }))
    .filter((o) => o.objetivo || o.resultado || o.beneficio);
}

function serializar(informe) {
  if (!informe) return null;
  const { datosEnviados, ...resto } = informe;
  return { ...resto, editable: EDITABLES.includes(informe.estado), tieneCifrasEnviadas: Boolean(datosEnviados) };
}

function datosEditables(cuerpo = {}) {
  const data = {};
  if (cuerpo.responsable !== undefined) data.responsable = texto(cuerpo.responsable, 200);
  for (const campo of ["descripcion", "justificacion", "alineacion", "logros", "dificultades", "accionesMejora"]) {
    if (cuerpo[campo] !== undefined) data[campo] = texto(cuerpo[campo]);
  }
  for (const campo of ["accionMejora", "accionCorrectiva", "accionPreventiva"]) {
    if (cuerpo[campo] !== undefined) data[campo] = cuerpo[campo] === true;
  }
  if (cuerpo.fechaPresentacion !== undefined) {
    data.fechaPresentacion = cuerpo.fechaPresentacion ? aFechaUTC(String(cuerpo.fechaPresentacion).slice(0, 10), "fecha de presentación") : null;
  }
  if (cuerpo.objetivos !== undefined) data.objetivos = limpiarObjetivos(cuerpo.objetivos);
  return data;
}

function nombreArchivo(informe, extension) {
  return `informe-gestion-${informe.modulo}-${informe.periodo}${informe.estado === "Borrador" ? "-borrador" : ""}.${extension}`;
}

// Entero de las cifras historicas (vacio = 0, o null si es opcional).
function entero(v, campo, opcional) {
  if (v === "" || v === null || v === undefined) return opcional ? null : 0;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new AppError(400, `El valor de ${campo} no es válido.`);
  return n;
}

module.exports = { MODULO, EDITABLES, ESTADOS, texto, serializar, datosEditables, nombreArchivo, entero };
