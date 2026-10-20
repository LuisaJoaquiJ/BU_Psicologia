const { BaseRepository } = require("./BaseRepository");

// Salidas con inscripcion de estudiantes y sus inscripciones.

class SalidaRepository extends BaseRepository {
  constructor(db) {
    super("salidaConvocatoria", db);
  }
  porFecha(where = {}) {
    return this.tabla.findMany({ where, orderBy: [{ fechaSalida: "asc" }] });
  }
}

class InscripcionSalidaRepository extends BaseRepository {
  constructor(db) {
    super("inscripcionSalida", db);
  }
  deSalidas(ids) {
    return ids.length ? this.tabla.findMany({ where: { salidaId: { in: ids } } }) : [];
  }
  deSalida(salidaId, orderBy) {
    return this.tabla.findMany({ where: { salidaId }, orderBy });
  }
  deUsuario(usuarioId) {
    return this.listar({ usuarioId });
  }
  deUsuarioEnSalida(salidaId, usuarioId) {
    return this.buscarUno({ salidaId, usuarioId });
  }
}

module.exports = { SalidaRepository, InscripcionSalidaRepository };
