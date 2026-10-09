const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { crear, listar, actualizar, deshabilitar, habilitar } = require("./horarios.controller");
const bloqueos = require("./bloqueos.service");

const manejar =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };

// RN-008: la gestion de horarios es del personal de cada modulo. El mismo
// router se monta para Desarrollo humano (/admin/horarios) y para Salud
// integral (/salud/horarios); cada uno solo ve y edita sus servicios.
function crearRouterHorarios(modulo) {
  const router = Router();
  router.use(authMiddleware, requireModulo(modulo));

  // Tiempo no disponible (compromisos, incapacidad, permisos...).
  router.get(
    "/bloqueos",
    manejar(async (req) => ({ motivos: bloqueos.MOTIVOS, bloqueos: await bloqueos.listarBloqueos(req.modulo || modulo, req.query) })),
  );
  router.post(
    "/bloqueos/citas-afectadas",
    manejar(async (req) => ({ citas: await bloqueos.citasEnRango(req.body, req.modulo || modulo) })),
  );
  router.post(
    "/bloqueos",
    manejar((req) => bloqueos.crearBloqueo(req.body, req.usuario, req.modulo || modulo), 201),
  );
  router.delete(
    "/bloqueos/:id",
    manejar(async (req) => ({ bloqueo: await bloqueos.eliminarBloqueo(req.params.id, req.modulo || modulo) })),
  );

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
