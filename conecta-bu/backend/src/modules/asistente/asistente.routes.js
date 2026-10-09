const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireFields } = require("../../common/validators/validate");
const { responderConsulta } = require("./asistente.service");

const router = Router();

// RF-014: asistente de orientacion (requiere sesion, RNF-002).
router.post("/consultas", authMiddleware, requireFields(["pregunta"]), async (req, res, next) => {
  try {
    const resultado = await responderConsulta(req.usuario, req.body.pregunta);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
