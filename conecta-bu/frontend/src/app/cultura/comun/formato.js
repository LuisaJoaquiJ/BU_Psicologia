export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function horarioTexto(horario = []) {
  return horario.map((h) => `${DIAS[h.dia] || ""} ${h.inicio}–${h.fin}`).join(" · ");
}

export function mensajeError(err, respaldo) {
  return err?.response?.data?.message || respaldo;
}
