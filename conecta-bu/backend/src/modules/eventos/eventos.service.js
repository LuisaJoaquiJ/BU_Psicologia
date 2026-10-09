const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, aHoraUTC, hoyUTC } = require("../../common/utils/fechas");

const ESTADOS_EVENTO = ["Borrador", "Publicado", "Cerrado", "Cancelado"];

// Cuenta solo las inscripciones vigentes (las canceladas liberan el cupo).
const CONTEO_INSCRITOS = { _count: { select: { inscripciones: { where: { estado: "Confirmada" } } } } };

function inscritosConfirmados(evento) {
  return evento?._count?.inscripciones ?? 0;
}

function validarCupos(cupos) {
  const numero = Number(cupos);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new AppError(400, "Los cupos deben ser un numero entero mayor o igual a 1.");
  }
  return numero;
}

// RF-009, flujo principal paso 4: valida y normaliza los datos del formulario.
function normalizarDatosEvento(datos, actual = {}) {
  const nombre = (datos.nombre ?? actual.nombre ?? "").trim();
  if (!nombre) {
    throw new AppError(400, "El nombre del evento es obligatorio.");
  }

  const fecha = datos.fecha ? aFechaUTC(datos.fecha, "fecha del evento") : actual.fecha;
  const horaInicio = datos.horaInicio ? aHoraUTC(datos.horaInicio, "hora de inicio") : actual.horaInicio;
  const horaFin = datos.horaFin ? aHoraUTC(datos.horaFin, "hora de fin") : actual.horaFin;
  if (horaInicio >= horaFin) {
    throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
  }

  const fechaLimiteInscripcion = datos.fechaLimiteInscripcion
    ? aFechaUTC(datos.fechaLimiteInscripcion, "fecha limite de inscripcion")
    : actual.fechaLimiteInscripcion;
  if (fechaLimiteInscripcion > fecha) {
    throw new AppError(400, "La fecha limite de inscripcion no puede ser posterior a la fecha del evento.");
  }

  return {
    nombre,
    descripcion: datos.descripcion !== undefined ? datos.descripcion || null : actual.descripcion ?? null,
    lugar: datos.lugar !== undefined ? datos.lugar || null : actual.lugar ?? null,
    fecha,
    horaInicio,
    horaFin,
    cupos: datos.cupos !== undefined ? validarCupos(datos.cupos) : actual.cupos,
    fechaLimiteInscripcion,
  };
}

async function obtenerEventoOFallar(id, include = CONTEO_INSCRITOS) {
  const evento = await prisma.evento.findUnique({ where: { id }, include });
  if (!evento) {
    throw new AppError(404, "El evento no existe.");
  }
  return evento;
}

// ---------------------------------------------------------------------------
// Administrador (RF-009 / RF-011, RN-008)
// ---------------------------------------------------------------------------

// RF-009: crea un evento. Por defecto queda en Borrador para que el
// administrador lo revise antes de publicarlo a los estudiantes.
async function crearEvento(datos) {
  const estado = datos.estado || "Borrador";
  if (!["Borrador", "Publicado"].includes(estado)) {
    throw new AppError(400, "Un evento nuevo solo puede crearse como Borrador o Publicado.");
  }
  const data = { ...normalizarDatosEvento(datos), estado };
  return prisma.evento.create({ data, include: CONTEO_INSCRITOS });
}

// RF-009: vista administrativa de todos los eventos con su numero de inscritos.
async function listarEventosAdmin({ estado } = {}) {
  const where = {};
  if (estado) {
    if (!ESTADOS_EVENTO.includes(estado)) {
      throw new AppError(400, `Estado no valido. Usa uno de: ${ESTADOS_EVENTO.join(", ")}.`);
    }
    where.estado = estado;
  }
  return prisma.evento.findMany({
    where,
    include: CONTEO_INSCRITOS,
    orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
  });
}

// RF-009: edita un evento. RN-007: no se permite dejar menos cupos que
// estudiantes ya inscritos.
async function actualizarEvento(id, cambios) {
  const actual = await obtenerEventoOFallar(id);
  if (actual.estado === "Cancelado") {
    throw new AppError(409, "El evento esta cancelado y ya no se puede editar.");
  }

  const data = normalizarDatosEvento(cambios, actual);
  const inscritos = inscritosConfirmados(actual);
  if (data.cupos < inscritos) {
    throw new AppError(
      409,
      `El evento ya tiene ${inscritos} inscritos: los cupos no pueden ser menores a esa cantidad.`
    );
  }

  return prisma.evento.update({ where: { id }, data, include: CONTEO_INSCRITOS });
}

