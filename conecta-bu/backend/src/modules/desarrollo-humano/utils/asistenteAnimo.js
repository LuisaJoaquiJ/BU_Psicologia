const { SUGERENCIAS } = require("./asistenteSeguridad");
const { RUTAS } = require("./asistenteModulos");

// Asistente de Conecta BU: saludo y motivacion contextual SIN IA. Si el
// estudiante cuenta como se siente (estres por parciales, cansancio, una buena
// noticia...), primero recibe una frase breve de animo y despues la respuesta o
// una oferta de ayuda concreta. Cada caso tiene varias variantes elegidas al
// azar para que no suene repetido. No reemplaza al protocolo de crisis, que
// corre antes (asistenteCrisis.js).

const elegir = (lista, azar = Math.random) => lista[Math.floor(azar() * lista.length) % lista.length];

// Hora de Bogota (UTC-5, sin horario de verano).
function saludoPorHora(ahora = Date.now()) {
  const h = new Date(ahora - 5 * 3600e3).getUTCHours();
  if (h >= 5 && h < 12) return "Buenos días";
  if (h >= 12 && h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function saludoCorto(nombre, azar = Math.random) {
  const quien = nombre ? `, ${nombre}` : "";
  return elegir([`¡${saludoPorHora()}${quien}!`, `¡Hola${quien}!`, `¡Qué gusto leerte${quien}!`], azar);
}

// --- Estados de animo -----------------------------------------------------------
// Orden = prioridad (el primero que coincide gana).
const CASOS = [
  {
    caso: "examenes",
    re: /(parcial|examen|quiz|quices|finales|sustentacion|exposicion|previo|evaluacion|semana de parciales)/,
    animo: /(estres|estresad|nervios|miedo|ansios|ansiedad|preocupad|agobiad|asustad|presion|no he estudiado|me va a ir mal|voy a perder|perder la materia|perdiendo|tension|cansad|no se nada|me fue mal|reprob|perdi)/,
  },
  { caso: "trabajo", re: /(mucho trabajo|muchos trabajos|muchas tareas|muchas entregas|full de tareas|lleno de tareas|carga academica|no me alcanza el tiempo|tengo mucho que hacer|demasiadas tareas|demasiado trabajo|muchos pendientes|muchas cosas que hacer)/ },
  { caso: "ansiedad", re: /(ansios|ansiedad|nervios|inquiet|preocupad|intranquil|angustiad)/ },
  { caso: "tristeza", re: /(triste|tristeza|desanimad|bajonead|decaid|llorando|con ganas de llorar|me siento mal|me siento sol[oa]|solitari|nostalgi|desilusionad|decepcionad)/ },
  { caso: "cansancio", re: /(cansad|cansancio|tengo sueno|con sueno|mucho sueno|muert[oa] de sueno|agotad|no dormi|trasnoch|rendid|sin energia|exhaust|muert[oa] del cansancio|fundid)/ },
  { caso: "desmotivacion", re: /(desmotivad|sin motivacion|no tengo ganas de estudiar|sin ganas|flojera|pereza|procrastin|no me provoca|no me dan ganas|aburrid[oa] de estudiar|quiero rendirme|para que estudio)/ },
  { caso: "estres", re: /(estres|estresad|agobiad|abrumad|presionad|mucha presion|colapsad|saturad|al limite)/ },
  { caso: "felicidad", re: /(feliz|contento|contenta|emocionad|buena noticia|buenas noticias|pase la materia|pase el parcial|aprobe|\bgane\b|me fue bien|saque buena nota|saque [345]|lo logre|estoy alegre|que alegria|me aceptaron|me gradu)/ },
];

// Devuelve el caso o null. Ignora frases negadas simples («no estoy cansado»).
function detectarAnimo(textoNormalizado) {
  const t = String(textoNormalizado || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
  for (const { caso, re, animo } of CASOS) {
    const m = t.match(re);
    if (!m) continue;
    if (animo && !animo.test(t)) continue;
    if (/\bno (estoy|me siento|ando) $/.test(t.slice(0, m.index))) continue;
    return caso;
  }
  return null;
}

const FRASES = {
  examenes: [
    "Los parciales pueden sentirse como una montaña, pero ya has superado retos antes y este no será la excepción. 💪 Un consejo: estudia en bloques de 25 minutos con pausas cortas, duerme bien la noche anterior y confía en lo que sabes.",
    "Respira profundo: estar nervioso/a antes de un examen es señal de que te importa. 📚 Prioriza los temas que más pesan, repasa con ejercicios y date pequeños descansos; tu cerebro rinde mejor así.",
    "¡Ánimo! Un examen mide un momento, no lo que vales. Organiza lo que te falta en una lista corta, empieza por lo más importante y celebra cada tema que cierres. 🌟",
  ],
  trabajo: [
    "¡Uf, qué semana tan cargada! 📝 Un truco que ayuda: escribe todo lo pendiente, ordénalo por fecha de entrega y ataca una sola cosa a la vez. Verás cómo la lista baja.",
    "Tener mucho por hacer agota, pero vas a salir de esta. Divide cada entrega en pasos pequeños y date crédito por cada uno que completes. ✅",
    "Respira: no tienes que resolver todo hoy. Elige las 3 tareas más urgentes, ponles un tiempo y deja el resto para mañana. Tu bienestar también es prioridad. 💙",
  ],
  ansiedad: [
    "Gracias por contarme cómo te sientes. Cuando la preocupación aprieta, prueba esto: inhala 4 segundos, sostén 4 y exhala 6. Repítelo unas veces; tu cuerpo lo agradece. 🌿",
    "Es normal sentirse inquieto/a a veces, y está bien pedir apoyo. Intenta enfocarte en lo que sí puedes controlar hoy, paso a paso. Aquí estoy para ayudarte. 💙",
    "Te entiendo: la ansiedad cansa. Un pequeño respiro, un vaso de agua y una caminata corta pueden ayudarte a bajar la intensidad. Y si te sirve hablarlo, en Orientación te escuchan. 🌱",
  ],
  tristeza: [
    "Siento que estés pasando por un momento así. Está bien no estar bien todo el tiempo, y lo que sientes importa. 💙 Date un respiro y no dudes en apoyarte en alguien de confianza.",
    "Gracias por contármelo. Los días grises pasan, y no tienes que atravesarlos solo/a. Si te ayuda, hablar con un profesional de Orientación puede hacer la diferencia. 🌤️",
    "Te mando un abrazo virtual. 🤗 Hacer algo pequeño que disfrutes, salir a tomar aire o conversar con alguien puede aliviar un poco. Aquí estoy para lo que necesites.",
  ],
  cansancio: [
    "Se nota que has dado mucho. 😴 Recuerda que descansar también es productivo: una siesta corta, agua y comer bien te recargan más de lo que crees.",
    "El cansancio es la forma en que tu cuerpo te pide una pausa. Intenta dormir un poco más esta noche y alterna el estudio con pausas activas. ¡Tú puedes! 🔋",
    "¡Ánimo! Un descanso de 10 minutos lejos de pantallas y un poco de movimiento pueden darte energía. Cuidarte es parte del éxito académico. 🌿",
  ],
  desmotivacion: [
    "A todos nos pasa que la motivación baja. 🌱 Empieza con algo pequeño, solo 10 minutos; muchas veces lo difícil es arrancar. Y recuerda por qué empezaste.",
    "Está bien tener días sin ganas. Ponte una meta mini para hoy y prémiate al cumplirla. Cada pasito cuenta, y ya estás dando uno al buscar ayuda. ✨",
    "La motivación va y viene, pero los hábitos se quedan. Prueba cambiar de lugar de estudio o sumarte a una actividad que te guste: el deporte y el arte recargan mucho. 🎨⚽",
  ],
  estres: [
    "Respira profundo: el estrés es una señal de que necesitas una pausa, no de que no puedas. 🌿 Organiza tus pendientes, haz una cosa a la vez y date pequeños descansos.",
    "Qué bueno que lo cuentes. Moverte un rato, escuchar música o hablar con alguien ayuda mucho a soltar tensión. Vas a salir adelante. 💪",
    "Paso a paso se llega lejos. Prioriza lo urgente, suelta lo que puede esperar y no olvides comer y dormir bien. Aquí estoy para hacerte las cosas más fáciles. 💙",
  ],
  felicidad: [
    "¡Qué alegría! 🎉 Celebra ese logro: es fruto de tu esfuerzo y te lo mereces.",
    "¡Me encanta leer eso! 🥳 Guarda esa energía para lo que viene; vas por muy buen camino.",
    "¡Felicitaciones! 🌟 Esos momentos recuerdan lo mucho que puedes lograr. ¡Sigue así!",
  ],
};

function fraseDeAnimo(caso, azar = Math.random) {
  return FRASES[caso] ? elegir(FRASES[caso], azar) : "";
}

// Ayuda concreta despues de la frase de animo, cuando el mensaje no traia una
// pregunta.
function ofertaDeAyuda(caso) {
  const apoyo = ["examenes", "trabajo", "ansiedad", "tristeza", "estres"].includes(caso);
  if (caso === "felicidad") {
    return {
      respuesta:
        "¿Quieres aprovechar esa buena energía? Te propongo:\n" +
        "• Ver los próximos **eventos y talleres**.\n• Sumarte a un **grupo de deporte** o de **Arte y Cultura**.\n• Revisar tus **horas de deporte**.",
      sugerencias: [SUGERENCIAS.eventos, RUTAS.deporteOferta, RUTAS.culturaGrupos],
    };
  }
  if (apoyo) {
    return {
      respuesta:
        "Si quieres, te ayudo con algo concreto ahora mismo:\n" +
        "• **Agendar una cita de Orientación** para hablar con un profesional (es gratis y confidencial).\n" +
        "• Ver **talleres y eventos** de bienestar.\n" +
        "• Despejarte en un **grupo de deporte** o de **Arte y Cultura**.\n\n" +
        "Solo dime cuál o pulsa un botón.",
      sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.eventos, RUTAS.deporteOferta],
    };
  }
  return {
    respuesta:
      "Cuando quieras, te ayudo con:\n" +
      "• **Agendar una cita** de Orientación.\n• Encontrar **eventos y talleres**.\n• Tus **horas de deporte** o los **grupos de cultura**.",
    sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.eventos, RUTAS.deporteHoras],
  };
}

// --- Bienvenida fresca y proactiva (saludo solo) ----------------------------------
// Menciona cosas concretas que el estudiante puede hacer YA, con sus datos reales.
function bienvenida(nombre, contexto = {}, azar = Math.random) {
  const apertura = elegir(
    [
      "Qué bueno tenerte por aquí. ✨",
      "Me alegra que pases por aquí. 😊",
      "Estoy listo para hacerte el día en la U un poco más fácil. 🙌",
      "Espero que tu día vaya muy bien. 🌤️",
    ],
    azar,
  );
  const ideas = [];
  if (contexto.horariosDisponibles > 0) ideas.push(`Hay **${contexto.horariosDisponibles} ${contexto.horariosDisponibles === 1 ? "horario libre" : "horarios libres"}** en Orientación: te agendo una cita en un minuto.`);
  const evento = (contexto.eventos || []).find((e) => !e.inscrito && e.inscripcionAbierta !== false);
  if (evento) ideas.push(`Se viene **${evento.nombre}** (${evento.fecha}). ¿Te inscribo?`);
  const horas = contexto.modulos?.deporte?.horas;
  if (horas && !horas.cumplido) ideas.push(`Te faltan **${horas.faltan} horas de deporte**; te muestro grupos con cupo.`);
  if (ideas.length < 2) ideas.push("Te cuento qué hay en **Salud**, **Deporte** y **Arte y Cultura**.");
  if (ideas.length < 2) ideas.push("Puedo **agendar tu cita** o mostrarte tus citas.");
  const cierre = elegir(["¿Por dónde empezamos?", "¿Qué te gustaría hacer hoy?", "Cuéntame en qué te ayudo."], azar);
  return {
    respuesta: `${saludoCorto(nombre, azar)} ${apertura}\n\nAlgunas ideas para hoy:\n${ideas.slice(0, 3).map((x) => `• ${x}`).join("\n")}\n\n${cierre}`,
    sugerencias: [SUGERENCIAS.agendar, SUGERENCIAS.eventos, horas && !horas.cumplido ? RUTAS.deporteOferta : SUGERENCIAS.servicios],
  };
}

module.exports = { saludoPorHora, saludoCorto, detectarAnimo, fraseDeAnimo, ofertaDeAyuda, bienvenida };
