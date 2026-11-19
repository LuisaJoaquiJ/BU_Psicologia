const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { postJson, registrar } = require("../../../integrations/n8n.client");
const { servicioService } = require("./ServicioService");
const { citaService } = require("./CitaService");
const { eventoEstudianteService } = require("./EventoEstudianteService");
const { inicioDeCita } = require("../utils/agenda");
const { MAX_LONGITUD, normalizar, filtroDeSeguridad, fechaTexto, horaTexto, limpiarHistorial } = require("../utils/asistenteSeguridad");
const { PATRON_CITA, proponerHorarios, veniaAgendando } = require("../utils/asistenteAgenda");
const { NOTA_CONFIDENCIALIDAD, analizarSaludo, conNota, responderLocal } = require("../utils/asistenteRespuestas");
const { saludoCorto, detectarAnimo, fraseDeAnimo, ofertaDeAyuda, bienvenida } = require("../utils/asistenteAnimo");
const {
  TITULO_ALERTA,
  ACCION_ALERTA,
  lineaApoyo,
  textoObligatorio,
  respuestaCrisis,
  esRespuestaCrisis,
  detectarCrisis,
  extraerAlerta,
  dispararAlertaCrisis,
} = require("../utils/asistenteCrisis");
const { contextoModulos, moduloEfectivo, responderModulos } = require("../utils/asistenteModulos");

// Reglas del agente (Gemini y n8n). Lo critico (crisis, nota de bienvenida)
// tambien lo garantiza el backend, porque sin GEMINI_API_KEY no hay IA.
// Se arma en cada consulta para usar la linea de apoyo vigente (LINEA_APOYO_URGENTE).
const reglas = () => [
  "OBJETIVO: facilitarle la vida al estudiante: resolver sus dudas, agendar citas y encontrar servicios " +
    "(Orientación / Desarrollo Humano, Salud, Deporte y Arte y Cultura) de forma rápida. " +
    "Tu tono es resolutivo, cálido, empático y adaptativo. Responde en español, tuteando, con frases cortas y claras.",
  "1. SALUDO Y MOTIVACIÓN CONTEXTUAL: no uses saludos robóticos ni estáticos. Analiza la situación o el estado de ánimo del estudiante " +
    "(si lo expresa: estrés por parciales, cansancio, ansiedad leve, tristeza leve, desmotivación, mucho trabajo, una buena noticia...) y dale " +
    "primero un consejo o mensaje motivacional breve y personalizado; después responde su consulta u ofrécele ayuda concreta. " +
    "Si solo saluda, dale una bienvenida fresca y proactiva que mencione cosas concretas que puede hacer. " +
    "AVISO DE PRIVACIDAD: solo en tu PRIMERA respuesta de la conversación (te lo indica «Primera respuesta: sí»), añade al final, separado por un " +
    `salto de línea y en cursiva, este texto exacto: _${NOTA_CONFIDENCIALIDAD}_ En las demás respuestas NO lo escribas.`,
  "2. PROTOCOLO DE EMERGENCIA Y RIESGO VITAL (PRIORIDAD MÁXIMA): si el estudiante menciona intenciones de suicidio, autolesiones, depresión severa, " +
    "desesperanza extrema o crisis emocional grave (por ejemplo «me quiero matar», «no quiero vivir», «siento que no puedo más», «quiero hacerme daño»), " +
    "detén cualquier otra tarea y sigue estrictamente estos dos pasos. " +
    "Paso A (para el estudiante): dale un mensaje de apoyo profundamente empático y cálido que valide sus emociones, e incluye obligatoriamente y literal: " +
    `"${textoObligatorio()}" Añade también el correo psicologoinstitucional@uniautonoma.edu.co como otra vía de contacto. ` +
    "Paso B (alerta para el administrador): al final de tu mensaje deja dos líneas en blanco y escribe EXACTAMENTE este bloque, sin inventar campos:\n" +
    `${TITULO_ALERTA}\n${ACCION_ALERTA}\n📌 Motivo detectado: [síntesis de 1 a 2 líneas de lo que dijo el estudiante]\n` +
    "En el motivo NUNCA incluyas el historial ni otras preguntas del estudiante. El sistema quita el bloque antes de mostrar tu respuesta.",
  "3. FLUJO NORMAL (ASISTENTE FACILITADOR): para consultas regulares (citas, talleres, deportes) responde de forma directa y guía paso a paso. " +
    "Usa pasos numerados (1., 2., 3.), viñetas (•) y **negritas** en las palabras clave (por ejemplo «**Agendar cita**», «**Mis citas**», «**Eventos**», " +
    "«**Mis horas**», «**Convocatorias**») para que la información sea fácil de escanear.",
  "LÍMITES (RN-011): no hagas diagnósticos, no recomiendes medicamentos ni tratamientos y no tomes decisiones clínicas; en esos casos " +
    "orienta con calidez a agendar una cita de Orientación psicológica.",
  "DATOS: no inventes horarios, eventos, cupos ni enlaces: usa solo el contexto. Si dice paginaActual, la persona está en ese módulo: " +
    "entiende sus preguntas cortas en ese módulo. Si el estudiante quiere una cita, dile que debajo de tu respuesta verá los horarios libres " +
    "para agendar con un clic, o que puede escribirte el día y la hora que prefiere. Solo puede tener una cita activa a la vez. " +
    "No puedes cancelar citas: eso se hace en «Mis citas», con al menos 24 horas de anticipación.",
].join("\n\n");