// RF-009: publica, cierra, cancela o devuelve a borrador un evento, dejando
// trazabilidad del cambio en historial_estados.
async function cambiarEstadoEvento(adminId, id, nuevoEstado) {
  if (!ESTADOS_EVENTO.includes(nuevoEstado)) {
    throw new AppError(400, `Estado no valido. Usa uno de: ${ESTADOS_EVENTO.join(", ")}.`);
  }

  return prisma.$transaction(async (tx) => {
    const evento = await tx.evento.findUnique({ where: { id }, include: CONTEO_INSCRITOS });
    if (!evento) {
      throw new AppError(404, "El evento no existe.");
    }
    if (evento.estado === nuevoEstado) {
      return evento;
    }
    if (evento.estado === "Cancelado") {
      throw new AppError(409, "Un evento cancelado no se puede reactivar. Crea uno nuevo.");
    }

    const actualizado = await tx.evento.update({
      where: { id },
      data: { estado: nuevoEstado },
      include: CONTEO_INSCRITOS,
    });
    await tx.historialEstado.create({
      data: { eventoId: id, estadoAnterior: evento.estado, estadoNuevo: nuevoEstado, usuarioId: adminId },
    });
    return actualizado;
  });
}

// RF-009, flujo alternativo: si el evento tiene inscripciones activas se
// exige confirmacion explicita (confirmar=true) antes de eliminarlo junto
// con sus inscripciones, asistencias e historial.
async function eliminarEvento(id, confirmar) {
  const evento = await obtenerEventoOFallar(id);
  const inscritos = inscritosConfirmados(evento);
  if (inscritos > 0 && !confirmar) {
    throw new AppError(
      409,
      `Este evento tiene ${inscritos} inscripciones activas. Confirma para eliminarlo de todas formas.`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.asistenciaEvento.deleteMany({ where: { inscripcion: { eventoId: id } } });
    await tx.inscripcion.deleteMany({ where: { eventoId: id } });
    await tx.historialEstado.deleteMany({ where: { eventoId: id } });
    await tx.evento.delete({ where: { id } });
  });
  return { id, eliminado: true };
}

// RF-011, flujo principal paso 2: lista de estudiantes inscritos con su asistencia.
async function listarInscritosEvento(eventoId) {
  const evento = await obtenerEventoOFallar(eventoId);
  const inscripciones = await prisma.inscripcion.findMany({
    where: { eventoId, estado: "Confirmada" },
    include: { usuario: true, asistencia: true },
    orderBy: { fechaInscripcion: "asc" },
  });
  return { evento, inscripciones };
}

// RF-011 / RN-010: la asistencia solo se registra sobre estudiantes que
// aparecen como inscritos (inscripcion Confirmada de ese mismo evento). Se
// permite corregir un registro previo (upsert) para no bloquear al
// administrador si se equivoca al marcar.
async function registrarAsistenciaEvento(adminId, { eventoId, inscripcionId, asistio }) {
  if (typeof asistio !== "boolean") {
    throw new AppError(400, "El campo asistio debe ser true o false.");
  }

  const evento = await obtenerEventoOFallar(eventoId);
  if (["Borrador", "Cancelado"].includes(evento.estado)) {
    throw new AppError(409, "Solo se registra asistencia en eventos publicados o cerrados.");
  }

  const inscripcion = await prisma.inscripcion.findUnique({ where: { id: inscripcionId } });
  if (!inscripcion || inscripcion.eventoId !== eventoId) {
    throw new AppError(404, "El estudiante no aparece inscrito en este evento.");
  }
  if (inscripcion.estado !== "Confirmada") {
    throw new AppError(409, "La inscripcion fue cancelada: no se puede registrar asistencia.");
  }

  const asistencia = await prisma.asistenciaEvento.upsert({
    where: { inscripcionId },
    create: { inscripcionId, asistio, registradoPorId: adminId },
    update: { asistio, registradoPorId: adminId, fechaRegistro: new Date() },
  });
  return { ...inscripcion, asistencia };
}

// ---------------------------------------------------------------------------
// Estudiante (RF-010, RN-006, RN-007)
// ---------------------------------------------------------------------------

function inscripcionAbierta(evento) {
  return evento.estado === "Publicado" && evento.fechaLimiteInscripcion >= hoyUTC();
}

function serializarEventoEstudiante(evento, miInscripcion) {
  const inscritos = inscritosConfirmados(evento);
  return {
    ...evento,
    inscritos,
    cuposDisponibles: Math.max(evento.cupos - inscritos, 0),
    inscripcionAbierta: inscripcionAbierta(evento),
    miInscripcion: miInscripcion
      ? { id: miInscripcion.id, estado: miInscripcion.estado, fechaInscripcion: miInscripcion.fechaInscripcion }
      : null,
  };
}

