const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { agendaAdmin, asistencia } = require("./citas.controller");

// RN-008: la agenda de citas y el registro de asistencia son del personal de
// cada modulo (Desarrollo humano en /admin/citas, Salud en /salud/citas).
function crearRouterAgenda(modulo) {
  const router = Router();
  router.use(authMiddleware, requireModulo(modulo));
  // RF-008 / HU-15
  router.get("/", agendaAdmin);
  // RF-008 / HU-16
  router.patch("/:id/asistencia", requireFields(["asistio"]), asistencia);
  return router;
}

module.exports = crearRouterAgenda("desarrollo-humano");
module.exports.crearRouterAgenda = crearRouterAgenda;
