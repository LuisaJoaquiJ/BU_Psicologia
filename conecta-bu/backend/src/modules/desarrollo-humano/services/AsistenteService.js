const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { postJson, registrar } = require("../../../integrations/n8n.client");
const { servicioService } = require("./ServicioService");
const { citaService } = require("./CitaService");
const { eventoEstudianteService } = require("./EventoEstudianteService");
const { inicioDeCita } = require("../utils/agenda");
const { MAX_LONGITUD, normalizar, filtroDeSeguridad, fechaTexto, horaTexto, limpiarHistorial } = require("../utils/asistenteSeguridad");
const { PATRON_CITA, proponerHorarios, veniaAgendando } = require("../utils/asistenteAgenda");
const { responderLocal } = require("../utils/asistenteRespuestas");

const REGLAS =
  "Responde en español, de forma breve y amable, solo sobre los servicios de Desarrollo Humano / " +
  "Orientación y el uso de Conecta BU. No hagas diagnósticos, no recomiendes medicamentos ni " +
  "tratamientos y no tomes decisiones clínicas (RN-011); en esos casos orienta a agendar una cita. " +
  "No inventes horarios, eventos ni enlaces: usa solo el contexto. Si el estudiante quiere una cita, " +
  "dile que debajo de tu respuesta verá los horarios libres para agendar con un clic, o que puede " +
  "escribirte el día y la hora que prefiere. No puedes cancelar citas: eso se hace en «Mis citas».";

// RF-014: asistente de orientacion. Flujo:
//   1. Filtros de seguridad locales (RN-011) ANTES de cualquier IA: crisis y
//      solicitudes clinicas nunca se envian al modelo.
//   2. Si N8N_AGENTE_URL esta configurada, la consulta va al flujo de n8n
//      (que puede usar Gemini u otro modelo) con contexto del modulo.
//   3. Si n8n no esta configurado o falla, responde la base local con los
//      datos reales (servicios, horarios, eventos).
class AsistenteService {
  // Contexto autorizado para el agente: el agente no consulta la base de
  // datos; recibe solo datos de Orientacion y, del estudiante, sus propias
  // citas e inscripciones. Nunca notas del personal ni datos de otros.
  async contexto(usuario) {
    const [servicios, horarios, eventos, citas] = await Promise.all([
      servicioService.activos(),
      citaService.disponibles(),
      eventoEstudianteService.publicados(usuario.id),
      citaService.mias(usuario.id),
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

  async consultarN8n(pregunta, contexto, usuario, historial) {
    const usuarioIA = { nombre: usuario.nombre?.split(" ")[0] || "" };
    const resultado = await postJson(config.n8nAgenteUrl, { pregunta, historial, usuario: usuarioIA, contexto, reglas: REGLAS }, config.n8nAgenteTimeoutMs);
    const respuesta = typeof resultado?.respuesta === "string" ? resultado.respuesta.trim() : "";
    if (!respuesta) throw new Error("n8n no devolvio el campo 'respuesta'.");
    return respuesta.slice(0, 2000);
  }

  // Si el estudiante pide una cita (o responde a los horarios ofrecidos), el
  // backend busca horarios reales; la IA no los puede inventar.
  agenda(texto, contexto, historial) {
    const preguntaPorSuCita = /(mi cita|mis citas|tengo (una )?cita|cuando es mi|a que hora es mi)/.test(texto);
    if (/cancel/.test(texto) || preguntaPorSuCita) return {};
    const { horarios, servicios } = contexto._interno;
    const seguimiento = veniaAgendando(historial) && !/(evento|taller|servicios)/.test(texto);
    if (!PATRON_CITA.test(texto) && !seguimiento) return {};
    const directa = proponerHorarios(texto, contexto, horarios, servicios, { forzar: seguimiento });
    if (directa) return { directa: { origen: "agenda", ...directa } };
    // Pregunta general («¿cómo agendo?»): se responde normal y se ofrecen los horarios.
    return { opciones: proponerHorarios(texto, contexto, horarios, servicios, { forzar: true })?.opciones || null };
  }

  async responder(usuario, preguntaCruda, historialCrudo) {
    const pregunta = typeof preguntaCruda === "string" ? preguntaCruda.trim() : "";
    if (!pregunta) throw new AppError(400, "Escribe una pregunta para el asistente.");
    if (pregunta.length > MAX_LONGITUD) throw new AppError(400, `La pregunta no puede superar ${MAX_LONGITUD} caracteres.`);

    const texto = normalizar(pregunta);
    const seguridad = filtroDeSeguridad(texto);
    if (seguridad) return seguridad;

    const contexto = await this.contexto(usuario);
    const historial = limpiarHistorial(historialCrudo);
    const { directa, opciones } = this.agenda(texto, contexto, historial);
    if (directa) return directa;
    const extra = opciones ? { opciones } : {};
    const local = responderLocal(texto, contexto, usuario.nombre?.split(" ")[0]);

    if (config.n8nAgenteUrl) {
      try {
        const inicio = Date.now();
        const respuesta = await this.consultarN8n(pregunta, contexto, usuario, historial);
        registrar({ tipo: "asistente.consulta", estado: "exitosa", detalle: `Respondió en ${Date.now() - inicio} ms.` });
        return { origen: "n8n", respuesta, sugerencias: local.sugerencias, ...extra };
      } catch (err) {
        const detalle = err.name === "AbortError" ? "Tiempo de espera agotado." : err.message;
        registrar({ tipo: "asistente.consulta", estado: "fallida", detalle: `${detalle} Se respondió con la base local.` });
        console.error(`[asistente] n8n no respondio, se usa la base local: ${detalle}`);
      }
    }
    return { origen: "local", ...local, ...extra };
  }
}

module.exports = { AsistenteService, asistenteService: new AsistenteService() };
