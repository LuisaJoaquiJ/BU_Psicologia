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
