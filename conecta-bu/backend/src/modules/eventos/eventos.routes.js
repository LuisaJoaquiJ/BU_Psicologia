const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const {
  listarPublicados,
  proximosPublicos,
  detalle,
  inscribirse,
  cancelar,
  misInscripciones,
} = require("./eventos.controller");

const router = Router();

// Pagina de inicio publica: agenda de difusion, sin datos personales.
router.get("/publicos", proximosPublicos);

// RF-010: consulta e inscripcion a eventos. Requiere sesion (RNF-002); cada
// estudiante solo ve y gestiona sus propias inscripciones (RN-002).
router.use(authMiddleware);

router.get("/", listarPublicados);
router.get("/mis-inscripciones", misInscripciones);
router.get("/:id", detalle);

// RN-006 / RN-007
router.post("/:id/inscripciones", inscribirse);
router.patch("/:id/inscripciones/cancelar", cancelar);

module.exports = router;
