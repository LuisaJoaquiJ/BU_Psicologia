const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");

// RF-004 / HU-07: horarios habilitados y aun no ocupados, desde hoy en adelante.
async function listarHorariosDisponibles() {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  return prisma.horario.findMany({
    where: { ocupado: false, fecha: { gte: inicioHoy } },
    include: { servicio: true },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
}

// RF-005 / HU-08, HU-09, HU-10: agenda una cita validando, dentro de una
// misma transaccion, que el estudiante no tenga ya una cita activa (RN-004)
// y que el horario siga disponible (RN-003: evita doble reserva por carreras
// entre solicitudes simultaneas).
async function crearCita(usuarioId, horarioId) {
  return prisma.$transaction(async (tx) => {
    const horario = await tx.horario.findUnique({ where: { id: horarioId } });
    if (!horario) {
      throw new AppError(404, "El horario seleccionado no existe.");
    }

    const citaActiva = await tx.cita.findFirst({
      where: { usuarioId, estado: "Agendada" },
    });
    if (citaActiva) {
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
async function listarMisCitas(usuarioId) {
  return prisma.cita.findMany({
    where: { usuarioId },
    include: { horario: { include: { servicio: true } } },
    orderBy: { horario: { fecha: "desc" } },
  });
}

// RF-006 / HU-12: cancela una cita propia y libera el horario.
// Nota: la regla de "minimo 24 horas de anticipacion" que aparece en el
// backlog (HU-12) queda pendiente de confirmar con el cliente -- por ahora
// solo se exige que la cita sea del estudiante y siga en estado "Agendada".
async function cancelarCita(usuarioId, citaId) {
  return prisma.$transaction(async (tx) => {
    const cita = await tx.cita.findUnique({ where: { id: citaId } });
    if (!cita || cita.usuarioId !== usuarioId) {
      throw new AppError(404, "Cita no encontrada.");
    }
    if (cita.estado !== "Agendada") {
      throw new AppError(409, "Esta cita ya no se puede cancelar.");
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
async function listarAgendaAdmin({ fecha, servicioId, estado } = {}) {
  const where = {};
  if (estado) where.estado = estado;
  if (fecha || servicioId) {
    where.horario = {};
    if (fecha) where.horario.fecha = new Date(`${fecha}T00:00:00.000Z`);
    if (servicioId) where.horario.servicioId = servicioId;
  }

  return prisma.cita.findMany({
    where,
    include: { usuario: true, horario: { include: { servicio: true } } },
    orderBy: [{ horario: { fecha: "asc" } }, { horario: { horaInicio: "asc" } }],
  });
}

// RF-008 / HU-16: registra si el estudiante asistio o no a una cita ya
// realizada. Deja tanto el cambio de estado (Atendida/NoAsistio) como un
// registro de auditoria en AsistenciaCita con quien la registro.
async function registrarAsistencia(adminId, citaId, asistio) {
  return prisma.$transaction(async (tx) => {
    const cita = await tx.cita.findUnique({ where: { id: citaId } });
    if (!cita) {
      throw new AppError(404, "Cita no encontrada.");
    }
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
  listarAgendaAdmin,
  registrarAsistencia,
};
