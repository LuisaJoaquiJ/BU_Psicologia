const { AppError } = require("./AppError");

// Helpers de fecha/hora compartidos (Sprint 4). Igual que en horarios, las
// fechas se guardan como "YYYY-MM-DD" a medianoche UTC (columna @db.Date) y
// las horas con una fecha de referencia fija (1970-01-01) en UTC
// (columna @db.Time), para que lo que escribe el administrador sea lo mismo
// que se muestra, sin desfases por zona horaria.
function aFechaUTC(fechaStr, campo = "fecha") {
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr || "") || Number.isNaN(fecha.getTime())) {
    throw new AppError(400, `La ${campo} no es valida (usa el formato AAAA-MM-DD).`);
  }
  return fecha;
}

function aHoraUTC(horaStr, campo = "hora") {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(horaStr || "");
  if (!match) {
    throw new AppError(400, `La ${campo} debe tener el formato HH:mm.`);
  }
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0));
}

// "Hoy" como fecha UTC a medianoche, tomando el dia calendario del servidor.
function hoyUTC() {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

module.exports = { aFechaUTC, aHoraUTC, hoyUTC };
