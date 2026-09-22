const { AppError } = require("../utils/AppError");

// Validador minimo para el Sprint 1. En sprints siguientes se puede reemplazar
// por zod o express-validator sin cambiar la forma en que se usa (validate(schema)).
function requireFields(fields) {
  return function validateMiddleware(req, res, next) {
    const faltantes = fields.filter((field) => {
      const value = req.body?.[field];
      return value === undefined || value === null || value === "";
    });
    if (faltantes.length > 0) {
      return next(new AppError(400, `Faltan campos obligatorios: ${faltantes.join(", ")}`));
    }
    next();
  };
}

module.exports = { requireFields };