// RF-010, pasos 1-2: eventos publicados de hoy en adelante.
async function listarEventosPublicados(usuarioId) {
  const [eventos, misInscripciones] = await Promise.all([
    prisma.evento.findMany({
      where: { estado: "Publicado", fecha: { gte: hoyUTC() } },
      include: CONTEO_INSCRITOS,
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.inscripcion.findMany({ where: { usuarioId } }),
  ]);

  return eventos.map((evento) =>
    serializarEventoEstudiante(
      evento,
      misInscripciones.find((i) => i.eventoId === evento.id)
    )
  );
}

// RF-010, pasos 3-4: detalle de un evento publicado.
async function obtenerEventoPublicado(id, usuarioId) {
  const evento = await prisma.evento.findUnique({ where: { id }, include: CONTEO_INSCRITOS });
  if (!evento || evento.estado !== "Publicado") {
    throw new AppError(404, "El evento no existe o no esta publicado.");
  }
  const miInscripcion = await prisma.inscripcion.findUnique({
    where: { usuarioId_eventoId: { usuarioId, eventoId: id } },
  });
  return serializarEventoEstudiante(evento, miInscripcion);
}

// RF-010, pasos 5-6: inscripcion con verificacion de cupo. Todo ocurre en una
// transaccion serializable para que dos estudiantes que se inscriben al mismo
// tiempo no superen los cupos (RN-007). RN-006: no se duplica la inscripcion;
// si el estudiante la habia cancelado, se reactiva.
async function inscribirseEnEvento(usuarioId, eventoId) {
  try {
    return await registrarInscripcion(usuarioId, eventoId);
  } catch (err) {
    // P2034: PostgreSQL aborto la transaccion por un conflicto con otra
    // inscripcion simultanea. Se informa para que el estudiante reintente.
    if (err?.code === "P2034") {
      throw new AppError(409, "Muchas personas se estan inscribiendo al mismo tiempo. Intenta de nuevo.");
    }
    throw err;
  }
}

async function registrarInscripcion(usuarioId, eventoId) {
  return prisma.$transaction(
    async (tx) => {
      const evento = await tx.evento.findUnique({ where: { id: eventoId }, include: CONTEO_INSCRITOS });
      if (!evento || evento.estado !== "Publicado") {
        throw new AppError(404, "El evento no existe o no esta publicado.");
      }
      if (evento.fechaLimiteInscripcion < hoyUTC()) {
        throw new AppError(409, "Las inscripciones para este evento ya cerraron.");
      }

      const existente = await tx.inscripcion.findUnique({
        where: { usuarioId_eventoId: { usuarioId, eventoId } },
      });
      if (existente?.estado === "Confirmada") {
        throw new AppError(409, "Ya estas inscrito en este evento.");
      }

      const inscritos = await tx.inscripcion.count({ where: { eventoId, estado: "Confirmada" } });
      if (inscritos >= evento.cupos) {
        throw new AppError(409, "No quedan cupos disponibles para este evento.");
      }

      if (existente) {
        return tx.inscripcion.update({
          where: { id: existente.id },
          data: { estado: "Confirmada", fechaInscripcion: new Date() },
          include: { evento: true },
        });
      }
      return tx.inscripcion.create({
        data: { usuarioId, eventoId, estado: "Confirmada" },
        include: { evento: true },
      });
    },
    { isolationLevel: "Serializable" }
  );
}

// El estudiante cancela su inscripcion y libera el cupo, siempre que todavia
// no se haya registrado su asistencia.
async function cancelarInscripcion(usuarioId, eventoId) {
  const inscripcion = await prisma.inscripcion.findUnique({
    where: { usuarioId_eventoId: { usuarioId, eventoId } },
    include: { asistencia: true },
  });
  if (!inscripcion || inscripcion.estado !== "Confirmada") {
    throw new AppError(404, "No tienes una inscripcion activa en este evento.");
  }
  if (inscripcion.asistencia) {
    throw new AppError(409, "Ya se registro tu asistencia: la inscripcion no se puede cancelar.");
  }
  return prisma.inscripcion.update({
    where: { id: inscripcion.id },
    data: { estado: "Cancelada" },
    include: { evento: true },
  });
}

// Inscripciones propias del estudiante, con el evento y la asistencia.
async function listarMisInscripciones(usuarioId) {
  return prisma.inscripcion.findMany({
    where: { usuarioId },
    include: { evento: true, asistencia: true },
    orderBy: { fechaInscripcion: "desc" },
  });
}

module.exports = {
  crearEvento,
  listarEventosAdmin,
  actualizarEvento,
  cambiarEstadoEvento,
  eliminarEvento,
  listarInscritosEvento,
  registrarAsistenciaEvento,
  listarEventosPublicados,
  obtenerEventoPublicado,
  inscribirseEnEvento,
  cancelarInscripcion,
  listarMisInscripciones,
  obtenerEventoOFallar,
};
