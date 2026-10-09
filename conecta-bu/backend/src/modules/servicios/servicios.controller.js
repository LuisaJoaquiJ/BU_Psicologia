const { listarServiciosActivos } = require("./servicios.service");

// RF-003 / HU-06
async function listar(req, res, next) {
  try {
    const servicios = await listarServiciosActivos();
    res.status(200).json({ servicios });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar };
