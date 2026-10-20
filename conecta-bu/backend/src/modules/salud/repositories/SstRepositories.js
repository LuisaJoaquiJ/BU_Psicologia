const { BaseRepository } = require("./BaseRepository");

// Reportes SST (salidas institucionales y condiciones inseguras) y sus documentos.
const CON_ADJUNTOS = { adjuntos: { orderBy: { fechaSubida: "asc" } } };

class ReporteSstRepository extends BaseRepository {
  constructor(db) {
    super("reporteSST", db);
  }
  // Con la convocatoria de inscripcion que se abrio desde el reporte, si hay.
  completo(id) {
    return this.tabla.findUnique({ where: { id }, include: { ...CON_ADJUNTOS, convocatoria: { select: { id: true, estado: true } } } });
  }
  buscar(where, { orden = { fechaCreacion: "desc" }, limite } = {}) {
    return this.tabla.findMany({ where, include: CON_ADJUNTOS, orderBy: orden, ...(limite ? { take: limite } : {}) });
  }
  crearConAdjuntos(data) {
    return this.tabla.create({ data, include: CON_ADJUNTOS });
  }
  // Responsables y acompanantes de los ultimos reportes (para sugerir personas).
  personasRecientes() {
    return this.tabla.findMany({
      where: { tipo: { not: "CondicionInsegura" } },
      orderBy: { fechaCreacion: "desc" },
      take: 400,
      select: { responsableNombre: true, responsableTipoDoc: true, responsableDocumento: true, acompanantes: true },
    });
  }
}

class AdjuntoSstRepository extends BaseRepository {
  constructor(db) {
    super("adjuntoReporteSST", db);
  }
  conReporte(id) {
    return this.tabla.findUnique({ where: { id }, include: { reporte: true } });
  }
}

module.exports = { ReporteSstRepository, AdjuntoSstRepository };
