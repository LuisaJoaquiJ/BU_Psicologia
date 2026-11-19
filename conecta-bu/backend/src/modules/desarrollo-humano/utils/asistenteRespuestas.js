const { SUGERENCIAS } = require("./asistenteSeguridad");
const { RUTAS } = require("./asistenteModulos");

// Respuestas del asistente sin IA: base de conocimiento local con los datos
// reales del modulo (servicios, horarios, eventos y las citas del estudiante).
// Tono: resolutivo, calido y paso a paso. El texto admite markdown simple
// (viñetas «• », pasos «1. » y **negritas**), que la pantalla del chat dibuja.

// Aviso de privacidad: va SOLO al final de la primera respuesta de la
// conversacion, separado por un salto de linea y en cursiva (texto exacto).
const NOTA_CONFIDENCIALIDAD =
  "Nota: Tus mensajes son confidenciales, salvo que el sistema detecte un riesgo para tu salud o seguridad, en cuyo caso buscaremos ayuda para ti.";

function listar(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

function pasos(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

// --- Saludos ------------------------------------------------------------------
const PATRON_SALUDO =
  /^(hola+|holi+s?|ola|buenas|buenos dias|buen dia|buenas tardes|buenas noches|buenas buenas|hey|ey|saludos|que tal|que mas|quiubo|quihubo|alo|hi|hello|buenos)\b/;
const RELLENO =
  /\b(hola+|holi+s?|ola|buenas|buenos|buenos dias|buen dia|dias|tardes|noches|hey|ey|saludos|que tal|que mas|quiubo|quihubo|alo|hi|hello|como estas|como vas|como te va|como esta|todo bien|asistente|bot|chatbot|conecta ?bu|amig[oa]|por favor|gracias|mucho gusto)\b/g;

const INTENCION = /(cita|agend|event|taller|deport|salud|cultur|hora|servic|ayud|inscri|cancel|grupo|jornad|salida|convoc|psicolog|orienta)/;

// saludo: el mensaje empieza saludando. soloSaludo: no trae ninguna pregunta.
function analizarSaludo(textoNormalizado) {
  const t = String(textoNormalizado || "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
  const saludo = PATRON_SALUDO.test(t);
  const resto = t.replace(RELLENO, " ").replace(/\s+/g, " ").trim();
  const palabras = resto.split(" ").filter((p) => p.length > 1);
  const sinPregunta = !palabras.length || (palabras.length === 1 && !INTENCION.test(resto));
  return { saludo, soloSaludo: saludo && sinPregunta };
}

// Quita cualquier version de la nota que haya escrito la IA y, si «incluir»
// (primera respuesta), pone la exacta al final en cursiva. Asi la nota nunca
// sale repetida, modificada ni en respuestas posteriores.
const PATRON_NOTA = /\n*[ \t]*[_*]*\s*Nota\s*:?\s*[_*]*\s*Tus mensajes son confidenciales[^\n]*/gi;
function conNota(respuesta, incluir = true) {
  const limpio = String(respuesta || "").replace(PATRON_NOTA, "").trim();
  return incluir ? `${limpio}\n\n_${NOTA_CONFIDENCIALIDAD}_` : limpio;
}

// --- Base de conocimiento local -------------------------------------------------
function responderLocal(textoNormalizado, contexto, nombre) {
  const tiene = (...palabras) => palabras.some((p) => textoNormalizado.includes(p));
  const hola = nombre ? `, ${nombre}` : "";

  if (!tiene("cancel") && tiene("mi cita", "mis citas", "tengo cita", "tengo una cita", "cuando es mi", "a que hora es mi")) {
    if (!contexto.misCitas.length) {
      return {
        respuesta:
          "Por ahora **no tienes citas agendadas**. Si quieres, te ayudo a pedir una en menos de un minuto:\n" +
          pasos(["Escríbeme el día y la hora que te sirven (por ejemplo «el jueves a las 9»).", "Elige uno de los horarios libres que te muestre.", "¡Listo! Te llegará un **correo de confirmación**."]),
        sugerencias: [SUGERENCIAS.agendar],
      };
    }
    return {
      respuesta:
        `Estas son tus citas agendadas:\n${listar(contexto.misCitas.map((c) => `**${c.servicio}:** ${c.fecha} a las ${c.hora}`))}\n\n` +
        "Si necesitas cancelarla, hazlo en **«Mis citas»** con al menos **24 horas de anticipación** para que otra persona pueda usar el espacio.",
      sugerencias: [SUGERENCIAS.misCitas],
    };
  }

  if (tiene("virtual", "enlace", "link", "meet", "zoom", "teams")) {
    return {
      respuesta:
        "Algunos talleres y eventos son virtuales. Para entrar:\n" +
        pasos(["Ve a **«Eventos»** e inscríbete en el que te interese.", "Cuando ya estés inscrito/a, aparecerá el botón **«Entrar a la reunión virtual»**.", "Ese día, pulsa el botón unos minutos antes de la hora."]),
      sugerencias: [SUGERENCIAS.eventos],
    };
  }

  if (tiene("cancel", "reprogram", "cambiar mi cita", "mover mi cita")) {
    return {
      respuesta:
        "Claro, así puedes cancelar:\n" +
        listar([
          "**Una cita:** entra a «Mis citas» y pulsa «Cancelar» en la cita agendada. Debe ser con al menos 24 horas de anticipación; el horario queda libre para otra persona.",
          "**Un evento o taller:** ve a «Eventos» y pulsa «Cancelar inscripción».",
        ]) +
        "\n\nSi quieres otra fecha, cancela la cita actual y luego pídeme un nuevo horario: solo puedes tener **una cita activa** a la vez.",
      sugerencias: [SUGERENCIAS.misCitas, SUGERENCIAS.eventos],
    };
  }

  if (tiene("evento", "taller", "charla", "actividad", "inscrib")) {
    if (contexto.eventos.length === 0) {
      return {
        respuesta: "Por ahora **no hay eventos publicados** en Orientación. Apenas se publique uno lo verás en **«Eventos»** y te llegará un aviso. Mientras tanto, también puedes mirar la agenda de Arte y Cultura o los eventos deportivos.",
        sugerencias: [SUGERENCIAS.eventos, RUTAS.culturaAgenda, RUTAS.deporteEventos],
      };
    }
    return {
      respuesta:
        `¡Hay actividades para ti${hola}! Estos son los próximos eventos:\n${listar(
          contexto.eventos.map((e) => `**${e.nombre}:** ${e.fecha}, ${e.hora}, ${e.lugar}${e.inscrito ? " · ya estás inscrito/a ✅" : e.inscripcionAbierta === false ? " · inscripción cerrada" : ""}`),
        )}\n\n**Para inscribirte:**\n${pasos(["Entra a **«Eventos»**.", "Busca el evento y pulsa **«Inscribirme»** (mientras haya cupos).", "Te llegará la **confirmación** y lo verás marcado como inscrito."])}`,
      sugerencias: [SUGERENCIAS.eventos],
    };
  }

  if (tiene("agend", "cita", "reserv", "horario", "turno")) {
    const hay = contexto.horariosDisponibles > 0;
    return {
      respuesta:
        (hay
          ? "¡Con gusto te ayudo a **agendar tu cita de Orientación**! Es muy fácil:\n" +
            pasos([
              "Elige uno de los horarios libres que te muestro abajo, **o** escríbeme el día y la hora que prefieres (por ejemplo «el jueves a las 9»).",
              "Pulsa **«Agendar»** en el horario que te sirva.",
              "Te llegará un **correo de confirmación** y la verás en **«Mis citas»**.",
            ])
          : "En este momento **no hay horarios libres** para agendar, pero se abren espacios con frecuencia. Te recomiendo revisar **«Agendar cita»** en unos días.") +
        "\n\nRecuerda: solo puedes tener **una cita activa** a la vez.",
      sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.misCitas],
    };
  }

  if (tiene("servicio", "ofrec", "orientacion", "psicolog", "bienestar", "ayuda", "que puedo hacer", "que haces")) {
    const servicios = contexto.servicios.length
      ? listar(contexto.servicios.map((s) => (s.descripcion ? `**${s.nombre}:** ${s.descripcion}` : `**${s.nombre}**`)))
      : "• Por ahora no hay servicios de Orientación publicados.";
    return {
      respuesta:
        `Esto es lo que te ofrece Bienestar Universitario:\n\n**Orientación / Desarrollo Humano**\n${servicios}\n\n` +
        "**Otras áreas**\n" +
        listar(["**Salud:** jornadas, campañas y salidas.", "**Deporte:** grupos, eventos y tus horas.", "**Arte y Cultura:** talleres, grupos representativos y convocatorias."]) +
        "\n\n¿Por cuál quieres empezar?",
      sugerencias: [SUGERENCIAS.servicios, SUGERENCIAS.agendar, RUTAS.deporteOferta, RUTAS.culturaGrupos],
    };
  }

  if (tiene("gracias", "muy amable", "te agradezco")) {
    return {
      respuesta: `¡Con mucho gusto${hola}! 😊 Si necesitas algo más, aquí estoy.`,
      sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.eventos],
    };
  }

  if (tiene("chao", "adios", "hasta luego", "nos vemos", "bye")) {
    return { respuesta: `¡Que te vaya muy bien${hola}! Cuando me necesites, aquí estaré. 💙`, sugerencias: [] };
  }

  return {
    generica: true,
    respuesta:
      `Mmm, no estoy seguro de haber entendido bien${hola}, pero quiero ayudarte. 🙂 Estas son las cosas que puedo resolver contigo:\n` +
      listar([
        "**Citas de Orientación:** agendar, ver o cancelar.",
        "**Eventos y talleres:** cuáles hay y cómo inscribirte.",
        "**Deporte:** grupos, eventos y cuántas horas llevas.",
        "**Salud:** jornadas, campañas y salidas.",
        "**Arte y Cultura:** talleres, agenda y convocatorias.",
      ]) +
      "\n\nPrueba, por ejemplo, con «quiero agendar una cita», «¿qué talleres de cultura hay?» o «¿cuántas horas de deporte llevo?».",
    sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.eventos, SUGERENCIAS.servicios],
  };
}

module.exports = { NOTA_CONFIDENCIALIDAD, analizarSaludo, conNota, responderLocal };
