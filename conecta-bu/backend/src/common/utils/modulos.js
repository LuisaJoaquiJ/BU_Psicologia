const { AppError } = require("./AppError");

// Modulos de Bienestar que comparten la agenda de citas (servicios,
// horarios y citas). Cada servicio pertenece a uno; los servicios creados
// antes del modulo de Salud quedan en "desarrollo-humano".
const MODULOS_CON_CITAS = ["desarrollo-humano", "salud"];

// Modulos con personal asignado (accesos por correo).
const MODULOS = {
  "desarrollo-humano": "Desarrollo humano y orientación",
  salud: "Salud integral",
};

// Modulo por defecto de cada rol cuando no se indica (compatibilidad).
const MODULO_POR_ROL = { Administrador: "desarrollo-humano" };

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
  return "desarrollo-humano";
}

// Un rol administrativo solo gestiona la agenda de su propio modulo.
function exigirMismoModulo(servicio, modulo) {
  if (moduloDeServicio(servicio) !== modulo) {
    throw new AppError(403, "Este servicio pertenece a otro modulo de Bienestar.");
  }
}

// Modulos que puede gestionar un usuario: el superadministrador, todos; el
// personal (Administrador), los que tenga asignados por correo.
function modulosDeUsuario(usuario) {
  if (usuario?.rol?.nombre === "SuperAdministrador") return Object.keys(MODULOS);
  if (usuario?.rol?.nombre === "Administrador") return usuario.modulos || [];
  return [];
}

module.exports = { MODULOS, modulosDeUsuario, MODULOS_CON_CITAS, moduloDeServicio, moduloDeRol, moduloSolicitado, exigirMismoModulo };
