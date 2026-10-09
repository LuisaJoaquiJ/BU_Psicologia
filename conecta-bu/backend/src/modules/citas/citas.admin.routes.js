const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { agendaAdmin, asistencia } = require("./citas.controller");

const router = Router();

// RN-008: la agenda administrativa y el registro de asistencia son
// exclusivos de los roles administrativos; cada uno ve solo su modulo
// (Administrador: Desarrollo humano; Salud: Salud integral).
router.use(authMiddleware, requireRole("Administrador", "Salud"));

// RF-008 / HU-15
router.get("/", agendaAdmin);

// RF-008 / HU-16
router.patch("/:id/asistencia", requireFields(["asistio"]), asistencia);

module.exports = router;
