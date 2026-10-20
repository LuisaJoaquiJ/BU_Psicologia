const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { citaController: c } = require("../controllers/CitaController");
const { manejar } = require("./manejar");

// RF-003 / HU-06: servicios de Desarrollo Humano (cualquier usuario con sesion).
const router = Router();
router.get("/", authMiddleware, manejar(c.servicios));

module.exports = router;
