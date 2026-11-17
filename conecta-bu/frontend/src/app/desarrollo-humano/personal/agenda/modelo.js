// Fechas y estados de la agenda del personal. Las horas de los horarios se
// guardan como hora de pared en UTC (lo que se escribe es lo que se ve) y el
// día de trabajo es el de Bogotá, igual que en el backend.

const ZONA = "America/Bogota";

export function ahoraBogota(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );
  const hora = Number(partes.hour);
  return {
    iso: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: (hora === 24 ? 0 : hora) * 60 + Number(partes.minute),
  };
}

export const dia = (cita) => String(cita?.horario?.fecha || "").slice(0, 10);

export function minutosUTC(horaIso) {
  if (!horaIso) return null;
  const d = new Date(horaIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function isoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

export function addDias(fecha, n) {
  const r = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function lunesDe(fecha) {
  const d = fecha instanceof Date ? fecha : parseISO(fecha);
  return addDias(d, -((d.getDay() + 6) % 7));
}

export function celdasDelMes(anio, mes) {
  const inicio = lunesDe(new Date(anio, mes, 1));
  const ultimo = new Date(anio, mes + 1, 0);
  const fin = addDias(lunesDe(ultimo), 7);
  const celdas = [];
  for (let d = inicio; d < fin; d = addDias(d, 1)) celdas.push(d);
  return celdas;
}

const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function nombreMes(mes) {
  const texto = MES[mes] || "";
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fechaLegible(iso) {
  const d = parseISO(iso);
  const texto = `${DIA[d.getDay()]} ${d.getDate()} de ${MES[d.getMonth()]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diaCorto(iso) {
  return DIA_CORTO[parseISO(iso).getDay()];
}

export function tituloSemana(lunes, dias) {
  const ultimo = dias[dias.length - 1];
  const a = lunes;
  const b = ultimo;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${b.getDate()} de ${MES[b.getMonth()]} de ${b.getFullYear()}`;
  }
  return `${a.getDate()} de ${MES[a.getMonth()]} – ${b.getDate()} de ${MES[b.getMonth()]} de ${b.getFullYear()}`;
}

export function rangoSemanaActual(hoyIso) {
  const lunes = lunesDe(hoyIso);
  const viernes = addDias(lunes, 4);
  const corto = (d) => `${DIA_CORTO[d.getDay()]} ${d.getDate()}`;
  const mes = MES[viernes.getMonth()].slice(0, 3);
  return {
    desde: isoDe(lunes),
    hasta: isoDe(viernes),
    texto: `${corto(lunes)} – ${corto(viernes)} ${mes}. · sin canceladas`,
  };
}

export function mesClave(iso) {
  return String(iso || "").slice(0, 7);
}

export function mesPrevio(isoHoy) {
  const d = parseISO(isoHoy);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { clave: `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`, nombre: MES[prev.getMonth()] };
}

// El personal puede corregir un cierre automático durante 7 días (mismo plazo del backend).
export const DIAS_CORRECCION_CIERRE = 7;

export function cierreVigente(cita, ahora = new Date()) {
  if (!cita?.cerradaAutomaticamente) return false;
  const cerrado = new Date(cita.cerradaAutomaticamente).getTime();
  if (Number.isNaN(cerrado)) return false;
  return ahora.getTime() <= cerrado + DIAS_CORRECCION_CIERRE * 864e5;
}

// Instante real de inicio: la hora de pared guardada en UTC, en el reloj de Bogotá.
function inicioReal(cita) {
  const d = dia(cita);
  const ini = minutosUTC(cita.horario?.horaInicio);
  if (!d || ini == null) return null;
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day, Math.floor(ini / 60), ini % 60) + 5 * 60 * 60 * 1000;
}

// "Por registrar": agendada cuya hora ya pasó, o cerrada por el sistema y aún corregible.
export function esPorRegistrar(cita, hoy, ahoraMin, ahora = new Date()) {
  if (cierreVigente(cita, ahora)) return true;
  if (cita?.estado !== "Agendada") return false;
  const d = dia(cita);
  if (!d || d > hoy) return false;
  if (d < hoy) return true;
  const ini = minutosUTC(cita.horario?.horaInicio);
  return ini != null && ini <= ahoraMin;
}

// Asistencia de una cita agendada de hoy o de un día anterior, y de las que
// el sistema cerró y todavía están dentro de los 7 días.
export function puedeRegistrar(cita, hoy, ahora = new Date()) {
  if (cierreVigente(cita, ahora)) return true;
  return cita?.estado === "Agendada" && dia(cita) <= hoy;
}

// Solo una cita agendada que todavía no empieza. Una ya iniciada se registra, no se mueve.
export function puedeReprogramar(cita, ahora = new Date()) {
  if (!cita || cita.estado !== "Agendada" || cita.horario?.sinCita || cita.cerradaAutomaticamente) return false;
  const inicio = inicioReal(cita);
  return inicio != null && inicio > ahora.getTime();
}

export function claveVisual(cita, hoy, ahoraMin, ahora = new Date()) {
  if (cita.cerradaAutomaticamente) return "cerrada";
  if (cita.estado === "Cancelada") return "cancelada";
  if (cita.estado === "Atendida") return "atendida";
  if (cita.estado === "NoAsistio") return "noasistio";
  if (esPorRegistrar(cita, hoy, ahoraMin, ahora)) return "registrar";
  return "agendada";
}

export const ESTILOS = {
  agendada: {
    texto: "Agendada",
    leyenda: "Agendada",
    badge: "bg-[#E3EEFB] text-[#1C5CAB]",
    bloque: "bg-[#E8F0FB] text-[#1C5CAB] border-[#1C5CAB]",
    punto: "bg-[#1C5CAB]",
  },
  registrar: {
    texto: "Por registrar",
    leyenda: "Por registrar",
    badge: "bg-[#FFF6E0] text-[#7A5405]",
    bloque: "bg-[#FFF6E0] text-[#7A5405] border-[#E0B03A]",
    punto: "bg-[#E0B03A]",
  },
  cerrada: {
    texto: "Cerrada automáticamente",
    leyenda: "Cerrada automáticamente",
    badge: "bg-[#EEF1F6] text-[#3D4C63]",
    bloque: "bg-[#EEF1F6] text-[#3D4C63] border-[#6B7A8D]",
    punto: "bg-[#6B7A8D]",
  },
  atendida: {
    texto: "Asistió",
    leyenda: "Atendida",
    badge: "bg-[#DDF3EA] text-[#0E6B4A]",
    bloque: "bg-[#DDF3EA] text-[#0E6B4A] border-[#0E6B4A]",
    punto: "bg-[#1baf7a]",
  },
  noasistio: {
    texto: "No asistió",
    leyenda: "No asistió",
    badge: "bg-red-50 text-red-700",
    bloque: "bg-[#FDECEC] text-red-700 border-red-600",
    punto: "bg-red-600",
  },
  cancelada: {
    texto: "Cancelada",
    leyenda: "Cancelada",
    badge: "bg-gray-100 text-ink-500",
    bloque: "bg-gray-100 text-ink-500 border-gray-400",
    punto: "bg-gray-400",
  },
};

export const ORDEN_LEYENDA = ["agendada", "registrar", "cerrada", "atendida", "noasistio", "cancelada"];

export function hora12(minutos, { conSufijo = true } = {}) {
  if (minutos == null) return "";
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const mm = String(m).padStart(2, "0");
  const h12 = h % 12 || 12;
  if (!conSufijo) return `${h12}:${mm}`;
  if (h === 12 && m === 0) return "12 m.";
  const sufijo = h < 12 ? "a. m." : "p. m.";
  if (m === 0) return `${h12} ${sufijo}`;
  return `${h12}:${mm} ${sufijo}`;
}

export function rangoHora(cita) {
  const ini = minutosUTC(cita.horario?.horaInicio);
  const fin = minutosUTC(cita.horario?.horaFin);
  return { ini: ini ?? 0, fin: fin != null && fin > (ini ?? 0) ? fin : (ini ?? 0) + 45 };
}

// Reparte citas que se cruzan en columnas para que no se tapen.
export function colocar(citas) {
  const items = citas
    .map((cita) => ({ cita, ...rangoHora(cita) }))
    .sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  const finDeColumna = [];
  for (const it of items) {
    let col = finDeColumna.findIndex((fin) => fin <= it.ini);
    if (col < 0) {
      col = finDeColumna.length;
      finDeColumna.push(it.fin);
    } else finDeColumna[col] = it.fin;
    it.col = col;
  }
  const cols = Math.max(1, finDeColumna.length);
  return items.map((it) => ({ ...it, cols }));
}

export function servicioCorto(nombre = "") {
  if (/taller/i.test(nombre)) return "Taller";
  if (/orient/i.test(nombre)) return "Orientación";
  return nombre;
}

export function sinTildes(t) {
  return String(t || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function correoDe(cita) {
  return cita?.usuario?.emailInstitucional || "";
}

export function bloqueosDelDia(bloqueos, iso) {
  return (bloqueos || []).filter((b) => b.fechaInicio <= iso && b.fechaFin >= iso);
}

export function tasaMes(citas, clave) {
  const base = citas.filter((c) => mesClave(dia(c)) === clave && (c.estado === "Atendida" || c.estado === "NoAsistio"));
  if (!base.length) return null;
  const asistieron = base.filter((c) => c.estado === "Atendida").length;
  return Math.round((100 * asistieron) / base.length);
}

export const CUANDO = [
  { id: "proximas", texto: "Próximas", filtro: (c, ctx) => dia(c) >= ctx.hoy && c.estado !== "Cancelada" },
  { id: "registrar", texto: "Por registrar", filtro: (c, ctx) => esPorRegistrar(c, ctx.hoy, ctx.ahoraMin) },
  { id: "pasadas", texto: "Pasadas", filtro: (c, ctx) => dia(c) < ctx.hoy },
  { id: "dia", texto: "Un día", filtro: (c, ctx) => dia(c) === ctx.fecha },
  { id: "todas", texto: "Todas", filtro: () => true },
];

export const ESTADOS = [
  { id: "todas", texto: "Todos los estados" },
  { id: "Agendada", texto: "Agendadas" },
  { id: "Atendida", texto: "Asistieron" },
  { id: "NoAsistio", texto: "No asistieron" },
  { id: "Cancelada", texto: "Canceladas" },
];

export function diasVisibles(lunes, citas, bloqueos) {
  const hayFinde = [5, 6].some((n) => {
    const iso = isoDe(addDias(lunes, n));
    return citas.some((c) => dia(c) === iso) || bloqueosDelDia(bloqueos, iso).length > 0;
  });
  const n = hayFinde ? 7 : 5;
  return Array.from({ length: n }, (_, i) => addDias(lunes, i));
}

export function limitesHoras(citas, bloqueos = []) {
  let desde = 8 * 60;
  let hasta = 18 * 60;
  const ampliar = (ini, fin) => {
    if (ini == null || fin == null || fin <= ini) return;
    desde = Math.min(desde, Math.floor(ini / 60) * 60);
    hasta = Math.max(hasta, Math.ceil(fin / 60) * 60);
  };
  for (const c of citas) {
    const { ini, fin } = rangoHora(c);
    ampliar(ini, fin);
  }
  for (const b of bloqueos) {
    if (b.todoElDia) continue;
    ampliar(minutosUTC(b.horaInicio), minutosUTC(b.horaFin));
  }
  desde = Math.max(0, desde);
  hasta = Math.min(24 * 60, Math.max(hasta, desde + 60));
  return { desde, hasta };
}
