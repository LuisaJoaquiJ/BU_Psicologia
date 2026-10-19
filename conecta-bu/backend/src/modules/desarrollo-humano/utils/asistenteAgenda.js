const { inicioDeCita } = require("./agenda");
const { SUGERENCIAS, normalizar, fechaTexto, horaTexto } = require("./asistenteSeguridad");

// ---------------------------------------------------------------------------
// Agendar desde el asistente. El asistente busca horarios libres que coincidan
// con lo que pide el estudiante (dia, hora, franja, servicio) y los ofrece como
// opciones; la cita se crea cuando el estudiante elige una (un clic o «la
// primera»), usando el mismo endpoint y las mismas reglas que «Agendar cita»
// (RN-003, RN-004). La IA nunca crea citas por su cuenta.
// ---------------------------------------------------------------------------

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MAX_OPCIONES = 4;

const PATRON_PIDE_CITA =
  /(quiero|quisiera|necesito|me gustaria|puedes|podrias|ayudame a|agendame|agendarme|reservame|separame|apartame|programame|pedir|sacar|dame|busca|buscame).{0,30}(cita|agend|reserv|turno|horario)|agendame|agendarme|reservame|separame/;
const PATRON_CITA = /(agend|cita|reserv|turno|horario|disponib|espacio libre)/;

// Hoy en Bogota como fecha UTC a medianoche (asi se guardan las fechas).
function hoyBogotaUTC() {
  const ahora = new Date(Date.now() - 5 * 3600e3);
  return Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
}

// Preferencias que el estudiante escribio: dia, hora, franja y servicio.
function leerPreferencias(t, servicios) {
  const pref = {};
  const hoy = hoyBogotaUTC();
  if (/pasado manana/.test(t)) pref.fecha = hoy + 2 * 864e5;
  else if (/(^|[^a-z])(para |el dia de )?manana($|[^a-z])/.test(t) && !/(la|por|en|de|esta) manana/.test(t)) pref.fecha = hoy + 864e5;
  else if (/(^|[^a-z])hoy($|[^a-z])/.test(t)) pref.fecha = hoy;

  const dia = DIAS.findIndex((d) => new RegExp(`(^|[^a-z])${d}($|[^a-z])`).test(t));
  if (dia >= 0) pref.diaSemana = dia;

  const fechaNum = t.match(/(?:el|dia)\s+(\d{1,2})(?:\s+de\s+([a-z]+))?(?![:\d]|\s*(?:am|pm|a\.? ?m|p\.? ?m))/);
  if (fechaNum && !/a las?\s+$/.test(t.slice(0, fechaNum.index + 3))) {
    const d = Number(fechaNum[1]);
    if (d >= 1 && d <= 31) {
      pref.diaMes = d;
      const mes = MESES.indexOf(fechaNum[2] || "");
      if (mes >= 0) pref.mes = mes;
    }
  }

  const hora = t.match(/(?:a las?|las|tipo|como a las|despues de las|antes de las)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.? ?m\.?|p\.? ?m\.?)?/);
  if (hora) {
    let h = Number(hora[1]);
    const sufijo = (hora[3] || "").replace(/[\s.]/g, "");
    if (sufijo === "pm" && h < 12) h += 12;
    if (sufijo === "am" && h === 12) h = 0;
    if (!sufijo && h >= 1 && h <= 6) h += 12; // «a las 3» en horario de oficina es en la tarde
    if (h >= 0 && h <= 23) pref.minutos = h * 60 + Number(hora[2] || 0);
  }
  if (/(en|por|de) la tarde/.test(t)) pref.franja = "tarde";
  else if (/(en|por|de) la manana|temprano/.test(t)) pref.franja = "manana";

  const servicio = servicios.find((s) =>
    normalizar(s.nombre)
      .split(/[^a-z]+/)
      .filter((p) => p.length > 5)
      .some((p) => t.includes(p.slice(0, 7))),
  );
  if (servicio && servicios.length > 1) pref.servicioId = servicio.id;
  return pref;
}

