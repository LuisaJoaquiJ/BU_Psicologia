const { BaseRepository } = require("./BaseRepository");

// Tablas que administra el superadministrador: usuarios, roles y accesos de
// cada modulo.

const CON_ROL = { rol: true };

class UsuarioRepository extends BaseRepository {
  constructor(db) {
    super("usuario", db);
  }
  conRol(id) {
    return this.tabla.findUnique({ where: { id }, include: CON_ROL });
  }
  buscarConRol(where = {}) {
    return this.tabla.findMany({ where, include: CON_ROL, orderBy: { nombre: "asc" } });
  }
  todosConRol() {
    return this.tabla.findMany({ include: CON_ROL });
  }
  porCorreos(emails) {
    return emails.length ? this.tabla.findMany({ where: { emailInstitucional: { in: emails } }, include: CON_ROL }) : [];
  }
  porCorreo(email) {
    return this.tabla.findFirst({ where: { emailInstitucional: { equals: email, mode: "insensitive" } }, include: CON_ROL });
  }
  actualizarConRol(id, data) {
    return this.tabla.update({ where: { id }, data, include: CON_ROL });
  }
  contarSuperHabilitados() {
    return this.contar({ habilitado: true, rol: { nombre: "SuperAdministrador" } });
  }
}

class RolRepository extends BaseRepository {
  constructor(db) {
    super("rol", db);
  }
  porNombre(nombre) {
    return this.tabla.findUnique({ where: { nombre } });
  }
  nombres() {
    return this.tabla.findMany({ orderBy: { nombre: "asc" } });
  }
}

class AccesoRepository extends BaseRepository {
  constructor(db) {
    super("accesoModulo", db);
  }
  ordenados() {
    return this.tabla.findMany({ orderBy: [{ modulo: "asc" }, { email: "asc" }] });
  }
}

module.exports = { UsuarioRepository, RolRepository, AccesoRepository };
