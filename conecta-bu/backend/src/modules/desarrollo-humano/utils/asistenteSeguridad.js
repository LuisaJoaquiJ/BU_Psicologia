// Asistente de orientacion (RF-014): filtros de seguridad (RN-011), textos
// de fecha y hora, y limpieza del historial de la conversacion.

const { detectarCrisis, respuestaCrisis, esRespuestaCrisis, lineaApoyo } = require("./asistenteCrisis");

const MAX_LONGITUD = 500;

const SUGERENCIAS = {
  agendar: { texto: "Agendar una cita", ruta: "/estudiante/agendar" },
  servicios: { texto: "Ver servicios", ruta: "/estudiante/servicios" },
  misCitas: { texto: "Mis citas", ruta: "/estudiante/mis-citas" },
  eventos: { texto: "Ver eventos", ruta: "/estudiante/eventos" },
};

function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const PATRON_CLINICO =
  /(diagnost|medicament|pastilla|receta|prescri|dosis|tratamiento|trastorno|que (debo )?tomar|tengo (depresion|ansiedad|bipolaridad|tdah|toc)|soy (bipolar|depresiv))/;

// RN-011: respuestas fijas para situaciones que el agente no debe atender.
// La crisis va primero (protocolo de emergencia, ver asistenteCrisis.js): se
// responde solo con el mensaje de contencion, sin botones de servicios.
function filtroDeSeguridad(textoNormalizado) {
  if (detectarCrisis(textoNormalizado)) {
    return { origen: "seguridad", crisis: true, respuesta: respuestaCrisis(), lineaApoyo: lineaApoyo(), sugerencias: [] };
  }
  if (PATRON_CLINICO.test(textoNormalizado)) {
    return {
      origen: "seguridad",
      respuesta:
        "Entiendo que quieras claridad sobre esto, y qué bueno que lo preguntes. Yo **no puedo hacer diagnósticos**, recomendar medicamentos ni indicar tratamientos, " +
        "pero sí puedo conectarte con quien te puede ayudar de verdad:\n" +
        "1. Agenda una **cita de Orientación psicológica** (escríbeme el día y la hora que te sirven, o entra a «Agendar cita»).\n" +
        "2. En la cita, un profesional de Bienestar te escuchará y te acompañará de forma **personalizada y confidencial**.",
      sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.servicios],
    };
  }
  return null;
}

// Fecha y hora legibles (las fechas son @db.Date y las horas @db.Time en UTC).
const fechaTexto = (d) => (d ? new Date(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");
const horaTexto = (d) => (d ? new Date(d).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) : "");

// Historial de la conversacion que manda la pantalla del asistente. Se limita
// en tamaño y se quitan los mensajes que activaron los filtros de seguridad
// (RN-011) o el protocolo de crisis, junto con su respuesta: nunca se envian a
// la IA, ni como historial.
const MAX_TURNOS = 8;
function limpiarHistorial(historial) {
  if (!Array.isArray(historial)) return [];
  const limpio = [];
  let saltarRespuesta = false;
  for (const m of historial.slice(-MAX_TURNOS * 2)) {
    const autor = m?.autor === "estudiante" || m?.autor === "asistente" ? m.autor : null;
    const texto = typeof m?.texto === "string" ? m.texto.trim().slice(0, 600) : "";
    if (!autor || !texto) continue;
    if (autor === "estudiante" && filtroDeSeguridad(normalizar(texto))) {
      saltarRespuesta = true;
      continue;
    }
    // Respuesta de contencion (p. ej. si la crisis la detecto la IA): se quita
    // junto con el mensaje que la origino.
    if (autor === "asistente" && esRespuestaCrisis(texto)) {
      if (limpio.length && limpio[limpio.length - 1].autor === "estudiante") limpio.pop();
      saltarRespuesta = false;
      continue;
    }
    if (autor === "asistente" && saltarRespuesta) {
      saltarRespuesta = false;
      continue;
    }
    saltarRespuesta = false;
    limpio.push({ autor, texto });
  }
  return limpio.slice(-MAX_TURNOS);
}

module.exports = { MAX_LONGITUD, SUGERENCIAS, normalizar, filtroDeSeguridad, fechaTexto, horaTexto, limpiarHistorial };
