const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { sstController: c } = require("../controllers/SstController");
const { sstArchivoService } = require("../services/SstArchivoService");
const { manejar } = require("./manejar");

// /api/v1/reportes-sst: cualquier persona de la Institucion con sesion
// reporta sus salidas, traslados o condiciones inseguras y sigue su estado.
const router = Router();
router.use(authMiddleware);

router.get("/catalogos", manejar(c.catalogos));
router.get("/personas", manejar(c.personas));
router.get("/mios", manejar(c.mios));
router.post("/", sstArchivoService.recibir, manejar(c.crear));
router.get("/:id", manejar(c.obtener));
router.post("/:id/adjuntos", sstArchivoService.recibir, manejar(c.adjuntar));
router.get("/adjuntos/:id/archivo", manejar(c.archivoAdjunto));

module.exports = router;
