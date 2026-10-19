const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { agendaController: c } = require("../controllers/AgendaController");
const { manejar } = require("./manejar");

// RN-008: agenda de citas y asistencia, solo el personal de Desarrollo Humano.
const router = Router();
router.use(authMiddleware, requireModulo("desarrollo-humano"));

router.get("/", manejar(c.listar)); // RF-008 / HU-15
router.patch("/:id/asistencia", requireFields(["asistio"]), manejar(c.asistencia)); // HU-16
// Atencion sin cita: el estudiante llega sin cita y se le atiende.
router.get("/estudiantes", manejar(c.estudiantes));
router.post("/sin-cita", manejar(c.sinCita));

module.exports = router;
