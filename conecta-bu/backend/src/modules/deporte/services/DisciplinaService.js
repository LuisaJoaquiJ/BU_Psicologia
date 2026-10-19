const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const { TIPOS, texto, validarCategorias } = require("../utils");

// Disciplinas que oferta la Universidad (Natacion, Futbol...).
class DisciplinaService {
  async listar({ incluirInactivas } = {}) {
    const lista = await repos.disciplinas.listarOrdenadas({ soloActivas: !incluirInactivas });
    return lista.map((d) => imagenes.conImagen("disciplinas", d));
  }

  async crear(cuerpo) {
    const data = this.datos(cuerpo);
    await this.exigirNombreLibre(data.nombre);
    return imagenes.conImagen("disciplinas", await repos.disciplinas.crear(data));
  }

  async actualizar(id, cuerpo) {
    if (!(await repos.disciplinas.buscarPorId(id))) throw new AppError(404, "La disciplina no existe.");
    const data = this.datos(cuerpo, true);
    if (data.nombre) await this.exigirNombreLibre(data.nombre, id);
    return imagenes.conImagen("disciplinas", await repos.disciplinas.actualizar(id, data));
  }

  async exigirExistente(id, mensaje = "La disciplina no existe.") {
    const disciplina = id ? await repos.disciplinas.buscarPorId(id) : null;
    if (!disciplina) throw new AppError(400, mensaje);
    return disciplina;
  }

  async exigirNombreLibre(nombre, id) {
    const existe = (await repos.disciplinas.listar()).find((d) => d.id !== id && d.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) throw new AppError(409, `Ya existe la disciplina ${existe.nombre}.`);
  }

  datos(cuerpo = {}, parcial = false) {
    const data = {};
    if (!parcial || cuerpo.nombre !== undefined) {
      data.nombre = texto(cuerpo.nombre, 80);
      if (!data.nombre) throw new AppError(400, "Escribe el nombre de la disciplina.");
    }
    if (cuerpo.descripcion !== undefined) data.descripcion = texto(cuerpo.descripcion, 600);
    if (!parcial || cuerpo.tipo !== undefined) {
      data.tipo = cuerpo.tipo || "Individual";
      if (!TIPOS.includes(data.tipo)) throw new AppError(400, "El tipo debe ser Individual, Colectivo o Mental.");
    }
    if (cuerpo.activa !== undefined) data.activa = cuerpo.activa === true;
    // RN-002: categorias que pueden inscribirse (vacio = todas).
    if (cuerpo.categorias !== undefined) data.categorias = validarCategorias(cuerpo.categorias);
    return data;
  }
}

module.exports = new DisciplinaService();