// RF-014: asistente de orientacion. Flujo:
//   0. Protocolo de emergencia (asistenteCrisis.js): si hay señales de crisis
//      se responde SOLO con el texto de contencion y se alerta al personal de
//      Desarrollo Humano. Va antes que todo y nunca llega a la IA.
//   1. Filtros de seguridad locales (RN-011) ANTES de cualquier IA: las
//      solicitudes clinicas nunca se envian al modelo. Un saludo o un estado
//      de animo reciben primero una frase de animo (asistenteAnimo.js), y la
//      primera respuesta de la conversacion lleva el aviso de privacidad.
//   2. Si GEMINI_API_KEY esta definida, la pregunta va a Gemini con el
//      contexto autorizado y los ultimos mensajes (solo el primer nombre; no
//      viaja el correo).
//   3. Si Gemini no esta o falla, y N8N_AGENTE_URL esta configurada, se
//      intenta el flujo de n8n.
//   4. Si nada de eso responde, la base local con los datos reales
//      (servicios, horarios, eventos).
const claveGemini = () => String(process.env.GEMINI_API_KEY || "").trim();
class AsistenteService {
  // Contexto autorizado para el agente: el agente no consulta la base de
  // datos; recibe solo datos de Orientacion y, del estudiante, sus propias
  // citas e inscripciones. Nunca notas del personal ni datos de otros.
  async contexto(usuario) {
    const [servicios, horarios, eventos, citas, modulos] = await Promise.all([
      servicioService.activos(),
      citaService.disponibles(),
      eventoEstudianteService.publicados(usuario.id),
      citaService.mias(usuario.id),
      contextoModulos(usuario),
    ]);
    const ahora = Date.now();
    const contexto = {
      hoy: fechaTexto(new Date(ahora - 5 * 3600e3)),
      servicios: servicios.map((s) => {
        const libres = horarios.filter((h) => h.servicioId === s.id);
        return {
          nombre: s.nombre,
          descripcion: s.descripcion,
          horariosLibres: libres.length,
          proximosHorarios: libres.slice(0, 3).map((h) => `${fechaTexto(h.fecha)} ${horaTexto(h.horaInicio)}`),
        };
      }),
      horariosDisponibles: horarios.length,
      modulos,
      eventos: eventos.slice(0, 6).map((e) => ({
        nombre: e.nombre,
        fecha: fechaTexto(e.fecha),
        hora: `${horaTexto(e.horaInicio)} a ${horaTexto(e.horaFin)}`,
        lugar: e.modalidad === "Virtual" ? "Virtual" : e.lugar || "Lugar por definir",
        modalidad: e.modalidad || "Presencial",
        cuposDisponibles: e.cuposDisponibles,
        inscripcionAbierta: e.inscripcionAbierta,
        inscrito: e.miInscripcion?.estado === "Confirmada",
      })),
      misCitas: citas
        .filter((c) => c.estado === "Agendada" && inicioDeCita(c.horario) > ahora)
        .map((c) => ({
          servicio: c.horario?.servicio?.nombre,
          fecha: fechaTexto(c.horario?.fecha),
          hora: horaTexto(c.horario?.horaInicio),
          sePuedeCancelar: (inicioDeCita(c.horario) - ahora) / 3600e3 >= config.horasMinimasCancelacion,
        })),
    };
    // Datos crudos solo para que el backend proponga horarios; no van a la IA.
    Object.defineProperty(contexto, "_interno", { value: { horarios, servicios }, enumerable: false });
    return contexto;
  }

