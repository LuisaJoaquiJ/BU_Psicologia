const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { agendaAdmin, asistencia } = require("./citas.controller");
const { buscarEstudiantes, registrarAtencionSinCita } = require("./citas.sincita");

// RN-008: la agenda de citas y el registro de asistencia son del personal de
// cada modulo (Desarrollo humano en /admin/citas, Salud en /salud/citas).
function crearRouterAgenda(modulo) {
  const router = Router();
  router.use(authMiddleware, requireModulo(modulo));
  // RF-008 / HU-15
  router.get("/", agendaAdmin);
  // RF-008 / HU-16
  router.patch("/:id/asistencia", requireFields(["asistio"]), asistencia);
  // Atencion sin cita: el estudiante llega sin cita y se le atiende.
  router.get("/estudiantes", async (req, res, next) => {
    try {
      res.json({ estudiantes: await buscarEstudiantes(req.query.q) });
    } catch (err) {
      next(err);
    }
  });
  router.post("/sin-cita", async (req, res, next) => {
    try {
      res.status(201).json({ cita: await registrarAtencionSinCita(req.usuario.id, req.body, req.modulo || modulo) });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

module.exports = crearRouterAgenda("desarrollo-humano");
module.exports.crearRouterAgenda = crearRouterAgenda;