const minutosDe = (h) => {
  const d = new Date(h.horaInicio);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

function cumpleDia(h, p) {
  const f = new Date(h.fecha);
  if (p.fecha !== undefined && f.getTime() !== p.fecha) return false;
  if (p.diaSemana !== undefined && f.getUTCDay() !== p.diaSemana) return false;
  if (p.diaMes !== undefined && f.getUTCDate() !== p.diaMes) return false;
  if (p.mes !== undefined && f.getUTCMonth() !== p.mes) return false;
  return true;
}
function cumpleHora(h, p) {
  const m = minutosDe(h);
  if (p.minutos !== undefined && m !== p.minutos) return false;
  if (p.franja === "manana" && m >= 12 * 60) return false;
  if (p.franja === "tarde" && m < 12 * 60) return false;
  return true;
}

function aOpcion(h) {
  return {
    horarioId: h.id,
    servicio: h.servicio?.nombre || "Orientación",
    fecha: fechaTexto(h.fecha),
    hora: horaTexto(h.horaInicio),
  };
}

// Arma la respuesta con horarios para agendar. Devuelve null si no aplica.
function proponerHorarios(t, contexto, horarios, servicios, { forzar = false } = {}) {
  const pref = leerPreferencias(t, servicios);
  const conPreferencias = Object.keys(pref).length > 0;
  if (!forzar && !conPreferencias && !PATRON_PIDE_CITA.test(t)) return null;

  if (contexto.misCitas.length) {
    const c = contexto.misCitas[0];
    return {
      respuesta:
        `Ya tienes una cita de ${c.servicio} el ${c.fecha} a las ${c.hora.replace(/\.$/, "")}. Solo puedes tener una cita activa a la vez. ` +
        (c.sePuedeCancelar
          ? "Si quieres otro horario, primero cancélala en «Mis citas» y luego te ayudo a agendar la nueva."
          : "Ya no se puede cancelar porque faltan menos de 24 horas; si no puedes asistir, comunícate con Bienestar."),
      sugerencias: [SUGERENCIAS.misCitas],
    };
  }

  const ahora = Date.now();
  let libres = horarios.filter((h) => inicioDeCita(h).getTime() > ahora);
  if (!libres.length) {
    return {
      respuesta: "En este momento no hay horarios libres para agendar. Vuelve a revisar pronto: el personal publica nuevos horarios cada semana.",
      sugerencias: [SUGERENCIAS.servicios],
    };
  }
  if (pref.servicioId) libres = libres.filter((h) => h.servicioId === pref.servicioId);

  const delDia = libres.filter((h) => cumpleDia(h, pref));
  const exactos = delDia.filter((h) => cumpleHora(h, pref));
  const quiereDia = pref.fecha !== undefined || pref.diaSemana !== undefined || pref.diaMes !== undefined;
  const quiereHora = pref.minutos !== undefined || pref.franja;

  let lista;
  let texto;
  if (exactos.length && conPreferencias) {
    lista = exactos;
    texto =
      exactos.length === 1
        ? "Encontré este horario libre. ¿Lo agendo?"
        : "Encontré estos horarios libres. Elige el que prefieras y lo agendo:";
  } else if (conPreferencias && (quiereDia || quiereHora)) {
    // No hay justo lo pedido: se ofrecen los mas cercanos.
    const base = quiereDia && delDia.length ? delDia : libres;
    lista = pref.minutos !== undefined ? [...base].sort((a, b) => Math.abs(minutosDe(a) - pref.minutos) - Math.abs(minutosDe(b) - pref.minutos)) : base;
    texto =
      quiereDia && !delDia.length
        ? "Ese día no hay horarios libres. Estos son los más próximos; elige uno y lo agendo:"
        : "No hay un horario libre justo a esa hora. Estos son los más cercanos; elige uno y lo agendo:";
  } else {
    lista = libres;
    texto = "Puedo agendarte la cita ahora mismo. Estos son los próximos horarios libres; elige uno:";
  }

  return {
    respuesta: texto,
    opciones: lista.slice(0, MAX_OPCIONES).map(aOpcion),
    sugerencias: [{ texto: "Ver todos los horarios", ruta: SUGERENCIAS.agendar.ruta }],
  };
}

// ¿El mensaje anterior del asistente estaba ofreciendo horarios? Asi se
// entienden respuestas de seguimiento como «¿y el viernes?» o «mejor en la tarde».
function veniaAgendando(historial) {
  const ultimo = [...historial].reverse().find((m) => m.autor === "asistente");
  return Boolean(ultimo && /(lo agendo|elige uno|elige el que prefieras)/i.test(ultimo.texto));
}

module.exports = { PATRON_CITA, leerPreferencias, proponerHorarios, veniaAgendando };
