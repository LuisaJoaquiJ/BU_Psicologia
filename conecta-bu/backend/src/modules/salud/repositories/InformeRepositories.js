const { BaseRepository } = require("./BaseRepository");

// Informes de gestion (INFBI-002) y cifras historicas de la Unidad de Salud.

class InformeRepository extends BaseRepository {
  constructor(db) {
    super("informeGestion", db);
  }
  delModulo(modulo) {
    return this.tabla.findMany({ where: { modulo }, orderBy: { periodo: "desc" } });
  }
  dePeriodo(modulo, periodo) {
    return this.tabla.findUnique({ where: { modulo_periodo: { modulo, periodo } } });
  }
  recibidos(where) {
    return this.tabla.findMany({ where, orderBy: { fechaEnvio: "desc" } });
  }
}

class HistoricoRepository extends BaseRepository {
  constructor(db) {
    super("historicoSalud", db);
  }
  eliminarTodos() {
    return this.tabla.deleteMany({});
  }
}

// Lo que se necesita para calcular las cifras de un periodo.
class CifrasRepository {
  constructor(db) {
    this.db = db;
  }
  async delPeriodo(periodo, rango) {
    const [actividades, todas, historicos, evidencias, todasLasActividades] = await Promise.all([
      this.db.actividadSalud.findMany({ where: { periodo } }),
      this.db.atencionSalud.findMany({
        where: { fecha: { lte: rango.hasta } },
        select: { id: true, fecha: true, poblacion: true, programa: true, actividadId: true, personaId: true, remitido: true },
      }),
      this.db.historicoSalud.findMany(),
      this.db.evidenciaSalud.findMany({ where: { fecha: { gte: rango.desde, lte: rango.hasta } }, include: { actividad: true }, orderBy: { fecha: "asc" } }),
      this.db.actividadSalud.findMany({ select: { id: true, categoria: true } }),
    ]);
    return { actividades, todas, historicos, evidencias, todasLasActividades };
  }
}

module.exports = { InformeRepository, HistoricoRepository, CifrasRepository };
