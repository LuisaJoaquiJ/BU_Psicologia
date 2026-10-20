const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { estadisticaController: c } = require("../controllers/EstadisticaController");
const { manejar } = require("./manejar");

// Estadisticas de Desarrollo Humano: solo su personal.
const router = Router();
router.use(authMiddleware, requireModulo("desarrollo-humano"));

router.get("/", manejar(c.estadisticas)); // RF-015
router.get("/tablero", manejar(c.tablero));
router.get("/informe", manejar(c.informe)); // ?formato=xlsx|pdf
router.get("/automatizaciones", manejar(c.automatizaciones)); // RF-013

module.exports = router;
