const { AppError } = require("./AppError");

// Modulos de Bienestar que comparten la agenda de citas (servicios,
// horarios y citas). Cada servicio pertenece a uno; los servicios creados
// antes del modulo de Salud quedan en "desarrollo-humano".
const MODULOS_CON_CITAS = ["desarrollo-humano", "salud"];

// Modulo que gestiona cada rol administrativo.
const MODULO_POR_ROL = { Administrador: "desarrollo-humano", Salud: "salud" };

function moduloDeServicio(servicio) {
  return servicio?.modulo || "desarrollo-humano";
}

function moduloDeRol(rol) {
  return MODULO_POR_ROL[rol] || "desarrollo-humano";
}

// Modulo pedido en ?modulo=...; si no se indica, el del rol de quien consulta.
function moduloSolicitado(req) {
  const pedido = req.query?.modulo;
  if (pedido) {
    if (!MODULOS_CON_CITAS.includes(pedido)) throw new AppError(400, "El modulo indicado no existe.");
    return pedido;
  }
  return moduloDeRol(req.usuario?.rol?.nombre);
}

// Un rol administrativo solo gestiona la agenda de su propio modulo.
function exigirMismoModulo(servicio, modulo) {
  if (moduloDeServicio(servicio) !== modulo) {
    throw new AppError(403, "Este servicio pertenece a otro modulo de Bienestar.");
  }
}

module.exports = { MODULOS_CON_CITAS, moduloDeServicio, moduloDeRol, moduloSolicitado, exigirMismoModulo };
