const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { eventoController: c } = require("../controllers/EventoController");
const { manejar } = require("./manejar");
const { controlAsistenciaController: ca } = require("../controllers/ControlAsistenciaController");
const { requireFields } = require("../../../common/validators/validate");

// RF-010: eventos para el estudiante. La agenda pública y las fotos no
// piden sesión; lo demás sí (RNF-002), y cada quien solo ve lo suyo (RN-002).
const router = Router();

router.get("/publicos", manejar(c.publicos));
router.get("/:id/imagen", manejar(c.imagen));

router.use(authMiddleware);

router.post("/asistencia/escanear", requireFields(["codigo"]), manejar(ca.escanear));
router.get("/:id/asistencia/codigo", manejar(ca.obtenerParaEstudiante));

router.get("/", manejar(c.publicados));
router.get("/mis-inscripciones", manejar(c.misInscripciones));
router.get("/:id", manejar(c.detalle));
router.post("/:id/inscripciones", manejar(c.inscribirse));
router.patch("/:id/inscripciones/cancelar", manejar(c.cancelar));

module.exports = router;