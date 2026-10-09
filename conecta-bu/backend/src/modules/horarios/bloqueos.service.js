const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, aHoraUTC, hoyBogota } = require("../../common/utils/fechas");
const { moduloDeServicio } = require("../../common/utils/modulos");
const automatizaciones = require("../../integrations/automatizaciones");

// Tiempo no disponible del personal del modulo: mientras dure, los horarios
// que se crucen no se ofrecen a los estudiantes y no se pueden publicar
// nuevos. El motivo solo lo ve el personal.

const MOTIVOS = [
  "Compromiso institucional",
  "Reunión",
  "Capacitación",
  "Salida institucional",
  "Permiso laboral",
  "Incapacidad",
  "Vacaciones",
  "Calamidad doméstica",
  "Otro",
];

const ms = (d) => (d ? new Date(d).getTime() : 0);
const iso = (d) => new Date(d).toISOString().slice(0, 10);

// ¿El bloqueo cubre ese dia y ese rango de horas?
function cruza(bloqueo, fecha, horaInicio, horaFin) {
  const dia = ms(fecha);
  if (dia < ms(bloqueo.fechaInicio) || dia > ms(bloqueo.fechaFin)) return false;
  if (bloqueo.todoElDia) return true;
  return ms(horaInicio) < ms(bloqueo.horaFin) && ms(horaFin) > ms(bloqueo.horaInicio);
}

async function bloqueosEntre(modulo, desde, hasta) {
  const where = { modulo };
  if (hasta) where.fechaInicio = { lte: hasta };
  if (desde) where.fechaFin = { gte: desde };
  return prisma.bloqueoAgenda.findMany({ where, orderBy: [{ fechaInicio: "asc" }] });
}

// Quita de una lista de horarios los que caen dentro de un bloqueo.
async function quitarHorariosBloqueados(horarios, modulo) {
  if (!horarios.length) return horarios;
  const bloqueos = await bloqueosEntre(modulo, hoyBogota());
  if (!bloqueos.length) return horarios;
  return horarios.filter((h) => !bloqueos.some((b) => cruza(b, h.fecha, h.horaInicio, h.horaFin)));
}

// Bloqueo que impide publicar un horario en ese dia y hora, si lo hay.
async function bloqueoQueCruza(modulo, fecha, horaInicio, horaFin) {
  const bloqueos = await bloqueosEntre(modulo, fecha, fecha);
  return bloqueos.find((b) => cruza(b, fecha, horaInicio, horaFin)) || null;
}

function serializar(b) {
  return { ...b, fechaInicio: iso(b.fechaInicio), fechaFin: iso(b.fechaFin) };
}

async function listarBloqueos(modulo, { desde, hasta } = {}) {
  const lista = await bloqueosEntre(modulo, desde ? aFechaUTC(desde) : null, hasta ? aFechaUTC(hasta) : null);
  return lista.map(serializar);
}

function datosBloqueo(cuerpo) {
  const motivo = String(cuerpo.motivo || "").trim();
  if (!MOTIVOS.includes(motivo)) throw new AppError(400, "Elige el motivo por el que no vas a estar disponible.");
  const detalle =
    String(cuerpo.detalle || "")
      .trim()
      .slice(0, 300) || null;
  if (motivo === "Otro" && !detalle) throw new AppError(400, "Cuéntanos brevemente el motivo.");

  const fechaInicio = aFechaUTC(cuerpo.fechaInicio, "fecha de inicio");
  const fechaFin = cuerpo.fechaFin ? aFechaUTC(cuerpo.fechaFin, "fecha de fin") : fechaInicio;
  if (fechaFin < fechaInicio) throw new AppError(400, "La fecha de fin no puede ser anterior a la de inicio.");
  if (fechaFin < hoyBogota()) throw new AppError(400, "Ese tiempo ya pasó: elige hoy o una fecha futura.");
  if ((ms(fechaFin) - ms(fechaInicio)) / 864e5 > 120) throw new AppError(400, "Registra máximo 4 meses seguidos.");

  const todoElDia = cuerpo.todoElDia === undefined ? true : cuerpo.todoElDia === true || cuerpo.todoElDia === "true";
  let horaInicio = null;
  let horaFin = null;
  if (!todoElDia) {
    horaInicio = aHoraUTC(cuerpo.horaInicio, "hora de inicio");
    horaFin = aHoraUTC(cuerpo.horaFin, "hora de fin");
    if (horaInicio >= horaFin) throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
  }
  return { motivo, detalle, fechaInicio, fechaFin, todoElDia, horaInicio, horaFin };
}