  async consultarN8n(pregunta, contexto, usuario, historial, primera) {
    const usuarioIA = { nombre: usuario.nombre?.split(" ")[0] || "" };
    const resultado = await postJson(config.n8nAgenteUrl, { pregunta, historial, usuario: usuarioIA, contexto, primera: Boolean(primera), reglas: reglas() }, config.n8nAgenteTimeoutMs);
    const respuesta = typeof resultado?.respuesta === "string" ? resultado.respuesta.trim() : "";
    if (!respuesta) throw new Error("n8n no devolvio el campo 'respuesta'.");
    return respuesta.slice(0, 2000);
  }

  // Gemini con las mismas reglas y el mismo contexto que recibe n8n. El
  // historial va como turnos previos para entender preguntas de seguimiento.
  async consultarGemini(pregunta, contexto, usuario, historial, primera) {
    const modelo = String(process.env.GEMINI_MODEL || "gemini-flash-latest").trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${claveGemini()}`;
    const primerNombre = usuario.nombre?.split(" ")[0] || "Estudiante";
    const consulta = `Persona: ${primerNombre}
Primera respuesta: ${primera ? "sí" : "no"}
Contexto de Conecta BU (JSON): ${JSON.stringify(contexto)}

Pregunta: ${pregunta}`;
    const turnos = historial.map((m) => ({ role: m.autor === "estudiante" ? "user" : "model", parts: [{ text: m.texto }] }));
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), Number(process.env.GEMINI_TIMEOUT_MS || 20000));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `Eres el asistente virtual de Conecta BU, la app de Bienestar Universitario de la Uniautónoma del Cauca.\n\n${reglas()}` }] },
          contents: [...turnos, { role: "user", parts: [{ text: consulta }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
      if (!res.ok || !texto) throw new Error(data?.error?.message || "Gemini no devolvio texto.");
      return texto.slice(0, 2000);
    } finally {
      clearTimeout(temporizador);
    }
  }

  // Si el estudiante pide una cita (o responde a los horarios ofrecidos), el
  // backend busca horarios reales; la IA no los puede inventar.
  agenda(texto, contexto, historial, pagina) {
    const preguntaPorSuCita = /(mi cita|mis citas|tengo (una )?cita|cuando es mi|a que hora es mi)/.test(texto);
    if (/cancel/.test(texto) || preguntaPorSuCita || moduloEfectivo(texto, pagina)) return {};
    const { horarios, servicios } = contexto._interno;
    const seguimiento = veniaAgendando(historial) && !/(evento|taller|servicios)/.test(texto);
    if (!PATRON_CITA.test(texto) && !seguimiento) return {};
    const directa = proponerHorarios(texto, contexto, horarios, servicios, { forzar: seguimiento });
    if (directa) return { directa: { origen: "agenda", ...directa } };
    // Pregunta general («¿cómo agendo?»): se responde normal y se ofrecen los horarios.
    return { opciones: proponerHorarios(texto, contexto, horarios, servicios, { forzar: true })?.opciones || null };
  }

  // Respuesta de contencion: siempre se muestra; la alerta al personal tiene
  // su propio control para no repetirse en rafaga.
  async responderCrisis(usuario, motivo, texto) {
    await dispararAlertaCrisis(usuario, motivo, { texto });
    return { origen: "seguridad", crisis: true, respuesta: respuestaCrisis(), lineaApoyo: lineaApoyo(), sugerencias: [] };
  }

  // Lo que responde la IA pasa por aqui: si trae el bloque «ALERTA ROJA» (o la
  // etiqueta antigua, o el texto de contencion), se quita y se activa el protocolo.
  async revisarRespuestaIA(texto, usuario) {
    const { texto: limpio, motivo } = extraerAlerta(texto);
    if (motivo || esRespuestaCrisis(limpio)) {
      return { crisis: await this.responderCrisis(usuario, motivo || "Señales de posible crisis emocional detectadas por la IA") };
    }
    return { texto: limpio };
  }

  // «Primera respuesta»: el historial que manda la pantalla no trae respuestas
  // previas del asistente (la bienvenida estatica no viaja). Si no llega el
  // historial, se usa el indicador «primera» del frontend.
  esPrimera(historialCrudo, primera) {
    if (Array.isArray(historialCrudo)) return !historialCrudo.some((m) => m?.autor === "asistente" && typeof m?.texto === "string" && m.texto.trim());
    return primera === true || primera === "true";
  }

  async responder(usuario, preguntaCruda, historialCrudo, paginaCruda, { primera: primeraCruda } = {}) {
    const pagina = ["cultura", "deporte", "salud", "orientacion"].includes(paginaCruda) ? paginaCruda : null;
    const pregunta = typeof preguntaCruda === "string" ? preguntaCruda.trim() : "";
    if (!pregunta) throw new AppError(400, "Escribe una pregunta para el asistente.");
    const primera = this.esPrimera(historialCrudo, primeraCruda);
    const nota = (r) => ({ ...r, respuesta: conNota(r.respuesta, primera) });

    // 0. Protocolo de emergencia: PRIMERO que todo (antes del limite de longitud,
    //    el saludo, el animo, el filtro clinico, la agenda y la IA), y con el
    //    mensaje completo aunque sea largo o traiga emojis.
    const crisis = detectarCrisis(pregunta);
    if (crisis) return nota(await this.responderCrisis(usuario, crisis.motivo, pregunta));
    if (pregunta.length > MAX_LONGITUD) throw new AppError(400, `La pregunta no puede superar ${MAX_LONGITUD} caracteres.`);

    const texto = normalizar(pregunta);
    const primerNombre = usuario.nombre?.split(" ")[0] || "";
    const animo = detectarAnimo(texto);
    const seguridad = filtroDeSeguridad(texto);
    if (seguridad) {
      const frase = animo && !seguridad.crisis ? `${fraseDeAnimo(animo)}\n\n` : "";
      return nota({ ...seguridad, respuesta: `${frase}${seguridad.respuesta}` });
    }

    const contexto = await this.contexto(usuario);
    if (pagina) contexto.paginaActual = pagina;

    // Saludo y motivacion contextual: un saludo solo recibe una bienvenida
    // fresca con ideas concretas; si el estudiante cuenta como se siente, primero
    // va la frase de animo y luego la respuesta (o una oferta de ayuda).
    const { saludo, soloSaludo } = analizarSaludo(texto);
    if (soloSaludo && !animo) return nota({ origen: "local", ...bienvenida(primerNombre, contexto) });
    const encabezado = [saludo ? saludoCorto(primerNombre) : "", animo ? fraseDeAnimo(animo) : ""].filter(Boolean).join(" ");
    const presentar = (respuesta) => (encabezado ? `${encabezado}\n\n${respuesta}` : respuesta);

    const historial = limpiarHistorial(historialCrudo);
    const { directa, opciones } = this.agenda(texto, contexto, historial, pagina);
    if (directa) return nota({ ...directa, respuesta: presentar(directa.respuesta) });
    const extra = opciones ? { opciones } : {};
    let local = responderModulos(texto, contexto.modulos, pagina) || responderLocal(texto, contexto, primerNombre);
    if (local.generica && animo) local = ofertaDeAyuda(animo);
    const { generica, ...respuestaLocal } = local;

    if (claveGemini()) {
      try {
        const inicio = Date.now();
        const revisada = await this.revisarRespuestaIA(await this.consultarGemini(pregunta, contexto, usuario, historial, primera), usuario);
        if (revisada.crisis) return nota(revisada.crisis);
        registrar({ tipo: "asistente.consulta", estado: "exitosa", detalle: `Gemini respondió en ${Date.now() - inicio} ms.` });
        return nota({ origen: "gemini", respuesta: revisada.texto, sugerencias: respuestaLocal.sugerencias, ...extra });
      } catch (err) {
        const detalle = err.name === "AbortError" ? "Tiempo de espera agotado." : err.message;
        console.error(`[asistente] Gemini no respondio: ${detalle}`);
      }
    }

    if (config.n8nAgenteUrl) {
      try {
        const inicio = Date.now();
        const revisada = await this.revisarRespuestaIA(await this.consultarN8n(pregunta, contexto, usuario, historial, primera), usuario);
        if (revisada.crisis) return nota(revisada.crisis);
        registrar({ tipo: "asistente.consulta", estado: "exitosa", detalle: `Respondió en ${Date.now() - inicio} ms.` });
        return nota({ origen: "n8n", respuesta: revisada.texto, sugerencias: respuestaLocal.sugerencias, ...extra });
      } catch (err) {
        const detalle = err.name === "AbortError" ? "Tiempo de espera agotado." : err.message;
        registrar({ tipo: "asistente.consulta", estado: "fallida", detalle: `${detalle} Se respondió con la base local.` });
        console.error(`[asistente] n8n no respondio, se usa la base local: ${detalle}`);
      }
    }
    return nota({ origen: "local", ...respuestaLocal, respuesta: presentar(respuestaLocal.respuesta), ...extra });
  }
}

module.exports = { AsistenteService, asistenteService: new AsistenteService() };
