const { SUGERENCIAS } = require("./asistenteSeguridad");

// Respuestas del asistente sin IA: base de conocimiento local con los datos
// reales del modulo (servicios, horarios, eventos y las citas del estudiante).

function listar(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

// Base de conocimiento local: intenciones simples por palabras clave.
function responderLocal(textoNormalizado, contexto, nombre) {
  const tiene = (...palabras) => palabras.some((p) => textoNormalizado.includes(p));

  if (!tiene("cancel") && tiene("mi cita", "mis citas", "tengo cita", "cuando es mi", "a que hora es mi")) {
    if (!contexto.misCitas.length) {
      return {
        respuesta: "No tienes citas agendadas en este momento. Si quieres, puedes pedir una en «Agendar cita».",
        sugerencias: [SUGERENCIAS.agendar],
      };
    }
    return {
      respuesta: `Tus citas agendadas:\n${listar(contexto.misCitas.map((c) => `${c.servicio}: ${c.fecha} a las ${c.hora}`))}`,
      sugerencias: [SUGERENCIAS.misCitas],
    };
  }

  if (tiene("virtual", "enlace", "link", "meet", "zoom", "teams")) {
    return {
      respuesta:
        "Algunos talleres y eventos son virtuales. El enlace de la reunión aparece en «Eventos» cuando ya estás inscrito/a, " +
        "con el botón «Entrar a la reunión virtual».",
      sugerencias: [SUGERENCIAS.eventos],
    };
  }

  if (tiene("cancel")) {
    return {
      respuesta:
        "Para cancelar una cita entra a «Mis citas» y pulsa «Cancelar» en la cita agendada, con al menos 24 horas " +
        "de anticipación; el horario queda libre " +
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
      respuesta: `Estos son los próximos eventos publicados:\n${listar(
        contexto.eventos.map((e) => `${e.nombre} (${e.fecha}, ${e.lugar}${e.inscrito ? " · ya estás inscrito/a" : ""})`),
      )}\n\nPara inscribirte entra a «Eventos» y pulsa «Inscribirme» mientras haya cupos.`,
      sugerencias: [SUGERENCIAS.eventos],
    };
  }

  if (tiene("agend", "cita", "reserv", "horario", "turno")) {
    return {
      respuesta:
        (contexto.horariosDisponibles
          ? "Puedo agendarte la cita desde aquí: elige uno de los horarios libres de abajo, o escríbeme el día y la hora que prefieres (por ejemplo «el jueves a las 9»). "
          : "En este momento no hay horarios libres. ") +
        "También puedes hacerlo en «Agendar cita». Recuerda que solo puedes tener una cita activa a la vez.",
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

module.exports = { responderLocal };
