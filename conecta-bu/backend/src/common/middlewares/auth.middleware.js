const { verifyToken } = require("../utils/jwt");
const { AppError } = require("../utils/AppError");
const { prisma } = require("../../config/prisma");

// RF-002: valida el JWT emitido tras el login con Google y adjunta el usuario
// autenticado (con su rol) a req.usuario para que el resto de la app lo use.
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "Debes iniciar sesion para acceder a este recurso.");
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      throw new AppError(401, "La sesion no es valida o ha expirado. Inicia sesion nuevamente.");
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { rol: true },
    });

    if (!usuario || !usuario.habilitado) {
      throw new AppError(401, "Tu usuario no tiene acceso habilitado en Conecta BU.");
    }

    // Modulos a los que tiene acceso el personal (asignados por correo).
    const accesos = await prisma.accesoModulo.findMany({
      where: { email: usuario.emailInstitucional.toLowerCase() },
    });
    usuario.modulos = accesos.map((a) => a.modulo);

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authMiddleware };
