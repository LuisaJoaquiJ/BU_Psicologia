const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { postJson } = require("../../integrations/n8n.client");
const { hoyUTC } = require("../../common/utils/fechas");

// RF-014: asistente de orientacion. Flujo:
//   1. Filtros de seguridad locales (RN-011) ANTES de cualquier IA: crisis y
//      solicitudes clinicas nunca se envian al modelo.
//   2. Si N8N_AGENTE_URL esta configurada, la consulta va al flujo autorizado
//      de n8n (que puede usar Gemini u otro modelo) con contexto del modulo.
//   3. Si n8n no esta configurado o falla, responde una base de conocimiento
//      local construida con los datos reales (servicios, horarios, eventos).

const MAX_LONGITUD = 500;

const SUGERENCIAS = {
  agendar: { texto: "Agendar una cita", ruta: "/estudiante/agendar" },
  servicios: { texto: "Ver servicios", ruta: "/estudiante/servicios" },
  misCitas: { texto: "Mis citas", ruta: "/estudiante/mis-citas" },
  eventos: { texto: "Ver eventos", ruta: "/estudiante/eventos" },
};

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const PATRON_CRISIS =
  /(suicid|quitarme la vida|matarme|me quiero morir|no quiero vivir|hacerme dano|lastimarme|autolesi|cortarme|acabar con (todo|mi vida))/;

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

async function obtenerContexto() {
  const [servicios, horariosDisponibles, eventos] = await Promise.all([
    prisma.servicio.findMany({ where: { activo: true } }),
    prisma.horario.findMany({ where: { ocupado: false, fecha: { gte: hoyUTC() } } }),
    prisma.evento.findMany({
      where: { estado: "Publicado", fecha: { gte: hoyUTC() } },
      orderBy: [{ fecha: "asc" }],
    }),
  ]);
  return {
    servicios: servicios.map((s) => ({ nombre: s.nombre, descripcion: s.descripcion })),
    horariosDisponibles: horariosDisponibles.length,
    eventos: eventos.slice(0, 5).map((e) => ({
      nombre: e.nombre,
      fecha: e.fecha instanceof Date ? e.fecha.toISOString().slice(0, 10) : e.fecha,
      lugar: e.lugar,
    })),
  };
}

function listar(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

// Base de conocimiento local: intenciones simples por palabras clave.
function responderLocal(textoNormalizado, contexto, nombre) {
  const tiene = (...palabras) => palabras.some((p) => textoNormalizado.includes(p));

  if (tiene("cancel")) {
    return {
      respuesta:
        "Para cancelar una cita entra a «Mis citas» y pulsa «Cancelar» en la cita agendada; el horario queda libre " +
        "para otra persona. Para cancelar la inscripción a un evento, ve a «Eventos» y pulsa «Cancelar inscripción».",
      sugerencias: [SUGERENCIAS.misCitas, SUGERENCIAS.eventos],
    };
  }

  if (tiene("evento", "taller", "charla", "actividad", "inscrib")) {
    if (contexto.eventos.length === 0) {
      return {
        respuesta: "Por ahora no hay eventos publicados. Vuelve a consultar pronto en la sección «Eventos».",
        sugerencias: [SUGERENCIAS.eventos],
      };
    }
    return {
      respuesta:
        `Estos son los próximos eventos publicados:\n${listar(
          contexto.eventos.map((e) => `${e.nombre} (${e.fecha}${e.lugar ? `, ${e.lugar}` : ""})`)
        )}\n\nPara inscribirte entra a «Eventos» y pulsa «Inscribirme» mientras haya cupos.`,
      sugerencias: [SUGERENCIAS.eventos],
    };
  }

  if (tiene("agend", "cita", "reserv", "horario", "turno")) {
    return {
      respuesta:
        `Para agendar una cita entra a «Agendar cita», elige un horario disponible y confirma. ` +
        `En este momento hay ${contexto.horariosDisponibles} horario(s) disponible(s). ` +
        "Recuerda que solo puedes tener una cita activa a la vez.",
      sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.misCitas],
    };
  }

  if (tiene("servicio", "ofrec", "orientacion", "psicolog", "bienestar", "ayuda")) {
    const servicios = contexto.servicios.length
      ? listar(contexto.servicios.map((s) => (s.descripcion ? `${s.nombre}: ${s.descripcion}` : s.nombre)))
      : "• Por ahora no hay servicios activos publicados.";
    return {
      respuesta: `Desarrollo Humano / Orientación ofrece:\n${servicios}`,
      sugerencias: [SUGERENCIAS.servicios, SUGERENCIAS.agendar],
    };
  }

  if (tiene("hola", "buenas", "buenos dias", "buenas tardes", "hey")) {
    return {
      respuesta:
        `¡Hola${nombre ? `, ${nombre}` : ""}! Soy el asistente de Conecta BU. Puedo contarte qué servicios ` +
        "ofrece Bienestar, cómo agendar o cancelar una cita y qué eventos hay próximamente.",
      sugerencias: [SUGERENCIAS.servicios, SUGERENCIAS.agendar, SUGERENCIAS.eventos],
    };
  }

  return {
    respuesta:
      "No tengo una respuesta exacta para eso. Puedo ayudarte con: los servicios de Orientación, " +
      "cómo agendar o cancelar una cita, y los eventos e inscripciones. Si necesitas hablar con alguien, " +
      "agenda una cita con un profesional.",
    sugerencias: [SUGERENCIAS.servicios, SUGERENCIAS.agendar, SUGERENCIAS.eventos],
  };
}

async function consultarN8n(pregunta, contexto, usuario) {
  const resultado = await postJson(config.n8nAgenteUrl, {
    pregunta,
    usuario: { nombre: usuario.nombre },
    contexto,
    reglas:
      "Responde en español, de forma breve y amable, solo sobre los servicios de Desarrollo Humano / " +
      "Orientación y el uso de Conecta BU. No hagas diagnósticos, no recomiendes medicamentos ni " +
      "tratamientos y no tomes decisiones clínicas (RN-011); en esos casos orienta a agendar una cita.",
  });
  const respuesta = typeof resultado?.respuesta === "string" ? resultado.respuesta.trim() : "";
  if (!respuesta) {
    throw new Error("n8n no devolvio el campo 'respuesta'.");
  }
  return respuesta.slice(0, 2000);
}

// RF-014: punto de entrada del asistente.
async function responderConsulta(usuario, preguntaCruda) {
  const pregunta = typeof preguntaCruda === "string" ? preguntaCruda.trim() : "";
  if (!pregunta) {
    throw new AppError(400, "Escribe una pregunta para el asistente.");
  }
  if (pregunta.length > MAX_LONGITUD) {
    throw new AppError(400, `La pregunta no puede superar ${MAX_LONGITUD} caracteres.`);
  }

  const textoNormalizado = normalizar(pregunta);
  const seguridad = filtroDeSeguridad(textoNormalizado);
  if (seguridad) return seguridad;

  const contexto = await obtenerContexto();
  const primerNombre = usuario.nombre?.split(" ")[0];
  const local = responderLocal(textoNormalizado, contexto, primerNombre);

  if (config.n8nAgenteUrl) {
    try {
      const respuesta = await consultarN8n(pregunta, contexto, usuario);
      return { origen: "n8n", respuesta, sugerencias: local.sugerencias };
    } catch (err) {
      console.error(`[asistente] n8n no respondio, se usa la base local: ${err.message}`);
    }
  }
  return { origen: "local", ...local };
}

module.exports = { responderConsulta, filtroDeSeguridad, normalizar };
