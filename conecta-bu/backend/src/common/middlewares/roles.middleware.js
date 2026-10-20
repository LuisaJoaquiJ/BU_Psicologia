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

// Acceso al panel de un modulo (Desarrollo humano, Salud integral...): solo
// el personal cuyo acceso asigno el superadministrador por correo. El
// superadministrador no entra a los modulos (solo a su panel /super). Deja req.modulo listo
// para los servicios compartidos (horarios, agenda de citas).
function requireModulo(modulo) {
  const { MODULOS, modulosDeUsuario } = require("../utils/modulos");
  return function moduloMiddleware(req, res, next) {
    if (!req.usuario) {
      return next(new AppError(401, "Debes iniciar sesion para acceder a este recurso."));
    }
    if (req.usuario.rol?.nombre === "SuperAdministrador") {
      return next(new AppError(403, "El superadministrador trabaja desde su panel y no entra a los modulos.", "SUPERADMIN_SIN_MODULOS"));
    }
    if (!modulosDeUsuario(req.usuario).includes(modulo)) {
      return next(new AppError(403, `No tienes acceso al modulo ${MODULOS[modulo] || modulo}.`, "SIN_ACCESO_MODULO"));
    }
    req.modulo = modulo;
    next();
  };
}

module.exports = { requireRole, requireModulo };
