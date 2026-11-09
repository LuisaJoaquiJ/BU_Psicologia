const { notificar } = require("./n8n.client");
const avisos = require("../modules/notificaciones/service");

// Aviso dentro de la plataforma (centro de notificaciones). No bloquea ni falla: el servicio ya captura sus errores.
function avisar(usuarioId, datos) {
  avisos.crear(usuarioId, datos);
}
const fechaLarga = (f) => (f ? new Date(f).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");
const horaCorta = (h) => {
  if (!h) return "";
  const fecha = /^\d{2}:\d{2}$/.test(String(h)) ? new Date(`1970-01-01T${h}:00.000Z`) : new Date(h);
  // «3:00 p. m.» ya trae su punto final: se quita para que el mensaje no termine en «..».
  return Number.isNaN(fecha.getTime()) ? "" : fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).replace(/.$/, "");
};

// RF-013: arma el payload "autorizado" de cada automatizacion. Solo viaja la
// informacion necesaria para notificar (nombre, correo institucional y datos
// de la cita/evento); nunca observaciones ni informacion clinica.

function datosEstudiante(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, email: usuario.emailInstitucional };
}

// modulo: de que area es la cita (el correo lo nombra: Orientacion, Salud Integral).
function datosCita(cita, modulo = "Orientación") {
  return {
    citaId: cita.id,
    modulo,
    estado: cita.estado,
    servicio: cita.horario?.servicio?.nombre,
    fecha: cita.horario?.fecha,
    horaInicio: cita.horario?.horaInicio,
    horaFin: cita.horario?.horaFin,
  };
}

function datosEvento(evento) {
  return {
    eventoId: evento.id,
    nombre: evento.nombre,
    fecha: evento.fecha,
    horaInicio: evento.horaInicio,
    horaFin: evento.horaFin,
    lugar: evento.lugar,
  };
}

const esSalud = (modulo) => modulo === "Salud Integral";

function citaAgendada(usuario, cita, modulo) {
  notificar("cita.agendada", { estudiante: datosEstudiante(usuario), cita: datosCita(cita, modulo) });
  const h = cita.horario;
  avisar(usuario.id, {
    modulo: esSalud(modulo) ? "salud" : "desarrollo-humano",
    tipo: "cita",
    titulo: "Cita agendada",
    mensaje: `Tu cita de ${h?.servicio?.nombre || "orientación"} es el ${fechaLarga(h?.fecha)} a las ${horaCorta(h?.horaInicio)}.`,
    ruta: esSalud(modulo) ? "/mi-salud/mis-citas" : "/estudiante/mis-citas",
  });
  // Al personal: llego una cita nueva.
  avisos.avisarAlPersonal(esSalud(modulo) ? "salud" : "desarrollo-humano", {
    modulo: esSalud(modulo) ? "salud" : "desarrollo-humano",
    tipo: "cita-nueva",
    titulo: "Nueva cita agendada",
    mensaje: `${usuario.nombre} agendó ${h?.servicio?.nombre || "una cita"} para el ${fechaLarga(h?.fecha)} a las ${horaCorta(h?.horaInicio)}.`,
    ruta: esSalud(modulo) ? "/salud/citas" : "/admin/citas",
  });
}

// porPersonal: la cancelo el personal (por ejemplo al bloquear un horario), asi que no se le avisa al personal.
function citaCancelada(usuario, cita, modulo, { porPersonal = false } = {}) {
  notificar("cita.cancelada", { estudiante: datosEstudiante(usuario), cita: datosCita(cita, modulo) });
  const h = cita.horario;
  avisar(usuario.id, {
    modulo: esSalud(modulo) ? "salud" : "desarrollo-humano",
    tipo: "cita",
    titulo: "Cita cancelada",
    mensaje: `Se canceló tu cita de ${h?.servicio?.nombre || "orientación"} del ${fechaLarga(h?.fecha)}.`,
    ruta: esSalud(modulo) ? "/mi-salud/mis-citas" : "/estudiante/mis-citas",
  });
  if (!porPersonal) {
    avisos.avisarAlPersonal(esSalud(modulo) ? "salud" : "desarrollo-humano", {
      modulo: esSalud(modulo) ? "salud" : "desarrollo-humano",
      tipo: "cita-cancelada",
      titulo: "Una cita se canceló",
      mensaje: `${usuario.nombre} canceló ${h?.servicio?.nombre || "su cita"} del ${fechaLarga(h?.fecha)} a las ${horaCorta(h?.horaInicio)}. El horario quedó libre.`,
      ruta: esSalud(modulo) ? "/salud/citas" : "/admin/citas",
    });
  }
}

