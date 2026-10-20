const { BaseRepository } = require("./BaseRepository");

// Tablas del registro de la Unidad de Salud: personas atendidas,
// actividades, atenciones (asistencias) y evidencias.

const ATENCION_COMPLETA = { persona: true, actividad: true, registradoPor: { select: { nombre: true } } };
const RECIENTES = [{ fecha: "desc" }, { fechaRegistro: "desc" }];

class PersonaRepository extends BaseRepository {
  constructor(db) {
    super("personaSalud", db);
  }
  porIdentificador(id) {
    return this.tabla.findFirst({ where: { OR: [{ numeroDocumento: id }, { codigoEstudiantil: id }] } });
  }
  porCorreo(correo) {
    return this.tabla.findFirst({ where: { correo } });
  }
  porNombre(parte) {
    return this.tabla.findMany({
      where: { OR: [{ nombres: { contains: parte, mode: "insensitive" } }, { apellidos: { contains: parte, mode: "insensitive" } }] },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 50,
    });
  }
  documentoEmpiezaPor(prefijo) {
    return this.tabla.findMany({ where: { numeroDocumento: { startsWith: prefijo } }, orderBy: { numeroDocumento: "asc" }, take: 8 });
  }
  pagina(where, pagina, porPagina) {
    return this.tabla.findMany({ where, orderBy: [{ apellidos: "asc" }, { nombres: "asc" }], skip: (pagina - 1) * porPagina, take: porPagina });
  }
  porIds(ids) {
    return ids.length ? this.tabla.findMany({ where: { id: { in: ids } } }) : [];
  }
  porDocumentos(documentos) {
    return this.tabla.findMany({ where: { numeroDocumento: { in: documentos } } });
  }
  crearVarias(data) {
    return this.tabla.createMany({ data, skipDuplicates: true });
  }
  porCodigos(codigos) {
    return codigos.length ? this.tabla.findMany({ where: { codigoEstudiantil: { in: codigos } } }) : [];
  }
  estudiantesActivos() {
    return this.tabla.findMany({ where: { estudianteActivo: true }, orderBy: [{ apellidos: "asc" }, { nombres: "asc" }] });
  }
  // Quienes no vienen en la lista nueva dejan de figurar como activos.
  desactivarEstudiantesExcepto(documentos) {
    return this.tabla.updateMany({ where: { estudianteActivo: true, numeroDocumento: { notIn: documentos } }, data: { estudianteActivo: false } });
  }
  // Docentes y administrativos (sugerencias del formulario de reportes SST).
  docentesYAdministrativos(prefijoDocumento) {
    return this.tabla.findMany({
      where: { poblacion: { in: ["Docente", "Administrativo"] }, ...(prefijoDocumento ? { numeroDocumento: { startsWith: prefijoDocumento } } : {}) },
      select: { nombres: true, apellidos: true, tipoDocumento: true, numeroDocumento: true, poblacion: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 5000,
    });
  }
}

class ActividadRepository extends BaseRepository {
  constructor(db) {
    super("actividadSalud", db);
  }
  ordenadas(where) {
    return this.tabla.findMany({ where, orderBy: { codigo: "asc" } });
  }
  ultimaDelPeriodo(periodo) {
    return this.tabla.findFirst({ where: { periodo }, orderBy: { codigo: "desc" } });
  }
  periodos() {
    return this.tabla.findMany({ select: { periodo: true } });
  }
  deLosPeriodos(periodos) {
    return this.tabla.findMany({ where: { periodo: { in: periodos } } });
  }
  crearVarias(data) {
    return this.tabla.createMany({ data });
  }
  // Jornadas publicadas para los estudiantes que aun no terminan.
  publicadasDesde(hoy) {
    return this.tabla.findMany({ where: { publicada: true, activa: true, fechaFin: { gte: hoy } }, orderBy: [{ fechaInicio: "asc" }, { nombre: "asc" }] });
  }
}

class InscripcionActividadRepository extends BaseRepository {
  constructor(db) {
    super("inscripcionActividadSalud", db);
  }
  activasDe(ids) {
    return ids.length ? this.tabla.findMany({ where: { actividadId: { in: ids }, estado: "Inscrita" } }) : [];
  }
  deUsuario(usuarioId) {
    return this.tabla.findMany({ where: { usuarioId } });
  }
  deUsuarioEn(actividadId, usuarioId) {
    return this.tabla.findFirst({ where: { actividadId, usuarioId } });
  }
  deActividad(actividadId) {
    return this.tabla.findMany({ where: { actividadId }, orderBy: { fechaInscripcion: "asc" } });
  }
}

class AtencionRepository extends BaseRepository {
  constructor(db) {
    super("atencionSalud", db);
  }
  // Solo lo necesario para los indicadores de las actividades.
  resumenDeActividades(ids) {
    return this.tabla.findMany({ where: { actividadId: { in: ids } }, select: { actividadId: true, personaId: true, fecha: true } });
  }
  deActividad(actividadId) {
    return this.tabla.findMany({ where: { actividadId }, include: { persona: true, registradoPor: { select: { nombre: true } } }, orderBy: RECIENTES });
  }
  dePersona(personaId) {
    return this.tabla.findMany({ where: { personaId }, include: { actividad: true, registradoPor: { select: { nombre: true } } }, orderBy: RECIENTES, take: 100 });
  }
  participaciones(personaId) {
    return this.tabla.findMany({ where: { personaId }, include: { actividad: true }, orderBy: { fecha: "desc" }, take: 50 });
  }
  buscar(where, limite) {
    return this.tabla.findMany({ where, include: ATENCION_COMPLETA, orderBy: RECIENTES, take: limite });
  }
  crearCompleta(data) {
    return this.tabla.create({ data, include: ATENCION_COMPLETA });
  }
  actualizarCompleta(id, data) {
    return this.tabla.update({ where: { id }, data, include: ATENCION_COMPLETA });
  }
  entreFechas(desde, hasta) {
    return this.tabla.findMany({ where: { fecha: { gte: desde, lte: hasta } } });
  }
  ultimas(cuantas) {
    return this.tabla.findMany({ include: { persona: true, actividad: true }, orderBy: { fechaRegistro: "desc" }, take: cuantas });
  }
  // Registro general: con persona, actividad y quien registro, en orden.
  registro(where) {
    return this.tabla.findMany({ where, include: ATENCION_COMPLETA, orderBy: [{ fecha: "asc" }, { fechaRegistro: "asc" }] });
  }
  claves(personaIds) {
    return this.tabla.findMany({ where: { personaId: { in: personaIds } }, select: { personaId: true, actividadId: true, fecha: true } });
  }
  crearVarias(data) {
    return this.tabla.createMany({ data });
  }
}

class EvidenciaRepository extends BaseRepository {
  constructor(db) {
    super("evidenciaSalud", db);
  }
  deActividades(ids) {
    return this.tabla.findMany({ where: { actividadId: { in: ids } }, select: { actividadId: true } });
  }
  deActividad(actividadId) {
    return this.tabla.findMany({ where: { actividadId }, include: { subidoPor: { select: { nombre: true } } }, orderBy: { fechaSubida: "desc" } });
  }
  actividadesConEvidencia() {
    return this.tabla.findMany({ select: { actividadId: true } });
  }
}

module.exports = { PersonaRepository, ActividadRepository, InscripcionActividadRepository, AtencionRepository, EvidenciaRepository };
