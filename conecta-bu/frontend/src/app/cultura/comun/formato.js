export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function horarioTexto(horario = []) {
  return horario.map((h) => `${DIAS[h.dia] || ""} ${h.inicio}–${h.fin}`).join(" · ");
}

// Hoy en Colombia (UTC-5), como "AAAA-MM-DD".
export const hoyISO = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

export function mensajeError(err, respaldo) {
  return err?.response?.data?.message || respaldo;
}
