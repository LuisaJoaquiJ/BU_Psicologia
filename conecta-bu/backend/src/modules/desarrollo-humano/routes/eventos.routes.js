const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { eventoController: c } = require("../controllers/EventoController");
const { manejar } = require("./manejar");

// RF-010: eventos para el estudiante. La agenda publica y las fotos no
// piden sesion; lo demas si (RNF-002), y cada quien solo ve lo suyo (RN-002).
const router = Router();
router.get("/publicos", manejar(c.publicos));
router.get("/:id/imagen", manejar(c.imagen));

router.use(authMiddleware);
router.get("/", manejar(c.publicados));
router.get("/mis-inscripciones", manejar(c.misInscripciones));
router.get("/:id", manejar(c.detalle));
router.post("/:id/inscripciones", manejar(c.inscribirse)); // RN-006 / RN-007
router.patch("/:id/inscripciones/cancelar", manejar(c.cancelar));

module.exports = router;
