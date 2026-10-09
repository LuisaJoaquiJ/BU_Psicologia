const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const servicio = require("./super.service");
const informes = require("../salud/informe.service");
const { estadisticas } = require("./super.estadisticas");

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
// Tablero con las cifras de todos los modulos (?meses=3|6|12).
router.get("/estadisticas", manejar(async (req, res) => res.json(await estadisticas(req.query))));
router.get("/accesos", manejar(async (req, res) => res.json(await servicio.listarAccesos())));
router.post(
  "/accesos",
  requireFields(["email", "modulo"]),
  manejar(async (req, res) => res.status(201).json({ acceso: await servicio.asignarAcceso(req.body, req.usuario.emailInstitucional) }))
);
router.delete("/accesos/:id", manejar(async (req, res) => res.json(await servicio.quitarAcceso(req.params.id))));

// Informes de gestion que envian los modulos.
router.get("/informes", manejar(async (req, res) => res.json({ informes: await informes.listarRecibidos(req.query) })));
router.get(
  "/informes/:id/archivo",
  manejar(async (req, res) => {
    const { buffer, nombre, tipo } = await informes.descargarRecibido(req.params.id, req.query.formato || "pdf");
    res.set({ "Content-Type": tipo, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
    res.status(200).send(Buffer.from(buffer));
  })
);
router.patch("/informes/:id", manejar(async (req, res) => res.json({ informe: await informes.revisarComoSuper(req.params.id, req.body, req.usuario) })));

module.exports = router;
