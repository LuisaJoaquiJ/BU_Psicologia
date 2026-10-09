// Error de aplicacion con codigo HTTP explicito, para que el middleware de errores
// responda siempre con el formato acordado en F-03 (seccion 3.1):
// { "statusCode": 400, "message": "...", "error": "Bad Request" }
class AppError extends Error {
  // "codigo" (opcional) permite al frontend distinguir casos que comparten
  // estado HTTP, p. ej. PERSONA_NO_ENCONTRADA frente a otro 404.
  constructor(statusCode, message, codigo) {
    super(message);
    this.statusCode = statusCode;
    if (codigo) this.codigo = codigo;
  }
}

module.exports = { AppError };
