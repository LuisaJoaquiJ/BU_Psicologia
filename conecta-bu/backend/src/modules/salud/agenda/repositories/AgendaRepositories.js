const { BaseRepository } = require("./BaseRepository");

// Tablas de la agenda de citas de Salud integral (servicios_salud,
// horarios_salud, citas_salud, asistencias_cita_salud y
// bloqueos_salud). Las consultas con nombre viven aqui.

const CON_SERVICIO = { servicio: true };
const CITA_COMPLETA = { usuario: true, horario: { include: CON_SERVICIO } };
const CITA_CON_HORARIO = { horario: { include: CON_SERVICIO } };

class ServicioRepository extends BaseRepository {
  constructor(db) {
    super("servicioSalud", db);
  }
  activos() {
    return this.tabla.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });
  }
}

class HorarioRepository extends BaseRepository {
  constructor(db) {
    super("horarioSalud", db);
  }
  conServicio(id) {
    return this.tabla.findUnique({ where: { id }, include: CON_SERVICIO });
  }
  buscar(where, orden = [{ fecha: "asc" }, { horaInicio: "asc" }]) {
    return this.tabla.findMany({ where, include: CON_SERVICIO, orderBy: orden });
  }
  delServicioEnFecha(servicioId, fecha) {
    return this.tabla.findMany({ where: { servicioId, fecha } });
  }
  entreFechas(desde, hasta) {
    return this.tabla.findMany({ where: { fecha: { gte: desde, lte: hasta } }, include: CON_SERVICIO });
  }
  // Marca ocupado solo si sigue libre (evita la doble reserva, RN-003).
  ocuparSiLibre(id) {
    return this.tabla.updateMany({ where: { id, ocupado: false }, data: { ocupado: true } });
  }
  crearConServicio(data) {
    return this.tabla.create({ data, include: CON_SERVICIO });
  }
  actualizarConServicio(id, data) {
    return this.tabla.update({ where: { id }, data, include: CON_SERVICIO });
  }
}

class CitaRepository extends BaseRepository {
  constructor(db) {
    super("citaSalud", db);
  }
  agendadaDelHorario(horarioId, include) {
    return this.tabla.findFirst({ where: { horarioId, estado: "Agendada" }, ...(include ? { include } : {}) });
  }
  activasDeUsuario(usuarioId) {
    return this.tabla.findMany({ where: { usuarioId, estado: "Agendada" }, include: CITA_CON_HORARIO });
  }
  deUsuario(usuarioId) {
    return this.tabla.findMany({ where: { usuarioId }, include: CITA_CON_HORARIO, orderBy: { horario: { fecha: "desc" } } });
  }
  completa(id) {
    return this.tabla.findUnique({ where: { id }, include: CITA_COMPLETA });
  }
  agenda(where) {
    return this.tabla.findMany({
      where,
      include: CITA_COMPLETA,
      orderBy: [{ horario: { fecha: "asc" } }, { horario: { horaInicio: "asc" } }],
    });
  }
  crearConHorario(data) {
    return this.tabla.create({ data, include: CITA_CON_HORARIO });
  }
  cambiarEstado(id, estado, include = CITA_COMPLETA) {
    return this.tabla.update({ where: { id }, data: { estado }, include });
  }
}

class AsistenciaCitaRepository extends BaseRepository {
  constructor(db) {
    super("asistenciaCitaSalud", db);
  }
  deCita(citaId) {
    return this.tabla.findUnique({ where: { citaId } });
  }
}

class BloqueoRepository extends BaseRepository {
  constructor(db) {
    super("bloqueoSalud", db);
  }
  // Bloqueos que se cruzan con el rango [desde, hasta] (ambos opcionales).
  entre(desde, hasta) {
    const where = {};
    if (hasta) where.fechaInicio = { lte: hasta };
    if (desde) where.fechaFin = { gte: desde };
    return this.tabla.findMany({ where, orderBy: [{ fechaInicio: "asc" }] });
  }
}

class UsuarioRepository extends BaseRepository {
  constructor(db) {
    super("usuario", db);
  }
  buscarEstudiantes(termino) {
    return this.tabla.findMany({
      where: {
        rol: { nombre: "Estudiante" },
        OR: [{ nombre: { contains: termino, mode: "insensitive" } }, { emailInstitucional: { contains: termino, mode: "insensitive" } }],
      },
      orderBy: { nombre: "asc" },
      take: 8,
    });
  }
  porCorreo(emailInstitucional) {
    return this.tabla.findUnique({ where: { emailInstitucional } });
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

module.exports = {
  ServicioRepository,
  HorarioRepository,
  CitaRepository,
  AsistenciaCitaRepository,
  BloqueoRepository,
  UsuarioRepository,
  RolRepository,
};
