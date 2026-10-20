const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { sstController: c } = require("../controllers/SstController");
const { sstArchivoService } = require("../services/SstArchivoService");
const { manejar } = require("./manejar");

// /api/v1/reportes-sst: el personal administrativo y docente con acceso a
// Conecta BU reporta sus salidas, traslados o condiciones inseguras y sigue
// su estado. Los estudiantes no reportan: se inscriben a las salidas en Mi Salud.
const router = Router();
router.use(authMiddleware, requireRole("Administrador"));

router.get("/catalogos", manejar(c.catalogos));
router.get("/personas", manejar(c.personas));
router.get("/mios", manejar(c.mios));
router.post("/", sstArchivoService.recibir, manejar(c.crear));
router.get("/:id", manejar(c.obtener));
router.post("/:id/adjuntos", sstArchivoService.recibir, manejar(c.adjuntar));
router.get("/adjuntos/:id/archivo", manejar(c.archivoAdjunto));

module.exports = router;
