const { notificar } = require("./n8n.client");

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

function citaAgendada(usuario, cita, modulo) {
  notificar("cita.agendada", { estudiante: datosEstudiante(usuario), cita: datosCita(cita, modulo) });
}

function citaCancelada(usuario, cita, modulo) {
  notificar("cita.cancelada", { estudiante: datosEstudiante(usuario), cita: datosCita(cita, modulo) });
}

function inscripcionEvento(usuario, inscripcion) {
  notificar("evento.inscripcion", {
    estudiante: datosEstudiante(usuario),
    evento: inscripcion.evento ? datosEvento(inscripcion.evento) : { eventoId: inscripcion.eventoId },
  });
}

function inscripcionCancelada(usuario, inscripcion) {
  notificar("evento.inscripcion_cancelada", {
    estudiante: datosEstudiante(usuario),
    evento: inscripcion.evento ? datosEvento(inscripcion.evento) : { eventoId: inscripcion.eventoId },
  });
}

function eventoPublicado(evento) {
  notificar("evento.publicado", { evento: { ...datosEvento(evento), cupos: evento.cupos } });
}

module.exports = { citaAgendada, citaCancelada, inscripcionEvento, inscripcionCancelada, eventoPublicado };
