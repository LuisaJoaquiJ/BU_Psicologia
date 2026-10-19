const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { limiteAsistente } = require("../../../common/middlewares/rateLimit.middleware");
const { asistenteController: c } = require("../controllers/AsistenteController");
const { manejar } = require("./manejar");

// RF-014: asistente de orientacion (requiere sesion, RNF-002).
const router = Router();
router.post("/consultas", authMiddleware, limiteAsistente, requireFields(["pregunta"]), manejar(c.consultar));

module.exports = router;
