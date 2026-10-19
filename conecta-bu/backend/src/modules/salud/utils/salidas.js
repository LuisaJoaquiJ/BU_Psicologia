const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");

// Salidas de Salud integral: el personal publica la salida (visita tecnica,
// practica de campo...), los estudiantes se inscriben con sus datos, su EPS
// y, si se pide, el comprobante de pago; el personal revisa cada inscripcion
// y descarga el listado para la ARL o el seguro.

const ESTADOS_SALIDA = ["Borrador", "Publicada", "Cerrada", "Cancelada"];
const ESTADOS_INSCRIPCION = ["Pendiente", "Aprobada", "Rechazada", "Cancelada"];
const OCUPAN_CUPO = ["Pendiente", "Aprobada"];
const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PA"];

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const texto = (v, max) => {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
};
const hora = (v, etiqueta) => {
  const t = texto(v, 5);
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new AppError(400, `${etiqueta} debe tener el formato HH:MM.`);
  return t;
};

function datosSalida(cuerpo = {}, actual = {}) {
  const v = (k) => (cuerpo[k] !== undefined ? cuerpo[k] : actual[k]);
  const nombre = texto(v("nombre"), 200);
  const destino = texto(v("destino"), 200);
  if (!nombre) throw new AppError(400, "Escribe el nombre de la salida.");
  if (!destino) throw new AppError(400, "Escribe el destino de la salida.");
  const fecha = (k, etiqueta) => {
    const valor = cuerpo[k] !== undefined ? cuerpo[k] : actual[k] ? iso(actual[k]) : null;
    if (!valor) throw new AppError(400, `Indica ${etiqueta}.`);
    return aFechaUTC(String(valor).slice(0, 10), etiqueta);
  };
  const fechaSalida = fecha("fechaSalida", "la fecha de salida");
  const fechaRegreso = fecha("fechaRegreso", "la fecha de regreso");
  const fechaLimiteInscripcion = fecha("fechaLimiteInscripcion", "la fecha límite de inscripción");
  if (fechaRegreso < fechaSalida) throw new AppError(400, "La fecha de regreso no puede ser anterior a la de salida.");
  if (fechaLimiteInscripcion > fechaSalida) throw new AppError(400, "Las inscripciones deben cerrar antes o el mismo día de la salida.");
  const cupos = Number(v("cupos"));
  if (!Number.isInteger(cupos) || cupos < 1) throw new AppError(400, "Los cupos deben ser un número entero mayor que 0.");
  const costoCrudo = v("costo");
  const costo = costoCrudo === null || costoCrudo === undefined || costoCrudo === "" ? null : Number(costoCrudo);
  if (costo !== null && (!Number.isInteger(costo) || costo < 0)) throw new AppError(400, "El costo debe ser un número entero en pesos.");
  return {
    nombre,
    destino,
    descripcion: texto(v("descripcion"), 4000),
    programa: texto(v("programa"), 150),
    responsable: texto(v("responsable"), 200),
    lugarEncuentro: texto(v("lugarEncuentro"), 200),
    fechaSalida,
    fechaRegreso,
    horaSalida: hora(v("horaSalida"), "La hora de salida"),
    horaRegreso: hora(v("horaRegreso"), "La hora de regreso"),
    cupos,
    costo,
    infoPago: texto(v("infoPago"), 4000),
    pideComprobante: Boolean(v("pideComprobante") === true || v("pideComprobante") === "true"),
    fechaLimiteInscripcion,
  };
}

function serializar(salida, c = {}) {
  const ocupados = (c.Pendiente || 0) + (c.Aprobada || 0);
  return {
    ...salida,
    fechaSalida: iso(salida.fechaSalida),
    fechaRegreso: iso(salida.fechaRegreso),
    fechaLimiteInscripcion: iso(salida.fechaLimiteInscripcion),
    inscritos: { pendientes: c.Pendiente || 0, aprobados: c.Aprobada || 0, rechazados: c.Rechazada || 0, total: ocupados },
    cuposDisponibles: Math.max(0, salida.cupos - ocupados),
    inscripcionAbierta: salida.estado === "Publicada" && salida.fechaLimiteInscripcion >= hoyBogota() && ocupados < salida.cupos,
  };
}

const publicaInscripcion = (i) => ({ ...i, tieneComprobante: Boolean(i.comprobante), comprobante: undefined });

module.exports = { ESTADOS_SALIDA, ESTADOS_INSCRIPCION, OCUPAN_CUPO, TIPOS_DOCUMENTO, iso, texto, hora, datosSalida, serializar, publicaInscripcion };
