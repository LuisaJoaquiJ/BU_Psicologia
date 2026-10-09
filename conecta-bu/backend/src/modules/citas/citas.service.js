const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { config } = require("../../config/env");
const { moduloDeServicio, exigirMismoModulo } = require("../../common/utils/modulos");
const { quitarHorariosBloqueados } = require("../horarios/bloqueos.service");

// Colombia no tiene horario de verano: la hora del dia de un horario
// (guardada "tal cual" en UTC, ver seed.js) es hora de Bogota, UTC-5.
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;

// Instante real en que empieza una cita, a partir de la fecha y la hora
// del horario.
function inicioDeCita(horario) {
  const fecha = new Date(horario.fecha);
  const hora = horario.horaInicio ? new Date(horario.horaInicio) : new Date(Date.UTC(1970, 0, 1, 0, 0));
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hora.getUTCHours(), hora.getUTCMinutes()) + DESFASE_BOGOTA_MS);
}

// RF-004 / HU-07: horarios habilitados y aun no ocupados, desde hoy en adelante.
// Se filtran por modulo (Desarrollo humano o Salud integral).
async function listarHorariosDisponibles(modulo = "desarrollo-humano") {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const horarios = await prisma.horario.findMany({
    where: { ocupado: false, fecha: { gte: inicioHoy }, servicio: { modulo } },
    include: { servicio: true },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
  // Los horarios que caen en un tiempo no disponible del personal no se ofrecen.
  return quitarHorariosBloqueados(
    horarios.filter((h) => moduloDeServicio(h.servicio) === modulo),
    modulo,
  );
}

// RF-005 / HU-08, HU-09, HU-10: agenda una cita validando, dentro de una
// misma transaccion, que el estudiante no tenga ya una cita activa (RN-004)
// y que el horario siga disponible (RN-003: evita doble reserva por carreras
// entre solicitudes simultaneas). Con el modulo de Salud, RN-004 aplica por
// modulo: se puede tener una cita de orientacion y una de salud a la vez.
async function crearCita(usuarioId, horarioId) {
  return prisma.$transaction(async (tx) => {
    const horario = await tx.horario.findUnique({ where: { id: horarioId }, include: { servicio: true } });
    if (!horario) {
      throw new AppError(404, "El horario seleccionado no existe.");
    }

    const modulo = moduloDeServicio(horario.servicio);
    const citasActivas = await tx.cita.findMany({
      where: { usuarioId, estado: "Agendada" },
      include: { horario: { include: { servicio: true } } },
    });
    if (citasActivas.some((c) => moduloDeServicio(c.horario?.servicio) === modulo)) {
      throw new AppError(409, "Ya tienes una cita activa. Cancelala antes de agendar otra.");
    }

    // Actualizacion condicional (WHERE id AND ocupado=false): solo tiene
    // efecto si el horario sigue libre en este instante, lo que evita que
    // dos solicitudes simultaneas reserven el mismo horario (RN-003).
    const resultado = await tx.horario.updateMany({
      where: { id: horarioId, ocupado: false },
      data: { ocupado: true },
    });
    if (resultado.count === 0) {
      throw new AppError(409, "Ese horario ya no esta disponible. Elige otro.");
    }

    return tx.cita.create({
      data: { usuarioId, horarioId, estado: "Agendada" },
      include: { horario: { include: { servicio: true } } },
    });
  });
}

// RF-006 / HU-11: citas propias del estudiante.
// Cada modulo muestra solo sus citas (?modulo=desarrollo-humano | salud).
async function listarMisCitas(usuarioId, modulo) {
  const citas = await prisma.cita.findMany({
    where: { usuarioId },
    include: { horario: { include: { servicio: true } } },
    orderBy: { horario: { fecha: "desc" } },
  });
  // Las observaciones son notas internas del personal: no se envian al estudiante.
  const propias = citas.map(({ observaciones, ...c }) => c);
  return modulo ? propias.filter((c) => moduloDeServicio(c.horario?.servicio) === modulo) : propias;
}

// RF-006 / HU-12: cancela una cita propia y libera el horario. Regla
// confirmada con el cliente: solo se puede cancelar con al menos 24 horas
// de anticipacion (configurable con HORAS_MINIMAS_CANCELACION).
async function cancelarCita(usuarioId, citaId) {
  return prisma.$transaction(async (tx) => {
    const cita = await tx.cita.findUnique({ where: { id: citaId } });
    if (!cita || cita.usuarioId !== usuarioId) {
      throw new AppError(404, "Cita no encontrada.");
    }
    if (cita.estado !== "Agendada") {
      throw new AppError(409, "Esta cita ya no se puede cancelar.");
    }

    const horario = await tx.horario.findUnique({ where: { id: cita.horarioId } });
    const horasRestantes = (inicioDeCita(horario) - Date.now()) / (60 * 60 * 1000);
    if (horasRestantes < config.horasMinimasCancelacion) {
      throw new AppError(
        409,
        `Solo puedes cancelar con al menos ${config.horasMinimasCancelacion} horas de anticipacion. ` +
          "Si no puedes asistir, comunicate con Bienestar Universitario.",
      );
    }

    const actualizada = await tx.cita.update({
      where: { id: citaId },
      data: { estado: "Cancelada" },
      include: { horario: { include: { servicio: true } } },
    });
    await tx.horario.update({ where: { id: cita.horarioId }, data: { ocupado: false } });
    return actualizada;
  });
}

// RF-008 / HU-15: agenda administrativa de citas, con filtros opcionales por
// fecha, servicio y estado. A diferencia de "mis citas", aqui se ven las de
// todos los estudiantes junto con sus datos, para que el administrador pueda
// darle seguimiento a la jornada.
async function listarAgendaAdmin({ fecha, servicioId, estado, modulo = "desarrollo-humano" } = {}) {
  const where = {};
  if (estado) where.estado = estado;
  if (fecha || servicioId) {
    where.horario = {};
    if (fecha) where.horario.fecha = new Date(`${fecha}T00:00:00.000Z`);
    if (servicioId) where.horario.servicioId = servicioId;
  }

  const citas = await prisma.cita.findMany({
    where,
    include: { usuario: true, horario: { include: { servicio: true } } },
    orderBy: [{ horario: { fecha: "asc" } }, { horario: { horaInicio: "asc" } }],
  });
  return citas.filter((c) => moduloDeServicio(c.horario?.servicio) === modulo);
}

// RF-008 / HU-16: registra si el estudiante asistio o no a una cita ya
// realizada. Deja tanto el cambio de estado (Atendida/NoAsistio) como un
// registro de auditoria en AsistenciaCita con quien la registro.
async function registrarAsistencia(adminId, citaId, asistio, modulo = "desarrollo-humano") {
  return prisma.$transaction(async (tx) => {
    const cita = await tx.cita.findUnique({ where: { id: citaId }, include: { horario: { include: { servicio: true } } } });
    if (!cita) {
      throw new AppError(404, "Cita no encontrada.");
    }
    exigirMismoModulo(cita.horario?.servicio, modulo);
    if (cita.estado !== "Agendada") {
      throw new AppError(409, "Solo se puede registrar asistencia de una cita que este agendada.");
    }

    const yaRegistrada = await tx.asistenciaCita.findUnique({ where: { citaId } });
    if (yaRegistrada) {
      throw new AppError(409, "Ya se registro la asistencia de esta cita.");
    }

    const actualizada = await tx.cita.update({
      where: { id: citaId },
      data: { estado: asistio ? "Atendida" : "NoAsistio" },
      include: { usuario: true, horario: { include: { servicio: true } } },
    });

    await tx.asistenciaCita.create({
      data: { citaId, asistio: Boolean(asistio), registradoPorId: adminId },
    });

    return actualizada;
  });
}

module.exports = {
  listarHorariosDisponibles,
  crearCita,
  listarMisCitas,
  cancelarCita,
  inicioDeCita,
  listarAgendaAdmin,
  registrarAsistencia,
};
