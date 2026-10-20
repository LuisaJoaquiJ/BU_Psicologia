const { Router } = require("express");
const { authMiddleware } = require("../../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../../common/middlewares/roles.middleware");
const { requireFields } = require("../../../../common/validators/validate");
const { horarioController: c } = require("../controllers/HorarioController");
const { manejar } = require("./manejar");

// RN-008: horarios y tiempo no disponible, solo el personal de Salud integral.
const router = Router();
router.use(authMiddleware, requireModulo("salud"));

// Tiempo no disponible (compromisos, incapacidad, permisos...).
router.get("/bloqueos", manejar(c.bloqueos));
router.post("/bloqueos/citas-afectadas", manejar(c.citasAfectadas));
router.post("/bloqueos", manejar(c.crearBloqueo));
router.delete("/bloqueos/:id", manejar(c.eliminarBloqueo));

// RF-007 / HU-13, HU-14
router.post("/", requireFields(["servicioId", "fecha", "horaInicio", "horaFin"]), manejar(c.crear));
router.get("/", manejar(c.listar));
router.patch("/:id", manejar(c.actualizar));
router.patch("/:id/deshabilitar", manejar(c.deshabilitar));
router.patch("/:id/habilitar", manejar(c.habilitar));

module.exports = router;
