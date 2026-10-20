const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { imagenEventoService } = require("./ImagenEventoService");
const { inscritosConfirmados, exigirEstadoValido, normalizarEvento } = require("../utils/eventos");

// Gestion de eventos y talleres por el personal (RF-009 / RF-011, RN-008).
class EventoService {
  constructor(r = repos, imagenes = imagenEventoService) {
    this.repos = r;
    this.imagenes = imagenes;
  }

  async obtener(id) {
    const evento = await this.repos.eventos.conConteo(id);
    if (!evento) throw new AppError(404, "El evento no existe.");
    return evento;
  }

  // Nuevo evento: Borrador (para revisarlo) o Publicado.
  async crear(datos) {
    const estado = datos.estado || "Borrador";
    if (!["Borrador", "Publicado"].includes(estado)) throw new AppError(400, "Un evento nuevo solo puede crearse como Borrador o Publicado.");
    return this.imagenes.conUrl(await this.repos.eventos.crearConConteo({ ...normalizarEvento(datos), estado }));
  }

  async listar({ estado } = {}) {
    const where = {};
    if (estado) {
      exigirEstadoValido(estado);
      where.estado = estado;
    }
    return (await this.repos.eventos.listarConConteo(where)).map(this.imagenes.conUrl);
  }

  // RN-007: no se puede dejar menos cupos que estudiantes inscritos.
  async actualizar(id, cambios) {
    const actual = await this.obtener(id);
    if (actual.estado === "Cancelado") throw new AppError(409, "El evento esta cancelado y ya no se puede editar.");
    const data = normalizarEvento(cambios, actual);
    const inscritos = inscritosConfirmados(actual);
    if (data.cupos < inscritos) {
      throw new AppError(409, `El evento ya tiene ${inscritos} inscritos: los cupos no pueden ser menores a esa cantidad.`);
    }
    return this.imagenes.conUrl(await this.repos.eventos.actualizarConConteo(id, data));
  }

  // Publica, cierra, cancela o devuelve a borrador, con historial del cambio.
  cambiarEstado(adminId, id, nuevoEstado) {
    exigirEstadoValido(nuevoEstado);
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const evento = await r.eventos.conConteo(id);
      if (!evento) throw new AppError(404, "El evento no existe.");
      if (evento.estado === nuevoEstado) return evento;
      if (evento.estado === "Cancelado") throw new AppError(409, "Un evento cancelado no se puede reactivar. Crea uno nuevo.");
      const actualizado = await r.eventos.actualizarConConteo(id, { estado: nuevoEstado });
      await r.historial.crear({ eventoId: id, estadoAnterior: evento.estado, estadoNuevo: nuevoEstado, usuarioId: adminId });
      return actualizado;
    });
  }

  // Con inscripciones activas exige confirmar; borra inscripciones,
  // asistencias, historial y la foto.
  async eliminar(id, confirmar) {
    const evento = await this.obtener(id);
    const inscritos = inscritosConfirmados(evento);
    if (inscritos > 0 && !confirmar) {
      throw new AppError(409, `Este evento tiene ${inscritos} inscripciones activas. Confirma para eliminarlo de todas formas.`);
    }
    await prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      await r.asistenciasEvento.eliminarDeEvento(id);
      await r.inscripciones.eliminarDeEvento(id);
      await r.historial.eliminarDeEvento(id);
      await r.eventos.eliminar(id);
    });
    if (evento.imagen) this.imagenes.borrar(evento.imagen);
    return { id, eliminado: true };
  }

  // RF-011: inscritos con su asistencia.
  async inscritos(eventoId) {
    const evento = await this.obtener(eventoId);
    return { evento, inscripciones: await this.repos.inscripciones.confirmadasConAsistencia(eventoId) };
  }

  // RN-010: solo sobre inscritos confirmados; se puede corregir (upsert).
  async registrarAsistencia(adminId, { eventoId, inscripcionId, asistio }) {
    if (typeof asistio !== "boolean") throw new AppError(400, "El campo asistio debe ser true o false.");
    const evento = await this.obtener(eventoId);
    if (["Borrador", "Cancelado"].includes(evento.estado)) throw new AppError(409, "Solo se registra asistencia en eventos publicados o cerrados.");
    const inscripcion = await this.repos.inscripciones.buscarPorId(inscripcionId);
    if (!inscripcion || inscripcion.eventoId !== eventoId) throw new AppError(404, "El estudiante no aparece inscrito en este evento.");
    if (inscripcion.estado !== "Confirmada") throw new AppError(409, "La inscripcion fue cancelada: no se puede registrar asistencia.");
    const asistencia = await this.repos.asistenciasEvento.registrar(inscripcionId, asistio, adminId);
    return { ...inscripcion, asistencia };
  }
}

module.exports = { EventoService, eventoService: new EventoService() };
