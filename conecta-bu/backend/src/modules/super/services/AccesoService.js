const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { MODULOS } = require("../../../common/utils/modulos");
const repos = require("../repositories");

// El superadministrador decide, por correo, que personal entra a cada
// modulo. Los modulos son independientes: tener acceso a Desarrollo humano
// no da acceso a Salud integral, y al reves.

// Acceso de los docentes de Deporte: lo maneja la coordinacion de Deporte.
const ACCESO_DOCENTE = "deporte-docente";

const normalizarEmail = (email) => String(email || "").trim().toLowerCase();

class AccesoService {
  constructor(r = repos) {
    this.repos = r;
  }

  async cambiarRol(usuario, nombreRol) {
    const rol = await this.repos.roles.porNombre(nombreRol);
    if (!rol || usuario.rolId === rol.id) return;
    await this.repos.usuarios.actualizar(usuario.id, { rolId: rol.id });
  }

  exigirInstitucional(correo) {
    if (correo.split("@")[1] !== config.allowedGoogleDomain) {
      throw new AppError(400, `Solo se pueden asignar correos institucionales @${config.allowedGoogleDomain}.`);
    }
  }

  async exigirSinRepetir(email, modulo) {
    if (await this.repos.accesos.buscarUno({ email, modulo })) throw new AppError(409, `${email} ya tiene acceso a ${MODULOS[modulo]}.`);
  }

  async listar() {
    const accesos = await this.repos.accesos.ordenados();
    const usuarios = await this.repos.usuarios.porCorreos([...new Set(accesos.map((a) => a.email))]);
    const porEmail = new Map(usuarios.map((u) => [u.emailInstitucional.toLowerCase(), u]));
    return {
      modulos: MODULOS,
      accesos: accesos.map((a) => {
        const u = porEmail.get(a.email);
        return { ...a, usuario: u ? { id: u.id, nombre: u.nombre, rol: u.rol?.nombre, habilitado: u.habilitado } : null };
      }),
    };
  }

  async asignar({ email, modulo }, asignadoPor) {
    const correo = normalizarEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new AppError(400, "Escribe un correo válido.");
    this.exigirInstitucional(correo);
    if (!MODULOS[modulo]) throw new AppError(400, "El módulo indicado no existe.");
    await this.exigirSinRepetir(correo, modulo);
    const acceso = await this.repos.accesos.crear({ email: correo, modulo, asignadoPor: asignadoPor || null });
    // Si la persona ya inicio sesion como estudiante, pasa a ser personal.
    const usuario = await this.repos.usuarios.porCorreo(correo);
    if (usuario && usuario.rol?.nombre === "Estudiante") await this.cambiarRol(usuario, "Administrador");
    return acceso;
  }

  // Cambia el modulo sin quitar el acceso. Los docentes de Deporte se
  // gestionan desde Deporte > Docentes (su acceso depende de su ficha).
  async cambiarModulo(id, { modulo } = {}, asignadoPor) {
    const acceso = await this.repos.accesos.buscarPorId(id);
    if (!acceso) throw new AppError(404, "El acceso no existe.");
    if (!MODULOS[modulo]) throw new AppError(400, "El módulo indicado no existe.");
    if (acceso.modulo === modulo) throw new AppError(400, `${acceso.email} ya tiene acceso a ${MODULOS[modulo]}.`);
    if (acceso.modulo === ACCESO_DOCENTE || modulo === ACCESO_DOCENTE) {
      throw new AppError(409, "Los docentes de Deporte se gestionan desde Deporte › Docentes.", "ACCESO_DOCENTE");
    }
    this.exigirInstitucional(acceso.email);
    await this.exigirSinRepetir(acceso.email, modulo);
    return this.repos.accesos.actualizar(id, { modulo, asignadoPor: asignadoPor || null, fechaAsignacion: new Date() });
  }

  // Sin ningun modulo asignado, el personal vuelve a ser estudiante.
  async quitar(id) {
    const acceso = await this.repos.accesos.buscarPorId(id);
    if (!acceso) throw new AppError(404, "El acceso no existe.");
    await this.repos.accesos.eliminar(id);
    if ((await this.repos.accesos.contar({ email: acceso.email })) === 0) {
      const usuario = await this.repos.usuarios.porCorreo(acceso.email);
      if (usuario && usuario.rol?.nombre === "Administrador") await this.cambiarRol(usuario, "Estudiante");
    }
    return { eliminado: id };
  }
}

module.exports = { AccesoService, accesoService: new AccesoService(), normalizarEmail };
