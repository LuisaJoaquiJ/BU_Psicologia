const { AppError } = require("../utils/AppError");

const REASON_PHRASES = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

function notFoundHandler(req, res) {
  res.status(404).json({
    statusCode: 404,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    error: REASON_PHRASES[404],
  });
}

// Middleware de errores centralizado (4 argumentos: Express lo reconoce por su firma).
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let statusCode = err instanceof AppError ? err.statusCode : 500;
  // Archivo demasiado grande o tipo no permitido al subir evidencias/Excel.
  if (err?.name === "MulterError") {
    statusCode = 400;
    err.message = err.code === "LIMIT_FILE_SIZE" ? "El archivo supera el tamano maximo permitido." : "No se pudo procesar el archivo enviado.";
  }
  if (statusCode === 500) {
    // Un error inesperado si conviene verlo en los logs del servidor.
    console.error(err);
  }
  res.status(statusCode).json({
    statusCode,
    message: statusCode === 500 ? "Ha ocurrido un error inesperado." : err.message,
    error: REASON_PHRASES[statusCode] || "Error",
    ...(err.codigo && statusCode !== 500 ? { codigo: err.codigo } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
