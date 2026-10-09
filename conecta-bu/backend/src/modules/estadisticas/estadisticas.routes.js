const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { obtenerEstadisticas } = require("./estadisticas.service");
const { listarEjecuciones } = require("../../integrations/n8n.client");

const router = Router();

router.use(authMiddleware, requireRole("Administrador"));

// RF-015: indicadores de participacion y asistencia (citas y eventos).
router.get("/", async (req, res, next) => {
  try {
    const estadisticas = await obtenerEstadisticas({ desde: req.query.desde, hasta: req.query.hasta });
    res.status(200).json(estadisticas);
  } catch (err) {
    next(err);
  }
});

// RF-013: ultimas ejecuciones de automatizaciones n8n (para revisar fallos).
router.get("/automatizaciones", (req, res) => {
  res.status(200).json({ ejecuciones: listarEjecuciones() });
});

module.exports = router;
