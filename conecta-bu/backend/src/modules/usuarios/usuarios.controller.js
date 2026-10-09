const { listarUsuarios, listarRoles, cambiarRolUsuario, cambiarEstadoUsuario } = require("./usuarios.service");

// RF-012
async function listar(req, res, next) {
  try {
    const [usuarios, roles] = await Promise.all([
      listarUsuarios({ busqueda: req.query.busqueda, rol: req.query.rol, habilitado: req.query.habilitado }),
      listarRoles(),
    ]);
    res.status(200).json({ usuarios, roles });
  } catch (err) {
    next(err);
  }
}

// RF-012
async function cambiarRol(req, res, next) {
  try {
    const usuario = await cambiarRolUsuario(req.usuario.id, req.params.id, req.body.rol);
    res.status(200).json({ usuario });
  } catch (err) {
    next(err);
  }
}

// RF-012
async function cambiarEstado(req, res, next) {
  try {
    const usuario = await cambiarEstadoUsuario(req.usuario.id, req.params.id, req.body.habilitado);
    res.status(200).json({ usuario });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, cambiarRol, cambiarEstado };
