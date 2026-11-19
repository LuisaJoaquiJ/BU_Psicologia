const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { limiteAsistente } = require("../../../common/middlewares/rateLimit.middleware");
const { asistenteController: c } = require("../controllers/AsistenteController");
const { detectarCrisis } = require("../utils/asistenteCrisis");
const { manejar } = require("./manejar");

// RF-014: asistente de orientacion (requiere sesion, RNF-002).
const router = Router();
// Un mensaje de riesgo nunca se frena por el limite de preguntas (ni cuenta para el).
const limiteSalvoCrisis = (req, res, next) => (typeof req.body?.pregunta === "string" && detectarCrisis(req.body.pregunta) ? next() : limiteAsistente(req, res, next));
router.post("/consultas", authMiddleware, limiteSalvoCrisis, requireFields(["pregunta"]), manejar(c.consultar));

module.exports = router;
