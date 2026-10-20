const { prisma } = require("../../../config/prisma");

// Acceso a una tabla con Prisma. Cada repositorio de Salud integral extiende esta
// clase con las consultas propias de su tabla. "db" permite usar el cliente
// de una transaccion (prisma.$transaction) en lugar del cliente normal.
class BaseRepository {
  constructor(modelo, db = prisma) {
    this.modelo = modelo;
    this.db = db;
  }

  get tabla() {
    return this.db[this.modelo];
  }

  buscarPorId(id) {
    return this.tabla.findUnique({ where: { id } });
  }

  buscarUno(where) {
    return this.tabla.findFirst({ where });
  }

  listar(where = {}, orderBy) {
    return this.tabla.findMany(orderBy ? { where, orderBy } : { where });
  }

  // Varios por id; evita la consulta cuando la lista viene vacia.
  async listarPorIds(ids, orderBy) {
    if (!ids?.length) return [];
    return this.listar({ id: { in: [...new Set(ids)] } }, orderBy);
  }

  crear(data) {
    return this.tabla.create({ data });
  }

  actualizar(id, data) {
    return this.tabla.update({ where: { id }, data });
  }

  eliminar(id) {
    return this.tabla.delete({ where: { id } });
  }

  contar(where = {}) {
    return this.tabla.count({ where });
  }
}

module.exports = { BaseRepository };
