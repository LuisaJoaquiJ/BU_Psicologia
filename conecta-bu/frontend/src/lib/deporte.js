// Utilidades compartidas por las pantallas del modulo Deporte.

export const DIAS = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };
export const DIAS_CORTOS = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom" };

export const COLOR_DEPORTE = "#EA580C";

const sinTildes = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Icono y color de cada disciplina (por nombre; las nuevas usan el balon).
export function estiloDisciplina(nombre) {
  const n = sinTildes(nombre);
  if (n.includes("nata")) return { icono: "ola", color: "#0284C7", fondo: "#E0F2FE" };
  if (n.includes("run") || n.includes("atlet") || n.includes("carrera")) return { icono: "rayo", color: "#EA580C", fondo: "#FFEDD5" };
  if (n.includes("ajedrez")) return { icono: "ajedrez", color: "#0B2A5B", fondo: "#E5E9F2" };
  if (n.includes("volei")) return { icono: "balon", color: "#CA8A04", fondo: "#FEF3C7" };
  if (n.includes("futbol")) return { icono: "balon", color: "#16A34A", fondo: "#DCFCE7" };
  if (n.includes("balonc")) return { icono: "balon", color: "#C2410C", fondo: "#FFEDD5" };
  if (n.includes("tenis")) return { icono: "balon", color: "#7C3AED", fondo: "#EDE9FE" };
  return { icono: "trofeo", color: "#163F86", fondo: "#E5E9F2" };
}

export const horas = (h) => `${Number(h || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 })} h`;

export function hoyISO() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function fechaCorta(iso) {
  if (!iso) return "";
  return new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

// Dia de hoy (1 lunes ... 7 domingo) en Colombia.
export function diaHoy() {
  const d = new Date(Date.now() - 5 * 3600 * 1000).getUTCDay();
  return d === 0 ? 7 : d;
}
