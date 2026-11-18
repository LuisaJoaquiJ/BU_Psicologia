const { AppError } = require("../../../common/utils/AppError");

// Ventana para registrar asistencia a un evento: desde la hora de inicio hasta
// 30 minutos despues de la hora de fin. La fecha se guarda a medianoche UTC
// (@db.Date) y las horas como hora local de Bogota (UTC-5) en @db.Time.
const MARGEN_MS = 30 * 60 * 1000;
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const MENSAJE_EXPIRADO = "El plazo para registrar asistencia ya terminó";
const MENSAJE_NO_INICIADO = "La asistencia se habilita cuando empiece el evento.";

function minutosDelDia(hora) {
  const h = new Date(hora);
  return h.getUTCHours() * 60 + h.getUTCMinutes();
}

// Instante real (UTC) de una hora de Bogota en la fecha del evento.
function instanteBogota(fecha, hora) {
  const f = new Date(fecha);
  const base = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  return base + minutosDelDia(hora) * 60 * 1000 + DESFASE_BOGOTA_MS;
}

// { inicio, fin, limite } como Date. limite = fin + 30 min.
function ventanaAsistencia(evento) {
  const inicio = instanteBogota(evento.fecha, evento.horaInicio);
  let fin = instanteBogota(evento.fecha, evento.horaFin);
  if (fin <= inicio) fin += DIA_MS; // termina despues de medianoche
  return { inicio: new Date(inicio), fin: new Date(fin), limite: new Date(fin + MARGEN_MS) };
}

// "antes" | "abierta" | "expirada"
function estadoVentana(evento, ahora = new Date()) {
  const { inicio, limite } = ventanaAsistencia(evento);
  const t = new Date(ahora).getTime();
  if (t < inicio.getTime()) return "antes";
  // Permitido mientras t < fin + 30 min; en el minuto 30 exacto ya terminó.
  if (t >= limite.getTime()) return "expirada";
  return "abierta";
}

const estaEnVentana = (evento, ahora = new Date()) => estadoVentana(evento, ahora) === "abierta";

// Lanza 409 si se intenta registrar fuera de [inicio, fin + 30 min].
function exigirVentana(evento, ahora = new Date()) {
  const estado = estadoVentana(evento, ahora);
  if (estado === "antes") throw new AppError(409, MENSAJE_NO_INICIADO, "ASISTENCIA_NO_INICIADA");
  if (estado === "expirada") throw new AppError(409, MENSAJE_EXPIRADO, "ASISTENCIA_EXPIRADA");
}

// Para el frontend: limites de la ventana y su estado actual.
function resumenVentana(evento, ahora = new Date()) {
  return { ...ventanaAsistencia(evento), estado: estadoVentana(evento, ahora) };
}

module.exports = {
  MARGEN_MS,
  MENSAJE_EXPIRADO,
  MENSAJE_NO_INICIADO,
  ventanaAsistencia,
  estadoVentana,
  estaEnVentana,
  exigirVentana,
  resumenVentana,
};
