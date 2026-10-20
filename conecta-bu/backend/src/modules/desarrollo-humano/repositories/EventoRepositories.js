const { BaseRepository } = require("./BaseRepository");

// Tablas de los eventos y talleres de Desarrollo Humano (eventos,
// inscripciones, asistencias_evento e historial_estados).

// Cuenta solo las inscripciones vigentes (las canceladas liberan el cupo).
const CONTEO_INSCRITOS = { _count: { select: { inscripciones: { where: { estado: "Confirmada" } } } } };
const ORDEN = [{ fecha: "asc" }, { horaInicio: "asc" }];

class EventoRepository extends BaseRepository {
  constructor(db) {
    super("evento", db);
  }
  conConteo(id) {
    return this.tabla.findUnique({ where: { id }, include: CONTEO_INSCRITOS });
  }
  listarConConteo(where = {}) {
    return this.tabla.findMany({ where, include: CONTEO_INSCRITOS, orderBy: ORDEN });
  }
  crearConConteo(data) {
    return this.tabla.create({ data, include: CONTEO_INSCRITOS });
  }
  actualizarConConteo(id, data) {
    return this.tabla.update({ where: { id }, data, include: CONTEO_INSCRITOS });
  }
}

class InscripcionRepository extends BaseRepository {
  constructor(db) {
    super("inscripcion", db);
  }
  deUsuarioEnEvento(usuarioId, eventoId, include) {
    return this.tabla.findUnique({ where: { usuarioId_eventoId: { usuarioId, eventoId } }, ...(include ? { include } : {}) });
  }
  confirmadasConAsistencia(eventoId) {
    return this.tabla.findMany({ where: { eventoId, estado: "Confirmada" }, include: { usuario: true, asistencia: true }, orderBy: { fechaInscripcion: "asc" } });
  }
  deUsuario(usuarioId, include) {
    return this.tabla.findMany({ where: { usuarioId }, ...(include ? { include, orderBy: { fechaInscripcion: "desc" } } : {}) });
  }
  contarConfirmadas(eventoId) {
    return this.tabla.count({ where: { eventoId, estado: "Confirmada" } });
  }
  crearConEvento(data) {
    return this.tabla.create({ data, include: { evento: true } });
  }
  actualizarConEvento(id, data) {
    return this.tabla.update({ where: { id }, data, include: { evento: true } });
  }
  eliminarDeEvento(eventoId) {
    return this.tabla.deleteMany({ where: { eventoId } });
  }
}

class AsistenciaEventoRepository extends BaseRepository {
  constructor(db) {
    super("asistenciaEvento", db);
  }
  registrar(inscripcionId, asistio, registradoPorId) {
    return this.tabla.upsert({
      where: { inscripcionId },
      create: { inscripcionId, asistio, registradoPorId },
      update: { asistio, registradoPorId, fechaRegistro: new Date() },
    });
  }
  eliminarDeEvento(eventoId) {
    return this.tabla.deleteMany({ where: { inscripcion: { eventoId } } });
  }
}

class HistorialRepository extends BaseRepository {
  constructor(db) {
    super("historialEstado", db);
  }
  eliminarDeEvento(eventoId) {
    return this.tabla.deleteMany({ where: { eventoId } });
  }
}

module.exports = { EventoRepository, InscripcionRepository, AsistenciaEventoRepository, HistorialRepository };
