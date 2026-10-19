const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { estudianteController: e } = require("../controllers/EstudianteController");
const { salidaController: s } = require("../controllers/SalidaController");
const { comprobanteService } = require("../services/ComprobanteService");
const { manejar } = require("./manejar");

// Area del estudiante en Salud integral (/api/v1/salud/estudiante): sus
// participaciones y las salidas publicadas por la Unidad de Salud.
const router = Router();
const soloEstudiante = [authMiddleware, requireRole("Estudiante")];

router.get("/mis-participaciones", soloEstudiante, manejar(e.participaciones));
router.get("/salidas", soloEstudiante, manejar(s.paraEstudiante));
router.post("/salidas/:id/inscripcion", soloEstudiante, comprobanteService.recibir, manejar(s.inscribirse));
router.patch("/salidas/:id/inscripcion/cancelar", soloEstudiante, manejar(s.cancelar));

module.exports = router;
