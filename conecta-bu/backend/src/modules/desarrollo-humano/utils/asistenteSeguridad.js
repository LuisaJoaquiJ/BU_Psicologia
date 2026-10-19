// Asistente de orientacion (RF-014): filtros de seguridad (RN-011), textos
// de fecha y hora, y limpieza del historial de la conversacion.

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

const PATRON_CRISIS = /(suicid|quitarme la vida|matarme|me quiero morir|no quiero vivir|hacerme dano|lastimarme|autolesi|cortarme|acabar con (todo|mi vida))/;

const PATRON_CLINICO =
  /(diagnost|medicament|pastilla|receta|prescri|dosis|tratamiento|trastorno|que (debo )?tomar|tengo (depresion|ansiedad|bipolaridad|tdah|toc)|soy (bipolar|depresiv))/;

// RN-011: respuestas fijas para situaciones que el agente no debe atender.
function filtroDeSeguridad(textoNormalizado) {
  if (PATRON_CRISIS.test(textoNormalizado)) {
    return {
      origen: "seguridad",
      respuesta:
        "Lo que estás sintiendo es importante y no tienes que enfrentarlo solo/a. " +
        "Si estás en peligro o sientes que puedes hacerte daño, llama ahora a la línea de emergencias 123. " +
        "También puedes comunicarte con la línea de salud mental 192 (opción 4) o acercarte a Bienestar " +
        "Universitario para hablar con un profesional. Si quieres, agenda una cita de orientación psicológica.",
      sugerencias: [SUGERENCIAS.agendar],
    };
  }
  if (PATRON_CLINICO.test(textoNormalizado)) {
    return {
      origen: "seguridad",
      respuesta:
        "No puedo hacer diagnósticos, recomendar medicamentos ni indicar tratamientos. " +
        "Lo mejor es que lo hables con un profesional de Orientación psicológica de Bienestar: " +
        "puedes agendar una cita y te acompañarán de forma personalizada.",
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
// (RN-011) junto con su respuesta: nunca se envian a la IA, ni como historial.
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
