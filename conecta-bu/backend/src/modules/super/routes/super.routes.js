const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { superController: c } = require("../controllers/SuperController");
const { manejar } = require("./manejar");

// Panel del superadministrador (/api/v1/super).
const router = Router();
router.use(authMiddleware, requireRole("SuperAdministrador"));

router.get("/resumen", manejar(c.resumen));
router.get("/estadisticas", manejar(c.estadisticas));
router.get("/accesos", manejar(c.accesos));
router.post("/accesos", requireFields(["email", "modulo"]), manejar(c.asignar));
router.patch("/accesos/:id", requireFields(["modulo"]), manejar(c.cambiarModulo));
router.delete("/accesos/:id", manejar(c.quitar));

module.exports = router;