function inscripcionEvento(usuario, inscripcion) {
  notificar("evento.inscripcion", {
    estudiante: datosEstudiante(usuario),
    evento: inscripcion.evento ? datosEvento(inscripcion.evento) : { eventoId: inscripcion.eventoId },
  });
  const ev = inscripcion.evento;
  avisar(usuario.id, {
    modulo: "desarrollo-humano",
    tipo: "inscripcion",
    titulo: "Inscripción confirmada",
    mensaje: ev?.nombre ? `Quedaste inscrito/a en ${ev.nombre}${ev.fecha ? `, el ${fechaLarga(ev.fecha)}` : ""}.` : "Quedaste inscrito/a en el evento.",
    ruta: "/estudiante/eventos",
  });
  avisos.avisarAlPersonal("desarrollo-humano", { modulo: "desarrollo-humano", tipo: "inscripcion", titulo: "Nueva inscripción", mensaje: `${usuario.nombre} se inscribió en ${ev?.nombre || "un evento"}.`, ruta: "/admin/eventos" });
}

function inscripcionCancelada(usuario, inscripcion) {
  notificar("evento.inscripcion_cancelada", {
    estudiante: datosEstudiante(usuario),
    evento: inscripcion.evento ? datosEvento(inscripcion.evento) : { eventoId: inscripcion.eventoId },
  });
  avisar(usuario.id, {
    modulo: "desarrollo-humano",
    tipo: "inscripcion",
    titulo: "Inscripción cancelada",
    mensaje: inscripcion.evento?.nombre ? `Cancelaste tu inscripción en ${inscripcion.evento.nombre}.` : "Cancelaste tu inscripción al evento.",
    ruta: "/estudiante/eventos",
  });
  avisos.avisarAlPersonal("desarrollo-humano", { modulo: "desarrollo-humano", tipo: "inscripcion", titulo: "Una inscripción se canceló", mensaje: `${usuario.nombre} canceló su inscripción en ${inscripcion.evento?.nombre || "un evento"}.`, ruta: "/admin/eventos" });
}

// Salud guarda las horas como "HH:mm"; el correo las lee como fecha ISO, igual
// que las de Desarrollo Humano (hora local de Bogota guardada en UTC).
const horaIso = (h) => (/^\d{2}:\d{2}$/.test(String(h || "")) ? `1970-01-01T${h}:00.000Z` : h || null);

// Jornadas y campanas de Salud: usan el mismo correo de inscripcion a eventos.
function datosJornada(actividad) {
  return {
    eventoId: actividad.id,
    nombre: actividad.nombre,
    fecha: actividad.fechaInicio,
    horaInicio: horaIso(actividad.horaInicio),
    horaFin: horaIso(actividad.horaFin),
    lugar: actividad.lugar,
    modulo: "Salud Integral",
  };
}

function jornadaInscripcion(usuario, actividad) {
  notificar("evento.inscripcion", { estudiante: datosEstudiante(usuario), evento: datosJornada(actividad) });
  avisar(usuario.id, { modulo: "salud", tipo: "inscripcion", titulo: "Inscripción confirmada", mensaje: `Quedaste inscrito/a en ${actividad.nombre}, el ${fechaLarga(actividad.fechaInicio)}.`, ruta: "/mi-salud/jornadas" });
  avisos.avisarAlPersonal("salud", { modulo: "salud", tipo: "inscripcion", titulo: "Nueva inscripción a una jornada", mensaje: `${usuario.nombre} se inscribió en ${actividad.nombre}.`, ruta: "/salud/actividades" });
}

function jornadaCancelada(usuario, actividad) {
  notificar("evento.inscripcion_cancelada", { estudiante: datosEstudiante(usuario), evento: datosJornada(actividad) });
  avisar(usuario.id, { modulo: "salud", tipo: "inscripcion", titulo: "Inscripción cancelada", mensaje: `Cancelaste tu inscripción en ${actividad.nombre}.`, ruta: "/mi-salud/jornadas" });
  avisos.avisarAlPersonal("salud", { modulo: "salud", tipo: "inscripcion", titulo: "Una inscripción a jornada se canceló", mensaje: `${usuario.nombre} canceló su inscripción en ${actividad.nombre}.`, ruta: "/salud/actividades" });
}

