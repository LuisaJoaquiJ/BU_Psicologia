const crypto = require("crypto");
const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const { estaEnVentana, exigirVentana, resumenVentana } = require("../utils/ventanaAsistencia");

const VIGENCIA_CODIGO_MS = 2 * 60 * 1000;

class ControlAsistenciaService {
  nuevoCodigo() {
    return crypto.randomBytes(16).toString("hex");
  }

  async exigirEvento(id) {
    const evento = await prisma.evento.findUnique({ where: { id } });
    if (!evento) throw new AppError(404, "El evento no existe.");
    return evento;
  }

  // Estado del control y lista de inscritos con su asistencia (para el personal).
  async obtener(eventoId) {
    const evento = await this.exigirEvento(eventoId);
    const ventana = resumenVentana(evento);
    const control = await prisma.controlAsistenciaEvento.findUnique({ where: { eventoId } });
    // Fuera de [inicio, fin + 30 min] el QR no se muestra aunque quedara abierto.
    const abierta = Boolean(control?.abierta) && ventana.estado === "abierta";
    const inscritos = await prisma.inscripcion.findMany({
      where: { eventoId, estado: "Confirmada" },
      include: {
        usuario: { select: { nombre: true, emailInstitucional: true } },
        asistencia: true,
      },
      orderBy: { usuario: { nombre: "asc" } },
    });
    return {
      abierta,
      codigo: abierta ? control.codigo : null,
      codigoExpira: abierta ? control.codigoExpira : null,
      ventana,
      inscritos: inscritos.map((i) => ({
        inscripcionId: i.id,
        nombre: i.usuario.nombre,
        correo: i.usuario.emailInstitucional,
        asistio: i.asistencia?.asistio ?? null,
      })),
    };
  }
  // Consulta del QR para un estudiante inscrito.
async obtenerParaEstudiante(eventoId, usuarioId) {
  const evento = await this.exigirEvento(eventoId);
  const ventana = resumenVentana(evento);

  const inscripcion = await prisma.inscripcion.findUnique({
    where: {
      usuarioId_eventoId: {
        usuarioId,
        eventoId,
      },
    },
  });

  if (!inscripcion || inscripcion.estado !== "Confirmada") {
    throw new AppError(403, "No estás inscrito en este evento.");
  }

  const control = await prisma.controlAsistenciaEvento.findUnique({
    where: { eventoId },
  });

  const abierta = Boolean(control?.abierta) && ventana.estado === "abierta";
  return {
    abierta,
    codigo: abierta ? control.codigo : null,
    codigoExpira: abierta ? control.codigoExpira : null,
    ventana,
  };
}

  // Interruptor del personal. Abrir solo si el evento está Publicado o Cerrado.
  async cambiarAbierta(eventoId, abierta, usuarioNombre) {
    const evento = await this.exigirEvento(eventoId);
    if (abierta && !["Publicado", "Cerrado"].includes(evento.estado)) {
      throw new AppError(409, "Solo se puede abrir la asistencia de un evento publicado.");
    }
    // Solo se abre durante el evento y hasta 30 min despues de su fin.
    if (abierta) exigirVentana(evento);
    const datos = abierta
      ? {
          abierta: true,
          codigo: this.nuevoCodigo(),
          codigoExpira: new Date(Date.now() + VIGENCIA_CODIGO_MS),
          fechaApertura: new Date(),
          actualizadoPor: usuarioNombre,
        }
      : { abierta: false, codigo: null, codigoExpira: null, actualizadoPor: usuarioNombre };

    await prisma.controlAsistenciaEvento.upsert({
      where: { eventoId },
      create: { eventoId, ...datos },
      update: datos,
    });
    return this.obtener(eventoId);
  }

  // Rota el código mientras la asistencia está abierta.
  async rotarCodigo(eventoId) {
    const evento = await this.exigirEvento(eventoId);
    const control = await prisma.controlAsistenciaEvento.findUnique({ where: { eventoId } });
    if (!control?.abierta) throw new AppError(409, "La asistencia está cerrada.");
    // Vencida la ventana se cierra sola. Se conserva el código para que quien
    // escanee un QR viejo reciba el mensaje de tiempo expirado.
    if (!estaEnVentana(evento)) {
      await prisma.controlAsistenciaEvento.update({ where: { eventoId }, data: { abierta: false } });
      exigirVentana(evento);
    }
    await prisma.controlAsistenciaEvento.update({
      where: { eventoId },
      data: { codigo: this.nuevoCodigo(), codigoExpira: new Date(Date.now() + VIGENCIA_CODIGO_MS) },
    });
    return this.obtener(eventoId);
  }

  // Lo llama el estudiante al escanear. Valida y registra una sola vez.
  async registrarEscaneo(usuarioId, codigo) {
    const control = codigo ? await prisma.controlAsistenciaEvento.findFirst({ where: { codigo } }) : null;
    if (!control) throw new AppError(409, "La asistencia está cerrada o el código no es válido.");

    const evento = await prisma.evento.findUnique({ where: { id: control.eventoId } });
    if (!evento || evento.estado === "Cancelado") throw new AppError(409, "El evento no está disponible.");

    // Solo entre el inicio del evento y 30 min después de su fin.
    exigirVentana(evento);
    if (!control.abierta) throw new AppError(409, "La asistencia está cerrada o el código no es válido.");
    if (control.codigoExpira < new Date()) throw new AppError(409, "El código venció. Escanea el QR actual.");

    const inscripcion = await prisma.inscripcion.findUnique({
      where: { usuarioId_eventoId: { usuarioId, eventoId: evento.id } },
      include: { asistencia: true },
    });
    if (!inscripcion || inscripcion.estado !== "Confirmada") {
      throw new AppError(403, "No estás inscrito en este evento. Inscríbete antes de asistir.");
    }
    if (inscripcion.asistencia?.asistio) {
      return { evento: evento.nombre, yaRegistrada: true };
    }

    await prisma.asistenciaEvento.upsert({
      where: { inscripcionId: inscripcion.id },
      create: { inscripcionId: inscripcion.id, asistio: true, registradoPorId: usuarioId },
      update: { asistio: true, registradoPorId: usuarioId, fechaRegistro: new Date() },
    });
    return { evento: evento.nombre, yaRegistrada: false };
  }
}


module.exports = { ControlAsistenciaService, controlAsistenciaService: new ControlAsistenciaService() };