const { AppError } = require("../../../common/utils/AppError");

// Utilidades de la agenda de citas de Desarrollo Humano. Los horarios guardan
// la fecha a medianoche UTC (@db.Date) y la "hora del dia" sobre una fecha
// fija (1970-01-01) en UTC (@db.Time): lo que escribe el personal es lo que
// se muestra, sin desfases por zona horaria.

// Colombia no tiene horario de verano: hora de Bogota = UTC-5.
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;

// Motivos de tiempo no disponible del personal.
const MOTIVOS = [
  "Compromiso institucional",
  "Reunión",
  "Capacitación",
  "Salida institucional",
  "Permiso laboral",
  "Incapacidad",
  "Vacaciones",
  "Calamidad doméstica",
  "Otro",
];

// Duraciones (minutos) de una atencion sin cita.
const DURACIONES = [15, 20, 30, 45, 60, 90];

function fechaHorario(fechaStr) {
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) throw new AppError(400, "La fecha del horario no es valida.");
  return fecha;
}

function horaHorario(horaStr) {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(horaStr || "");
  if (!match) throw new AppError(400, "La hora debe tener el formato HH:mm.");
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0));
}

// Instante real en que empieza una cita (fecha + hora del horario).
function inicioDeCita(horario) {
  const fecha = new Date(horario.fecha);
  const hora = horario.horaInicio ? new Date(horario.horaInicio) : new Date(Date.UTC(1970, 0, 1, 0, 0));
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hora.getUTCHours(), hora.getUTCMinutes()) + DESFASE_BOGOTA_MS);
}

// Instante real en que termina una cita (fecha + hora final del horario).
function finDeCita(horario) {
  return inicioDeCita({ fecha: horario.fecha, horaInicio: horario.horaFin });
}

// Hora actual en Bogota como "HH:mm".
function horaBogota() {
  const d = new Date(Date.now() - DESFASE_BOGOTA_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const ms = (d) => (d ? new Date(d).getTime() : 0);
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// ¿El bloqueo cubre ese dia y ese rango de horas?
function cruza(bloqueo, fecha, horaInicio, horaFin) {
  const dia = ms(fecha);
  if (dia < ms(bloqueo.fechaInicio) || dia > ms(bloqueo.fechaFin)) return false;
  if (bloqueo.todoElDia) return true;
  return ms(horaInicio) < ms(bloqueo.horaFin) && ms(horaFin) > ms(bloqueo.horaInicio);
}

function texto(v, max) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

const esVerdadero = (v) => v === true || v === "true";

module.exports = { MOTIVOS, DURACIONES, fechaHorario, horaHorario, inicioDeCita, finDeCita, horaBogota, ms, iso, cruza, texto, esVerdadero };
