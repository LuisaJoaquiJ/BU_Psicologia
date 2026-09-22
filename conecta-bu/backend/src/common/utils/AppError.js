// Error de aplicacion con codigo HTTP explicito, para que el middleware de errores
// responda siempre con el formato acordado en F-03 (seccion 3.1):
// { "statusCode": 400, "message": "...", "error": "Bad Request" }
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { AppError };