// Salidas academicas: la inscripcion queda en revision hasta que Salud la aprueba.
function datosSalida(salida) {
  return {
    salidaId: salida.id,
    nombre: salida.nombre,
    destino: salida.destino,
    fecha: salida.fechaSalida,
    fechaRegreso: salida.fechaRegreso,
    horaSalida: horaIso(salida.horaSalida),
    horaRegreso: horaIso(salida.horaRegreso),
    lugarEncuentro: salida.lugarEncuentro,
  };
}

function salidaInscripcion(usuario, salida) {
  notificar("salida.inscripcion", { estudiante: datosEstudiante(usuario), salida: datosSalida(salida) });
  avisar(usuario.id, { modulo: "salud", tipo: "salida", titulo: "Solicitud de salida recibida", mensaje: `Tu inscripción a ${salida.nombre} quedó en revisión. Te avisaremos cuando Salud la revise.`, ruta: "/mi-salud/salidas" });
  avisos.avisarAlPersonal("salud", { modulo: "salud", tipo: "salida-solicitud", titulo: "Nueva solicitud de salida", mensaje: `${usuario.nombre} se inscribió a ${salida.nombre}. Está pendiente de revisión.`, ruta: "/salud/salidas-estudiantes" });
}

function salidaCancelada(usuario, salida) {
  notificar("salida.inscripcion_cancelada", { estudiante: datosEstudiante(usuario), salida: datosSalida(salida) });
  avisar(usuario.id, { modulo: "salud", tipo: "salida", titulo: "Solicitud de salida cancelada", mensaje: `Cancelaste tu inscripción a ${salida.nombre}.`, ruta: "/mi-salud/salidas" });
  avisos.avisarAlPersonal("salud", { modulo: "salud", tipo: "salida-solicitud", titulo: "Una solicitud de salida se canceló", mensaje: `${usuario.nombre} canceló su inscripción a ${salida.nombre}.`, ruta: "/salud/salidas-estudiantes" });
}

// El estudiante es quien se inscribio (no quien revisa): sus datos salen de la inscripcion.
function salidaRevisada(inscripcion, salida) {
  if (!["Aprobada", "Rechazada"].includes(inscripcion.estado)) return;
  notificar("salida.revisada", {
    estudiante: { id: inscripcion.usuarioId, nombre: inscripcion.nombre, email: inscripcion.correo },
    salida: datosSalida(salida),
    revision: { estado: inscripcion.estado, observacion: inscripcion.observacion || null },
  });
  const aprobada = inscripcion.estado === "Aprobada";
  avisar(inscripcion.usuarioId, {
    modulo: "salud",
    tipo: "salida",
    titulo: aprobada ? "Salida aprobada" : "Salida no aprobada",
    mensaje: aprobada ? `Tu inscripción a ${salida.nombre} fue aprobada.` : `Tu inscripción a ${salida.nombre} no fue aprobada.${inscripcion.observacion ? ` Motivo: ${inscripcion.observacion}` : ""}`,
    ruta: "/mi-salud/salidas",
  });
}

function eventoPublicado(evento) {
  notificar("evento.publicado", { evento: { ...datosEvento(evento), cupos: evento.cupos } });
  const hora = horaCorta(evento.horaInicio);
  avisos.difundirAEstudiantes({
    modulo: "desarrollo-humano",
    tipo: "evento-publicado",
    titulo: "Nuevo taller o evento",
    mensaje: `${evento.nombre}: ${fechaLarga(evento.fecha)}${hora ? ` a las ${hora}` : ""}${evento.lugar ? ` · ${evento.lugar}` : ""}.`,
    ruta: "/estudiante/eventos",
  });
}

module.exports = {
  citaAgendada,
  citaCancelada,
  inscripcionEvento,
  inscripcionCancelada,
  eventoPublicado,
  jornadaInscripcion,
  jornadaCancelada,
  salidaInscripcion,
  salidaCancelada,
  salidaRevisada,
};
