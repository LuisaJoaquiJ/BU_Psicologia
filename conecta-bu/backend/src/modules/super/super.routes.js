const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const servicio = require("./super.service");

// Panel del superadministrador (/api/v1/super).
const router = Router();
router.use(authMiddleware, requireRole("SuperAdministrador"));

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

router.get("/resumen", manejar(async (req, res) => res.json(await servicio.resumen())));
router.get("/accesos", manejar(async (req, res) => res.json(await servicio.listarAccesos())));
router.post(
  "/accesos",
  requireFields(["email", "modulo"]),
  manejar(async (req, res) => res.status(201).json({ acceso: await servicio.asignarAcceso(req.body, req.usuario.emailInstitucional) }))
);
router.delete("/accesos/:id", manejar(async (req, res) => res.json(await servicio.quitarAcceso(req.params.id))));

module.exports = router;
