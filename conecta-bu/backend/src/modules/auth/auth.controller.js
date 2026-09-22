const { loginConGoogle, serializarUsuario } = require("./auth.service");

async function loginGoogle(req, res, next) {
  try {
    const { idToken } = req.body;
    const { token, usuario } = await loginConGoogle(idToken);
    res.status(200).json({ token, usuario });
  } catch (err) {
    next(err);
  }
}

// RF-002, paso 1-2: el middleware de autenticacion ya adjunto req.usuario.
async function me(req, res) {
  res.status(200).json({ usuario: serializarUsuario(req.usuario) });
}

// RF-002, paso 4: el JWT es sin estado, asi que "cerrar sesion" es responsabilidad
// del cliente (borrar el token). Este endpoint queda listo para, en el futuro,
// registrar el cierre de sesion o invalidar tokens si el proyecto lo requiere.
async function logout(req, res) {
  res.status(200).json({ message: "Sesion cerrada correctamente." });
}

module.exports = { loginGoogle, me, logout };
