const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { informeController: c } = require("../controllers/InformeController");
const { manejar } = require("./manejar");

// Informes de gestion que Salud integral envia al superadministrador
// (/api/v1/super/informes). El codigo es de Salud; el superadministrador
// solo usa estas rutas.
const router = Router();
router.use(authMiddleware, requireRole("SuperAdministrador"));

router.get("/", manejar(c.recibidos));
router.get("/:id/archivo", manejar(c.archivoRecibido));
router.patch("/:id", manejar(c.revisar));

module.exports = router;
