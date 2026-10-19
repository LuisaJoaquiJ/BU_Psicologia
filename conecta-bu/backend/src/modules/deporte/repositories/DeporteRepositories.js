const { BaseRepository } = require("./BaseRepository");

// Repositorios de las tablas de Deporte: lo que no es CRUD basico vive aqui
// como metodo con nombre (asi los servicios no arman consultas a mano).

class ConfigRepository extends BaseRepository {
  constructor(db) {
    super("configDeporte", db);
  }
}

class DisciplinaRepository extends BaseRepository {
  constructor(db) {
    super("disciplinaDeportiva", db);
  }
  listarOrdenadas({ soloActivas = false } = {}) {
    return this.listar(soloActivas ? { activa: true } : {}, { nombre: "asc" });
  }
}

class GrupoRepository extends BaseRepository {
  constructor(db) {
    super("grupoDeporte", db);
  }
  delPeriodo(periodo, filtro = {}) {
    return this.listar({ periodo, ...filtro }, { nombre: "asc" });
  }
}

class InscripcionRepository extends BaseRepository {
  constructor(db) {
    super("inscripcionDeporte", db);
  }
  activasDeGrupos(grupoIds) {
    return grupoIds.length ? this.listar({ grupoId: { in: grupoIds }, estado: "Activa" }) : [];
  }
  activasDeUsuario(usuarioId) {
    return this.listar({ usuarioId, estado: "Activa" });
  }
  contarActivas(grupoId) {
    return this.contar({ grupoId, estado: "Activa" });
  }
}

class SesionRepository extends BaseRepository {
  constructor(db) {
    super("sesionDeporte", db);
  }
  deGrupos(grupoIds, orderBy) {
    return grupoIds.length ? this.listar({ grupoId: { in: grupoIds } }, orderBy) : [];
  }
}

class AsistenciaRepository extends BaseRepository {
  constructor(db) {
    super("asistenciaDeporte", db);
  }
  deSesiones(sesionIds, filtro = {}) {
    return sesionIds.length ? this.listar({ sesionId: { in: sesionIds }, ...filtro }) : [];
  }
  eliminarDeSesion(sesionId) {
    return this.tabla.deleteMany({ where: { sesionId } });
  }
}

class HoraManualRepository extends BaseRepository {
  constructor(db) {
    super("horaDeporteManual", db);
  }
}

class DocenteRepository extends BaseRepository {
  constructor(db) {
    super("docenteDeporte", db);
  }
  porEmail(email) {
    return this.tabla.findUnique({ where: { email } });
  }
}

class EventoRepository extends BaseRepository {
  constructor(db) {
    super("eventoDeporte", db);
  }
}

class InscripcionEventoRepository extends BaseRepository {
  constructor(db) {
    super("inscripcionEventoDeporte", db);
  }
  activasDeEventos(eventoIds) {
    return eventoIds.length ? this.listar({ eventoId: { in: eventoIds }, estado: "Activa" }) : [];
  }
}

class AlertaRepository extends BaseRepository {
  constructor(db) {
    super("alertaDeporte", db);
  }
}

class ImplementoRepository extends BaseRepository {
  constructor(db) {
    super("implementoDeporte", db);
  }
}

class PrestamoRepository extends BaseRepository {
  constructor(db) {
    super("prestamoImplemento", db);
  }
  activos(implementoIds) {
    return this.listar({ fechaDevolucion: null, ...(implementoIds ? { implementoId: { in: implementoIds } } : {}) });
  }
}

class MovimientoRepository extends BaseRepository {
  constructor(db) {
    super("movimientoInventario", db);
  }
}

class UsuarioRepository extends BaseRepository {
  constructor(db) {
    super("usuario", db);
  }
  // Busqueda sin distinguir mayusculas (los correos se guardan como llegan de Google).
  porEmail(email, include) {
    return this.tabla.findFirst({ where: { emailInstitucional: { equals: email, mode: "insensitive" } }, ...(include ? { include } : {}) });
  }
  buscarTexto(q) {
    return this.tabla.findMany({
      where: { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { emailInstitucional: { contains: q, mode: "insensitive" } }] },
      include: { rol: true },
    });
  }
}

class RolRepository extends BaseRepository {
  constructor(db) {
    super("rol", db);
  }
  porNombre(nombre) {
    return this.tabla.findUnique({ where: { nombre } });
  }
}

class AccesoRepository extends BaseRepository {
  constructor(db) {
    super("accesoModulo", db);
  }
}

module.exports = {
  ConfigRepository,
  DisciplinaRepository,
  GrupoRepository,
  InscripcionRepository,
  SesionRepository,
  AsistenciaRepository,
  HoraManualRepository,
  DocenteRepository,
  EventoRepository,
  InscripcionEventoRepository,
  AlertaRepository,
  ImplementoRepository,
  PrestamoRepository,
  MovimientoRepository,
  UsuarioRepository,
  RolRepository,
  AccesoRepository,
};
