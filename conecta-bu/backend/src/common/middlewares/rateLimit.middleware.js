const { AppError } = require("../utils/AppError");

// Limite de peticiones en memoria (ventana fija) para las rutas que se pueden
// abusar: el login con Google y el asistente, que consume cuota de la IA.
// Basta con un solo servidor; si se escala a varios, cambiar por un store compartido.
function limitarPeticiones({ max, ventanaMs, clave = (req) => req.ip, mensaje }) {
  const conteos = new Map();

  const limpiar = setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of conteos) if (v.reinicio <= ahora) conteos.delete(k);
  }, ventanaMs);
  limpiar.unref();

  function middleware(req, res, next) {
    const ahora = Date.now();
    const k = clave(req);
    let entrada = conteos.get(k);
    if (!entrada || entrada.reinicio <= ahora) {
      entrada = { cuenta: 0, reinicio: ahora + ventanaMs };
      conteos.set(k, entrada);
    }
    entrada.cuenta += 1;
    if (entrada.cuenta > max) {
      res.set("Retry-After", String(Math.ceil((entrada.reinicio - ahora) / 1000)));
      return next(new AppError(429, mensaje || "Demasiadas solicitudes. Espera un momento e intenta de nuevo."));
    }
    next();
  }
  middleware.reiniciar = () => conteos.clear();
  return middleware;
}

const limiteLogin = limitarPeticiones({
  max: Number(process.env.LIMITE_LOGIN || 20),
  ventanaMs: 15 * 60 * 1000,
  mensaje: "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
});

// Va despues de authMiddleware: el limite es por usuario, no por red (en la
// Institucion muchos estudiantes comparten la misma IP).
const limiteAsistente = limitarPeticiones({
  max: Number(process.env.LIMITE_ASISTENTE || 20),
  ventanaMs: 5 * 60 * 1000,
  clave: (req) => req.usuario?.id || req.ip,
  mensaje: "Has hecho muchas preguntas seguidas. Espera unos minutos para seguir conversando con el asistente.",
});

module.exports = { limitarPeticiones, limiteLogin, limiteAsistente };
