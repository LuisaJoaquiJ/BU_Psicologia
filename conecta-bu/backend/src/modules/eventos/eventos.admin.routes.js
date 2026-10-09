const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const {
  crear,
  listarAdmin,
  obtenerAdmin,
  actualizar,
  cambiarEstado,
  eliminar,
  inscritos,
  asistencia,
} = require("./eventos.controller");

const router = Router();

// RN-008: la gestion de eventos y su asistencia es exclusiva del Administrador.
router.use(authMiddleware, requireRole("Administrador"));

// RF-009
router.get("/", listarAdmin);
router.post(
  "/",
  requireFields(["nombre", "fecha", "horaInicio", "horaFin", "cupos", "fechaLimiteInscripcion"]),
  crear
);
router.get("/:id", obtenerAdmin);
router.patch("/:id", actualizar);
router.patch("/:id/estado", requireFields(["estado"]), cambiarEstado);
router.delete("/:id", eliminar);

// RF-011 / RN-010
router.get("/:id/inscripciones", inscritos);
router.patch("/:id/inscripciones/:inscripcionId/asistencia", requireFields(["asistio"]), asistencia);

module.exports = router;
