const { prisma } = require("../../../config/prisma");

// Consultas de lectura para las estadisticas y el tablero de Desarrollo Humano.
const ALUMNO = { select: { id: true, nombre: true, emailInstitucional: true } };

class EstadisticaRepository {
  constructor(db = prisma) {
    this.db = db;
  }

  // Citas, eventos (con inscritos y asistencia), estudiantes y horarios del
  // rango de fechas (o de todo el historial).
  async datosDelPeriodo(fecha) {
    const [citas, eventos, estudiantes, horarios] = await Promise.all([
      this.db.citaDesarrollo.findMany({ where: fecha ? { horario: { fecha } } : {}, include: { horario: { include: { servicio: true } }, usuario: ALUMNO } }),
      this.db.evento.findMany({
        where: { estado: { in: ["Publicado", "Cerrado"] }, ...(fecha ? { fecha } : {}) },
        include: { inscripciones: { where: { estado: "Confirmada" }, include: { asistencia: true, usuario: ALUMNO } } },
        orderBy: { fecha: "asc" },
      }),
      this.db.usuario.count({ where: { rol: { nombre: "Estudiante" } } }),
      this.db.horarioDesarrollo.findMany({ where: fecha ? { fecha } : {}, include: { servicio: true } }),
    ]);
    return { citas, eventos, estudiantes, horarios: horarios.filter((h) => !h.sinCita) };
  }

  // Todo lo que usa el tablero: citas, eventos visibles e inscripciones.
  async datosTablero() {
    const [citas, eventos, inscripciones] = await Promise.all([
      this.db.citaDesarrollo.findMany({ include: { horario: { include: { servicio: true } }, usuario: { select: { id: true, nombre: true } } } }),
      this.db.evento.findMany({ where: { estado: { in: ["Publicado", "Cerrado"] } } }),
      this.db.inscripcion.findMany({ where: { estado: "Confirmada" }, include: { usuario: true } }),
    ]);
    return { citas, eventos, inscripciones };
  }
}

module.exports = { EstadisticaRepository };
