// Helpers de formato para fechas/horas de horarios y citas (Sprint 2).
// Los horarios se guardan en UTC con una fecha "de referencia" fija para la
// hora (ver backend/prisma/seed.js), por eso siempre formateamos en UTC:
// asi la hora que se ve coincide con la hora que se guardo, sin desfases
// por la zona horaria del navegador de quien lo use.

export function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  return new Date(fechaIso).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function formatearHora(horaIso) {
  if (!horaIso) return "";
  return new Date(horaIso).toLocaleTimeString("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

// Convierte una fecha/hora ISO (siempre en UTC, ver arriba) al valor que
// esperan los inputs <input type="date"> ("YYYY-MM-DD") y
// <input type="time"> ("HH:mm"), usada por los formularios del Administrador
// (Sprint 3 · HU-13, HU-14) para precargar y filtrar.
export function fechaInputUTC(fechaIso) {
  if (!fechaIso) return "";
  return new Date(fechaIso).toISOString().slice(0, 10);
}

export function horaInputUTC(horaIso) {
  if (!horaIso) return "";
  return new Date(horaIso).toISOString().slice(11, 16);
}
