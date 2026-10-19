const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const { hoyUTC } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { imagenEventoService } = require("./ImagenEventoService");
const { inscritosConfirmados, inscripcionAbierta, sinEnlaceSiNoInscrito } = require("../utils/eventos");

// Eventos para el estudiante y la agenda publica (RF-010, RN-006, RN-007).
class EventoEstudianteService {
  constructor(r = repos, imagenes = imagenEventoService) {
    this.repos = r;
    this.imagenes = imagenes;
  }

  serializar(evento, miInscripcion) {
    const inscritos = inscritosConfirmados(evento);
    return {
      ...sinEnlaceSiNoInscrito(evento, miInscripcion),
      imagenUrl: this.imagenes.url(evento),
      inscritos,
      cuposDisponibles: Math.max(evento.cupos - inscritos, 0),
      inscripcionAbierta: inscripcionAbierta(evento),
      miInscripcion: miInscripcion ? { id: miInscripcion.id, estado: miInscripcion.estado, fechaInscripcion: miInscripcion.fechaInscripcion } : null,
    };
  }

  proximos() {
    return this.repos.eventos.listarConConteo({ estado: "Publicado", fecha: { gte: hoyUTC() } });
  }

  // Eventos publicados de hoy en adelante, con la inscripcion propia.
  async publicados(usuarioId) {
    const [eventos, mias] = await Promise.all([this.proximos(), this.repos.inscripciones.deUsuario(usuarioId)]);
    return eventos.map((e) => this.serializar(e, mias.find((i) => i.eventoId === e.id)));
  }

  // Agenda publica (sin sesion): solo datos de difusion, nunca los inscritos.
  async publicos(limite = 6) {
    const eventos = await this.proximos();
    return eventos.slice(0, limite).map((e) => ({
      id: e.id,
      nombre: e.nombre,
      descripcion: e.descripcion,
      lugar: e.lugar,
      modalidad: e.modalidad || "Presencial",
      fecha: e.fecha,
      horaInicio: e.horaInicio,
      horaFin: e.horaFin,
      cupos: e.cupos,
      cuposDisponibles: Math.max(e.cupos - inscritosConfirmados(e), 0),
      imagenUrl: this.imagenes.url(e),
    }));
  }

  async detalle(id, usuarioId) {
    const evento = await this.repos.eventos.conConteo(id);
    if (!evento || evento.estado !== "Publicado") throw new AppError(404, "El evento no existe o no esta publicado.");
    return this.serializar(evento, await this.repos.inscripciones.deUsuarioEnEvento(usuarioId, id));
  }

  // Inscripcion serializable para no superar los cupos con solicitudes
  // simultaneas (RN-007). Si la habia cancelado, se reactiva (RN-006).
  async inscribirse(usuarioId, eventoId) {
    try {
      return await prisma.$transaction((tx) => this.registrar(reposCon(tx), usuarioId, eventoId), { isolationLevel: "Serializable" });
    } catch (err) {
      // P2034: conflicto con otra inscripcion simultanea.
      if (err?.code === "P2034") throw new AppError(409, "Muchas personas se estan inscribiendo al mismo tiempo. Intenta de nuevo.");
      throw err;
    }
  }

  async registrar(r, usuarioId, eventoId) {
    const evento = await r.eventos.conConteo(eventoId);
    if (!evento || evento.estado !== "Publicado") throw new AppError(404, "El evento no existe o no esta publicado.");
    if (evento.fechaLimiteInscripcion < hoyUTC()) throw new AppError(409, "Las inscripciones para este evento ya cerraron.");
    const existente = await r.inscripciones.deUsuarioEnEvento(usuarioId, eventoId);
    if (existente?.estado === "Confirmada") throw new AppError(409, "Ya estas inscrito en este evento.");
    if ((await r.inscripciones.contarConfirmadas(eventoId)) >= evento.cupos) throw new AppError(409, "No quedan cupos disponibles para este evento.");
    if (existente) return r.inscripciones.actualizarConEvento(existente.id, { estado: "Confirmada", fechaInscripcion: new Date() });
    return r.inscripciones.crearConEvento({ usuarioId, eventoId, estado: "Confirmada" });
  }

  // Cancela y libera el cupo, si aun no se registro su asistencia.
  async cancelar(usuarioId, eventoId) {
    const inscripcion = await this.repos.inscripciones.deUsuarioEnEvento(usuarioId, eventoId, { asistencia: true });
    if (!inscripcion || inscripcion.estado !== "Confirmada") throw new AppError(404, "No tienes una inscripcion activa en este evento.");
    if (inscripcion.asistencia) throw new AppError(409, "Ya se registro tu asistencia: la inscripcion no se puede cancelar.");
    return this.repos.inscripciones.actualizarConEvento(inscripcion.id, { estado: "Cancelada" });
  }

  async mias(usuarioId) {
    const inscripciones = await this.repos.inscripciones.deUsuario(usuarioId, { evento: true, asistencia: true });
    return inscripciones.map((i) => (i.evento ? { ...i, evento: sinEnlaceSiNoInscrito(i.evento, i) } : i));
  }
}

module.exports = { EventoEstudianteService, eventoEstudianteService: new EventoEstudianteService() };