// Crea el bloqueo. Si hay citas agendadas en ese tiempo, pide confirmar;
// al confirmar, se cancelan (y se avisa a cada estudiante).
async function crearBloqueo(cuerpo, usuario, modulo) {
  const datos = datosBloqueo(cuerpo);
  const horarios = (
    await prisma.horario.findMany({
      where: { fecha: { gte: datos.fechaInicio, lte: datos.fechaFin } },
      include: { servicio: true },
    })
  ).filter((h) => !h.sinCita && moduloDeServicio(h.servicio) === modulo && cruza(datos, h.fecha, h.horaInicio, h.horaFin));

  const afectadas = [];
  for (const h of horarios) {
    const cita = await prisma.cita.findFirst({ where: { horarioId: h.id, estado: "Agendada" } });
    if (cita) afectadas.push({ cita, horario: h });
  }

  if (afectadas.length && !(cuerpo.confirmar === true || cuerpo.confirmar === "true")) {
    const err = new AppError(
      409,
      `En ese tiempo ${afectadas.length === 1 ? "hay 1 cita agendada" : `hay ${afectadas.length} citas agendadas`}. Confirma para cancelarlas y avisar a los estudiantes.`,
      "CITAS_EN_BLOQUEO",
    );
    throw err;
  }

  const bloqueo = await prisma.bloqueoAgenda.create({ data: { ...datos, modulo, creadoPor: usuario?.nombre || null } });

  for (const { cita } of afectadas) {
    const cancelada = await prisma.cita.update({
      where: { id: cita.id },
      data: { estado: "Cancelada" },
      include: { usuario: true, horario: { include: { servicio: true } } },
    });
    await prisma.horario.update({ where: { id: cita.horarioId }, data: { ocupado: true } });
    if (cancelada?.usuario) automatizaciones.citaCancelada(cancelada.usuario, cancelada);
  }

  return { bloqueo: serializar(bloqueo), citasCanceladas: afectadas.length, horariosAfectados: horarios.length };
}

// Citas que se cancelarian, para mostrarlas antes de confirmar.
async function citasEnRango(cuerpo, modulo) {
  const datos = datosBloqueo(cuerpo);
  const horarios = (await prisma.horario.findMany({ where: { fecha: { gte: datos.fechaInicio, lte: datos.fechaFin } }, include: { servicio: true } })).filter(
    (h) => !h.sinCita && moduloDeServicio(h.servicio) === modulo && cruza(datos, h.fecha, h.horaInicio, h.horaFin),
  );
  const lista = [];
  for (const h of horarios) {
    const cita = await prisma.cita.findFirst({ where: { horarioId: h.id, estado: "Agendada" }, include: { usuario: true } });
    if (cita) lista.push({ id: cita.id, estudiante: cita.usuario?.nombre || "", servicio: h.servicio?.nombre, fecha: iso(h.fecha), horaInicio: h.horaInicio });
  }
  return lista;
}

async function eliminarBloqueo(id, modulo) {
  const bloqueo = await prisma.bloqueoAgenda.findUnique({ where: { id } });
  if (!bloqueo || bloqueo.modulo !== modulo) throw new AppError(404, "No encontramos ese tiempo no disponible.");
  await prisma.bloqueoAgenda.delete({ where: { id } });
  return serializar(bloqueo);
}

module.exports = { MOTIVOS, cruza, listarBloqueos, crearBloqueo, citasEnRango, eliminarBloqueo, quitarHorariosBloqueados, bloqueoQueCruza };
