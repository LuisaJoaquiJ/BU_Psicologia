const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, aHoraUTC, hoyUTC } = require("../../../common/utils/fechas");

// Reglas de los eventos y talleres de Desarrollo Humano (RF-009 / RF-010).

const ESTADOS_EVENTO = ["Borrador", "Publicado", "Cerrado", "Cancelado"];
const MODALIDADES = ["Presencial", "Virtual", "Hibrida"];

function inscritosConfirmados(evento) {
  return evento?._count?.inscripciones ?? 0;
}

function exigirEstadoValido(estado) {
  if (!ESTADOS_EVENTO.includes(estado)) throw new AppError(400, `Estado no valido. Usa uno de: ${ESTADOS_EVENTO.join(", ")}.`);
}

function validarCupos(cupos) {
  const numero = Number(cupos);
  if (!Number.isInteger(numero) || numero < 1) throw new AppError(400, "Los cupos deben ser un numero entero mayor o igual a 1.");
  return numero;
}

// Enlace de reunion (Meet, Teams, Zoom...): una direccion web completa.
function validarEnlace(valor) {
  const texto = String(valor || "").trim();
  if (!texto) throw new AppError(400, "Escribe el enlace de la reunion virtual.");
  const invalido = "El enlace de la reunion no es valido. Copialo completo desde Meet, Teams o Zoom.";
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
  } catch {
    throw new AppError(400, invalido);
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new AppError(400, invalido);
  if (url.href.length > 500) throw new AppError(400, "El enlace de la reunion es demasiado largo.");
  return url.href;
}

// Valor nuevo si vino en el formulario; si no, el actual (o null).
const opcional = (nuevo, actual) => (nuevo !== undefined ? nuevo || null : (actual ?? null));

// RF-009: valida y normaliza los datos del formulario.
function normalizarEvento(datos, actual = {}) {
  const nombre = (datos.nombre ?? actual.nombre ?? "").trim();
  if (!nombre) throw new AppError(400, "El nombre del evento es obligatorio.");

  const fecha = datos.fecha ? aFechaUTC(datos.fecha, "fecha del evento") : actual.fecha;
  const horaInicio = datos.horaInicio ? aHoraUTC(datos.horaInicio, "hora de inicio") : actual.horaInicio;
  const horaFin = datos.horaFin ? aHoraUTC(datos.horaFin, "hora de fin") : actual.horaFin;
  if (horaInicio >= horaFin) throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");

  const fechaLimiteInscripcion = datos.fechaLimiteInscripcion
    ? aFechaUTC(datos.fechaLimiteInscripcion, "fecha limite de inscripcion")
    : actual.fechaLimiteInscripcion;
  if (fechaLimiteInscripcion > fecha) throw new AppError(400, "La fecha limite de inscripcion no puede ser posterior a la fecha del evento.");

  const modalidad = datos.modalidad !== undefined ? datos.modalidad : actual.modalidad || "Presencial";
  if (!MODALIDADES.includes(modalidad)) throw new AppError(400, "La modalidad debe ser presencial, virtual o hibrida.");
  const enlaceReunion = modalidad === "Presencial" ? null : validarEnlace(datos.enlaceReunion !== undefined ? datos.enlaceReunion : actual.enlaceReunion);

  return {
    nombre,
    modalidad,
    enlaceReunion,
    descripcion: opcional(datos.descripcion, actual.descripcion),
    lugar: opcional(datos.lugar, actual.lugar),
    fecha,
    horaInicio,
    horaFin,
    cupos: datos.cupos !== undefined ? validarCupos(datos.cupos) : actual.cupos,
    fechaLimiteInscripcion,
  };
}

function inscripcionAbierta(evento) {
  return evento.estado === "Publicado" && evento.fechaLimiteInscripcion >= hoyUTC();
}

// El enlace de la reunion solo se entrega a quien tiene la inscripcion confirmada.
function sinEnlaceSiNoInscrito(evento, miInscripcion) {
  return miInscripcion?.estado === "Confirmada" ? evento : { ...evento, enlaceReunion: null };
}

module.exports = { ESTADOS_EVENTO, MODALIDADES, inscritosConfirmados, exigirEstadoValido, normalizarEvento, inscripcionAbierta, sinEnlaceSiNoInscrito };
