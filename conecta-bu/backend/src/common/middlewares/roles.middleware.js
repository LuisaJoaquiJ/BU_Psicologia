const { AppError } = require("../utils/AppError");

// RN-008: solo los usuarios con rol de administrador pueden gestionar
// horarios, eventos, asistencia y usuarios. Uso: requireRole("Administrador")
function requireRole(...rolesPermitidos) {
  return function roleMiddleware(req, res, next) {
    if (!req.usuario) {
      return next(new AppError(401, "Debes iniciar sesion para acceder a este recurso."));
    }
    if (!rolesPermitidos.includes(req.usuario.rol.nombre)) {
      return next(new AppError(403, "No tienes permiso para realizar esta accion."));
    }
    next();
  };
}

// Acceso al panel de un modulo (Desarrollo humano, Salud integral...): el
// superadministrador entra a todos; el personal, solo a los modulos cuyo
// acceso le asigno el superadministrador por correo. Deja req.modulo listo
// para los servicios compartidos (horarios, agenda de citas).
function requireModulo(modulo) {
  const { MODULOS, modulosDeUsuario } = require("../utils/modulos");
  return function moduloMiddleware(req, res, next) {
    if (!req.usuario) {
      return next(new AppError(401, "Debes iniciar sesion para acceder a este recurso."));
    }
    if (!modulosDeUsuario(req.usuario).includes(modulo)) {
      return next(new AppError(403, `No tienes acceso al modulo ${MODULOS[modulo] || modulo}.`, "SIN_ACCESO_MODULO"));
    }
    req.modulo = modulo;
    next();
  };
}

module.exports = { requireRole, requireModulo };
