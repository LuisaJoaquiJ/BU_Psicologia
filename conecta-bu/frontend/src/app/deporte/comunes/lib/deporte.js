// Utilidades compartidas por las pantallas del modulo Deporte.
import { useEffect, useState } from "react";

// Hora actual que se actualiza sola (para activar botones a la hora de inicio).
export function useAhora(cadaMs = 20000) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(t);
  }, [cadaMs]);
  return ahora;
}

// "6:00 a. m." de un instante ISO, en hora de Colombia.
export const horaCorta = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

// Estado del boton "Tomar asistencia" segun la clase de hoy del grupo.
export function estadoAsistencia(sugerencia, ahora) {
  if (!sugerencia?.hoyTieneClase) return { puede: false, motivo: "sinClase", texto: "Hoy no hay clase" };
  if (ahora < new Date(sugerencia.disponibleDesde).getTime()) return { puede: false, motivo: "temprano", texto: `Se activa a las ${horaCorta(sugerencia.disponibleDesde)}` };
  if (sugerencia.disponibleHasta && ahora > new Date(sugerencia.disponibleHasta).getTime()) return { puede: false, motivo: "terminada", texto: `La clase terminó a las ${horaCorta(sugerencia.disponibleHasta)}` };
  if (sugerencia.yaTomada) return { puede: false, motivo: "tomada", texto: "Asistencia de hoy tomada" };
  return { puede: true, texto: "Tomar asistencia" };
}

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
