const { Router } = require("express");
const { authMiddleware } = require("../../../../common/middlewares/auth.middleware");
const { requireFields } = require("../../../../common/validators/validate");
const { citaController: c } = require("../controllers/CitaController");
const { manejar } = require("./manejar");

// Citas del estudiante en Salud integral (RF-004 a RF-006).
const router = Router();
router.use(authMiddleware);

router.get("/horarios-disponibles", manejar(c.disponibles)); // HU-07
router.post("/", requireFields(["horarioId"]), manejar(c.agendar)); // HU-08 a HU-10
router.get("/mias", manejar(c.mias)); // HU-11
router.patch("/:id/cancelar", manejar(c.cancelar)); // HU-12

module.exports = router;
