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

module.exports = { requireRole };
