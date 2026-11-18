// Ventana para registrar asistencia a un evento, igual que el backend
// (utils/ventanaAsistencia.js): desde la hora de inicio hasta 30 min despues
// de la hora de fin. Se permite mientras ahora < fin + 30 min; en el minuto 30
// exacto ya termino. Fecha a medianoche UTC y horas como hora de Bogota (UTC-5).
export const MARGEN_MS = 30 * 60 * 1000;
export const MENSAJE_EXPIRADO = "El plazo para registrar asistencia ya terminó";
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

function instanteBogota(fecha, hora) {
  const f = new Date(fecha);
  const h = new Date(hora);
  const base = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  return base + (h.getUTCHours() * 60 + h.getUTCMinutes()) * 60 * 1000 + DESFASE_BOGOTA_MS;
}

// Limite (ms) para registrar asistencia, o null si faltan la fecha u horas.
export function limiteAsistencia(evento) {
  if (!evento?.fecha || !evento?.horaInicio || !evento?.horaFin) return null;
  const inicio = instanteBogota(evento.fecha, evento.horaInicio);
  let fin = instanteBogota(evento.fecha, evento.horaFin);
  if (fin <= inicio) fin += DIA_MS; // termina despues de medianoche
  if (Number.isNaN(fin)) return null;
  return fin + MARGEN_MS;
}

// true desde fin + 30 min (incluido). Sin horas no se oculta nada.
export function asistenciaVencida(evento, ahora = Date.now()) {
  const limite = limiteAsistencia(evento);
  return limite !== null && ahora >= limite;
}
