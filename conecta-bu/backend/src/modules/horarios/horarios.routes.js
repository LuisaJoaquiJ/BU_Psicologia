const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { crear, listar, actualizar, deshabilitar, habilitar } = require("./horarios.controller");

// RN-008: la gestion de horarios es del personal de cada modulo. El mismo
// router se monta para Desarrollo humano (/admin/horarios) y para Salud
// integral (/salud/horarios); cada uno solo ve y edita sus servicios.
function crearRouterHorarios(modulo) {
  const router = Router();
  router.use(authMiddleware, requireModulo(modulo));

  // RF-007 / HU-13
  router.post("/", requireFields(["servicioId", "fecha", "horaInicio", "horaFin"]), crear);
  // RF-007 / HU-13, HU-14
  router.get("/", listar);
  // RF-007 / HU-14
  router.patch("/:id", actualizar);
  router.patch("/:id/deshabilitar", deshabilitar);
  router.patch("/:id/habilitar", habilitar);
  return router;
}

module.exports = crearRouterHorarios("desarrollo-humano");
module.exports.crearRouterHorarios = crearRouterHorarios;
