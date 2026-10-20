const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");

// Requisito de horas y maximo de grupos por periodo (una sola fila, id 1).
const PREDETERMINADA = { id: 1, horasRequeridas: 40, maxGruposPorPeriodo: 2 };

class ConfigService {
  async obtener() {
    return (await repos.config.buscarPorId(1)) || { ...PREDETERMINADA };
  }

  async guardar({ horasRequeridas, maxGruposPorPeriodo } = {}) {
    const data = {};
    if (horasRequeridas !== undefined) data.horasRequeridas = this.validar(horasRequeridas, 1, 500, "Las horas requeridas deben estar entre 1 y 500.");
    if (maxGruposPorPeriodo !== undefined) data.maxGruposPorPeriodo = this.validar(maxGruposPorPeriodo, 1, 10, "El máximo de grupos por periodo debe estar entre 1 y 10.");
    if (await repos.config.buscarPorId(1)) await repos.config.actualizar(1, data);
    else await repos.config.crear({ ...PREDETERMINADA, ...data });
    return this.obtener();
  }

  validar(valor, min, max, mensaje) {
    const n = Number(valor);
    if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, mensaje);
    return n;
  }
}

module.exports = new ConfigService();
