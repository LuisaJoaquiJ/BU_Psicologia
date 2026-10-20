const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");

// RF-012: usuarios y roles de Conecta BU (solo el superadministrador).
const serializar = (u) => ({ id: u.id, nombre: u.nombre, email: u.emailInstitucional, rol: u.rol?.nombre, habilitado: u.habilitado, fechaCreacion: u.fechaCreacion });

class UsuarioService {
  constructor(r = repos) {
    this.repos = r;
  }

  async listar({ busqueda, rol, habilitado } = {}) {
    const where = {};
    if (rol) where.rol = { nombre: rol };
    if (habilitado === "true" || habilitado === "false") where.habilitado = habilitado === "true";
    if (busqueda) {
      where.OR = [{ nombre: { contains: busqueda, mode: "insensitive" } }, { emailInstitucional: { contains: busqueda, mode: "insensitive" } }];
    }
    return (await this.repos.usuarios.buscarConRol(where)).map(serializar);
  }

  async roles() {
    return (await this.repos.roles.nombres()).map((r) => r.nombre);
  }

  async obtener(id) {
    const usuario = await this.repos.usuarios.conRol(id);
    if (!usuario) throw new AppError(404, "El usuario no existe.");
    return usuario;
  }

  // Nadie se cambia a si mismo el rol ni se deshabilita (evita quedarse sin acceso).
  noEsElMismo(adminId, usuarioId) {
    if (adminId === usuarioId) throw new AppError(403, "No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta.");
  }

  // Siempre debe quedar al menos un superadministrador habilitado.
  async exigirOtroSuper(usuario) {
    if (usuario.rol?.nombre !== "SuperAdministrador" || !usuario.habilitado) return;
    if ((await this.repos.usuarios.contarSuperHabilitados()) <= 1) {
      throw new AppError(409, "Debe quedar al menos un superadministrador habilitado en Conecta BU.");
    }
  }

  async cambiarRol(adminId, usuarioId, nombreRol) {
    this.noEsElMismo(adminId, usuarioId);
    const usuario = await this.obtener(usuarioId);
    const rol = await this.repos.roles.porNombre(nombreRol);
    if (!rol) throw new AppError(400, `El rol "${nombreRol}" no existe.`);
    if (usuario.rolId === rol.id) return serializar(usuario);
    await this.exigirOtroSuper(usuario);
    return serializar(await this.repos.usuarios.actualizarConRol(usuarioId, { rolId: rol.id }));
  }

  // Un usuario deshabilitado no inicia sesion y su token deja de valer de
  // inmediato (el middleware de sesion revisa "habilitado" en cada peticion).
  async cambiarEstado(adminId, usuarioId, habilitado) {
    if (typeof habilitado !== "boolean") throw new AppError(400, "El campo habilitado debe ser true o false.");
    this.noEsElMismo(adminId, usuarioId);
    const usuario = await this.obtener(usuarioId);
    if (usuario.habilitado === habilitado) return serializar(usuario);
    if (!habilitado) await this.exigirOtroSuper(usuario);
    return serializar(await this.repos.usuarios.actualizarConRol(usuarioId, { habilitado }));
  }
}

module.exports = { UsuarioService, usuarioService: new UsuarioService() };
