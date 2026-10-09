const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireFields } = require("../../common/validators/validate");
const { horariosDisponibles, agendar, misCitas, cancelar } = require("./citas.controller");

const router = Router();

// RF-004 / HU-07
router.get("/horarios-disponibles", authMiddleware, horariosDisponibles);

// RF-005 / HU-08, HU-09, HU-10
router.post("/", authMiddleware, requireFields(["horarioId"]), agendar);

// RF-006 / HU-11
router.get("/mias", authMiddleware, misCitas);

// RF-006 / HU-12
router.patch("/:id/cancelar", authMiddleware, cancelar);

module.exports = router;
