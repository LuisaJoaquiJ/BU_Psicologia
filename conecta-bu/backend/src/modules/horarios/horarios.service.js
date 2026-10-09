const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");

// Los horarios guardan solo la "hora del dia" usando una fecha de referencia
// fija (1970-01-01) en UTC (ver prisma/seed.js). Estos helpers convierten los
// strings que manda el formulario ("YYYY-MM-DD", "HH:mm") a ese mismo formato,
// para que la comparacion de solapamiento y el guardado sean consistentes.
function aFechaUTC(fechaStr) {
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) {
    throw new AppError(400, "La fecha del horario no es valida.");
  }
  return fecha;
}

function aHoraUTC(horaStr) {
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(horaStr || "");
  if (!match) {
    throw new AppError(400, "La hora debe tener el formato HH:mm.");
  }
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0));
}

// RN: dentro de un mismo servicio y fecha, dos horarios no pueden solaparse
// en el tiempo (evita que el admin publique franjas que se pisen entre si).
async function existeSolapamiento({ servicioId, fecha, horaInicio, horaFin, excluirId }) {
  const horarios = await prisma.horario.findMany({ where: { servicioId, fecha } });
  return horarios.some((h) => {
    if (excluirId && h.id === excluirId) return false;
    return h.horaInicio < horaFin && h.horaFin > horaInicio;
  });
}

// RF-007 / HU-13: el administrador publica un nuevo horario disponible.
async function crearHorario({ servicioId, fecha, horaInicio, horaFin, cupo }) {
  const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } });
  if (!servicio) {
    throw new AppError(404, "El servicio seleccionado no existe.");
  }

  const fechaUTC = aFechaUTC(fecha);
  const inicioUTC = aHoraUTC(horaInicio);
  const finUTC = aHoraUTC(horaFin);
  if (inicioUTC >= finUTC) {
    throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
  }

  const solapa = await existeSolapamiento({
    servicioId,
    fecha: fechaUTC,
    horaInicio: inicioUTC,
    horaFin: finUTC,
  });
  if (solapa) {
    throw new AppError(409, "Ya existe un horario de este servicio que se cruza con ese rango de horas.");
  }

  return prisma.horario.create({
    data: {
      servicioId,
      fecha: fechaUTC,
      horaInicio: inicioUTC,
      horaFin: finUTC,
      cupo: cupo ? Number(cupo) : 1,
      ocupado: false,
    },
    include: { servicio: true },
  });
}

// RF-007 / HU-13, HU-14: vista administrativa de todos los horarios
// (a diferencia de /citas/horarios-disponibles, aqui se listan tambien los
// ocupados/deshabilitados para poder gestionarlos).
async function listarTodosLosHorarios({ fecha, servicioId } = {}) {
  const where = {};
  if (fecha) where.fecha = aFechaUTC(fecha);
  if (servicioId) where.servicioId = servicioId;

  return prisma.horario.findMany({
    where,
    include: { servicio: true },
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
}

async function obtenerHorarioOFallar(id) {
  const horario = await prisma.horario.findUnique({ where: { id } });
  if (!horario) {
    throw new AppError(404, "El horario no existe.");
  }
  return horario;
}

// RF-007 / HU-14: modifica un horario que todavia no tiene una cita activa.
// Si ya tiene una cita agendada, se pide cancelarla o reasignarla antes de
// mover la fecha/hora, para no dejar al estudiante con datos inconsistentes.
async function actualizarHorario(id, cambios) {
  const horario = await obtenerHorarioOFallar(id);

  const citaActiva = await prisma.cita.findFirst({ where: { horarioId: id, estado: "Agendada" } });
  if (citaActiva) {
    throw new AppError(
      409,
      "Este horario tiene una cita agendada. Cancelala o reagendala antes de modificarlo."
    );
  }

  const fechaUTC = cambios.fecha ? aFechaUTC(cambios.fecha) : horario.fecha;
  const inicioUTC = cambios.horaInicio ? aHoraUTC(cambios.horaInicio) : horario.horaInicio;
  const finUTC = cambios.horaFin ? aHoraUTC(cambios.horaFin) : horario.horaFin;
  if (inicioUTC >= finUTC) {
    throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
  }

  const servicioId = cambios.servicioId || horario.servicioId;
  const solapa = await existeSolapamiento({
    servicioId,
    fecha: fechaUTC,
    horaInicio: inicioUTC,
    horaFin: finUTC,
    excluirId: id,
  });
  if (solapa) {
    throw new AppError(409, "Ya existe un horario de este servicio que se cruza con ese rango de horas.");
  }

  return prisma.horario.update({
    where: { id },
    data: {
      servicioId,
      fecha: fechaUTC,
      horaInicio: inicioUTC,
      horaFin: finUTC,
      cupo: cambios.cupo ? Number(cambios.cupo) : horario.cupo,
    },
    include: { servicio: true },
  });
}

// RF-007 / HU-14: deshabilita un horario para que deje de ofrecerse. Si ya
// tiene una cita agendada, exige una confirmacion explicita (confirmar=true)
// porque tambien cancela esa cita, igual que la cancelacion del propio
// estudiante (libera el registro pero no vuelve a marcarlo como disponible).
async function deshabilitarHorario(id, confirmar) {
  return prisma.$transaction(async (tx) => {
    const horario = await tx.horario.findUnique({ where: { id } });
    if (!horario) {
      throw new AppError(404, "El horario no existe.");
    }
    if (horario.ocupado && !(await tx.cita.findFirst({ where: { horarioId: id, estado: "Agendada" } }))) {
      // Ya estaba deshabilitado (o su cita ya se resolvio) y no hay nada que cancelar.
      return horario;
    }

    const citaActiva = await tx.cita.findFirst({ where: { horarioId: id, estado: "Agendada" } });
    if (citaActiva && !confirmar) {
      throw new AppError(
        409,
        "Este horario tiene una cita agendada. Confirma para deshabilitarlo y cancelar esa cita."
      );
    }

    if (citaActiva) {
      await tx.cita.update({ where: { id: citaActiva.id }, data: { estado: "Cancelada" } });
    }

    return tx.horario.update({ where: { id }, data: { ocupado: true }, include: { servicio: true } });
  });
}

// RF-007 / HU-14: vuelve a habilitar un horario deshabilitado manualmente.
// Se rechaza si el horario esta "ocupado" por una cita activa real, para no
// permitir que dos estudiantes terminen compitiendo por el mismo cupo.
async function habilitarHorario(id) {
  const horario = await obtenerHorarioOFallar(id);
  if (!horario.ocupado) {
    return prisma.horario.findUnique({ where: { id }, include: { servicio: true } });
  }

  const citaActiva = await prisma.cita.findFirst({ where: { horarioId: id, estado: "Agendada" } });
  if (citaActiva) {
    throw new AppError(409, "No se puede habilitar: el horario tiene una cita activa asociada.");
  }

  return prisma.horario.update({ where: { id }, data: { ocupado: false }, include: { servicio: true } });
}

module.exports = {
  crearHorario,
  listarTodosLosHorarios,
  actualizarHorario,
  deshabilitarHorario,
  habilitarHorario,
};
