const { prisma } = require("../../../config/prisma");

// Lectura de las tablas de todos los modulos para el tablero y el resumen
// del superadministrador. Solo consulta: nunca escribe en los modulos.
const CON_SERVICIO = { horario: { include: { servicio: true } } };

class LecturaRepository {
  constructor(db = prisma) {
    this.db = db;
  }

  // Citas de las dos agendas, marcadas con su modulo.
  async citas() {
    const [dh, salud] = await Promise.all([this.db.citaDesarrollo.findMany({ include: CON_SERVICIO }), this.db.citaSalud.findMany({ include: CON_SERVICIO })]);
    return [...dh.map((c) => ({ ...c, modulo: "desarrollo-humano" })), ...salud.map((c) => ({ ...c, modulo: "salud" }))];
  }

  async configDeporte() {
    return (await this.db.configDeporte.findUnique({ where: { id: 1 } })) || { horasRequeridas: 40 };
  }

  // Lo que se necesita de Deporte: grupos, inscripciones, sesiones y lo que
  // suma horas (asistencias, horas reconocidas y eventos con horas).
  async deporte() {
    const [config, disciplinas, grupos, inscripciones, sesiones, asistencias, manuales, inscEventos, eventos] = await Promise.all([
      this.configDeporte(),
      this.db.disciplinaDeportiva.findMany(),
      this.db.grupoDeporte.findMany(),
      this.db.inscripcionDeporte.findMany({ where: { estado: "Activa" } }),
      this.db.sesionDeporte.findMany(),
      this.db.asistenciaDeporte.findMany({ where: { presente: true } }),
      this.db.horaDeporteManual.findMany(),
      this.db.inscripcionEventoDeporte.findMany({ where: { estado: "Activa", asistio: true } }),
      this.db.eventoDeporte.findMany(),
    ]);
    return { config, disciplinas, grupos, inscripciones, sesiones, asistencias, manuales, inscEventos, eventos };
  }

  async tablero() {
    const [usuarios, citas, eventos, inscripciones, atenciones, actividades, reportes, deporte] = await Promise.all([
      this.db.usuario.findMany({ include: { rol: true } }),
      this.citas(),
      this.db.evento.findMany(),
      this.db.inscripcion.findMany({ include: { asistencia: true } }),
      this.db.atencionSalud.findMany(),
      this.db.actividadSalud.findMany(),
      this.db.reporteSST.findMany(),
      this.deporte(),
    ]);
    return { usuarios, citas, eventos, inscripciones, atenciones, actividades, reportes, deporte };
  }

  async resumen() {
    const [usuarios, accesos, citas, eventos, atenciones, personas, informesPorRevisar, inscripcionesDeporte, sesionesDeporte] = await Promise.all([
      this.db.usuario.findMany({ include: { rol: true } }),
      this.db.accesoModulo.findMany(),
      this.citas(),
      this.db.evento.findMany({ where: { estado: { in: ["Publicado", "Cerrado"] } } }),
      this.db.atencionSalud.count(),
      this.db.personaSalud.count(),
      this.db.informeGestion.count({ where: { estado: "Enviado" } }),
      this.db.inscripcionDeporte.findMany({ where: { estado: "Activa" } }),
      this.db.sesionDeporte.count(),
    ]);
    return { usuarios, accesos, citas, eventos, atenciones, personas, informesPorRevisar, inscripcionesDeporte, sesionesDeporte };
  }
}

module.exports = { LecturaRepository };
