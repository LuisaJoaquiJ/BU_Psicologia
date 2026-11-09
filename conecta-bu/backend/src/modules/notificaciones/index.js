const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const servicio = require("./service");

// /api/v1/notificaciones: las de la persona que inicio sesion (cualquier rol).
const router = Router();
router.use(authMiddleware);

const manejar = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    next(err);
  }
};

router.get("/", manejar((req) => servicio.listar(req.usuario.id, { soloNoLeidas: req.query.soloNoLeidas === "1", limite: req.query.limite, pagina: req.query.pagina })));
router.get("/resumen", manejar(async (req) => ({ noLeidas: await servicio.contarNoLeidas(req.usuario.id) })));
router.post("/leer-todas", manejar((req) => servicio.marcarTodas(req.usuario.id)));
router.patch("/:id/leida", manejar((req) => servicio.marcarLeida(req.usuario.id, req.params.id)));
router.delete("/:id", manejar((req) => servicio.eliminar(req.usuario.id, req.params.id)));

module.exports = { router, ...servicio };
