const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");

// Utilidades del modulo Deporte (periodos, horarios y horas).

const DIAS = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };
const TIPOS = ["Individual", "Colectivo", "Mental"];

function periodoDeFecha(fecha) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

function periodoActual() {
  return periodoDeFecha(hoyBogota());
}

function validarPeriodo(periodo) {
  const p = String(periodo || "").trim();
  if (!/^\d{4}-[12]$/.test(p)) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return p;
}

// Dia de la semana de una fecha (1 lunes ... 7 domingo).
function diaSemana(fecha) {
  const d = new Date(fecha).getUTCDay();
  return d === 0 ? 7 : d;
}

function hora(valor, etiqueta = "La hora") {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(valor || "").trim());
  if (!m) throw new AppError(400, `${etiqueta} debe tener el formato HH:mm.`);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const minutos = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Horas entre dos horas del dia, con dos decimales.
function horasEntre(inicio, fin) {
  const diferencia = minutos(fin) - minutos(inicio);
  if (diferencia <= 0) throw new AppError(400, "La hora final debe ser posterior a la inicial.");
  if (diferencia > 8 * 60) throw new AppError(400, "Una sesión no puede durar más de 8 horas.");
  return Math.round((diferencia / 60) * 100) / 100;
}

function validarHorario(horario) {
  if (!Array.isArray(horario) || horario.length === 0) throw new AppError(400, "Agrega al menos un día y hora al horario del grupo.");
  if (horario.length > 7) throw new AppError(400, "El horario admite máximo 7 franjas.");
  const limpio = horario.map((h) => {
    const dia = Number(h?.dia);
    if (!DIAS[dia]) throw new AppError(400, "El día del horario no es válido.");
    const inicio = hora(h.inicio, "La hora de inicio");
    const fin = hora(h.fin, "La hora final");
    horasEntre(inicio, fin);
    return { dia, inicio, fin };
  });
  for (let i = 0; i < limpio.length; i += 1) {
    for (let j = i + 1; j < limpio.length; j += 1) {
      if (seCruzan(limpio[i], limpio[j])) throw new AppError(400, `El horario tiene dos franjas que se cruzan el ${DIAS[limpio[i].dia].toLowerCase()}.`);
    }
  }
  return limpio.sort((a, b) => a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio));
}

function seCruzan(a, b) {
  return a.dia === b.dia && minutos(a.inicio) < minutos(b.fin) && minutos(b.inicio) < minutos(a.fin);
}

// Primer cruce entre dos horarios (o null).
function cruceEntre(horarioA, horarioB) {
  for (const a of horarioA || []) for (const b of horarioB || []) if (seCruzan(a, b)) return a;
  return null;
}

function textoHorario(horario) {
  return (horario || []).map((h) => `${DIAS[h.dia]} ${h.inicio}-${h.fin}`).join(" · ");
}

const redondear = (n) => Math.round(n * 100) / 100;

module.exports = {
  DIAS,
  TIPOS,
  periodoDeFecha,
  periodoActual,
  validarPeriodo,
  diaSemana,
  hora,
  horasEntre,
  validarHorario,
  cruceEntre,
  textoHorario,
  redondear,
  minutos,
};
