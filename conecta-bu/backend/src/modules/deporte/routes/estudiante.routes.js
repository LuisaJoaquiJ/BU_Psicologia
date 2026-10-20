const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { manejar } = require("./manejar");
const c = require("../controllers/MiDeporteController");

// /api/v1/deporte: area del estudiante (oferta, inscripciones, horas, eventos y avisos).
const router = Router();
router.use(authMiddleware, requireRole("Estudiante"));

router.get("/oferta", manejar(c.oferta));
router.post("/grupos/:id/inscripcion", manejar(c.inscribir));
router.delete("/grupos/:id/inscripcion", manejar(c.retirar));
router.get("/mis-horas", manejar(c.misHoras));
router.get("/mis-horas/constancia", manejar(c.constancia));

// Eventos deportivos (RF-018, RF-020) y comunicados (RF-011).
router.get("/eventos", manejar(c.eventos));
router.post("/eventos/:id/inscripcion", manejar(c.inscribirEvento));
router.delete("/eventos/:id/inscripcion", manejar(c.cancelarEvento));
router.get("/avisos", manejar(c.avisos));

module.exports = router;
