const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");

// HU-05 / RNF-002: confirma que las rutas del personal de Desarrollo Humano
// piden sesion (401) y acceso al modulo (403).
const router = Router();
router.get("/ping", authMiddleware, requireModulo("desarrollo-humano"), (req, res) => {
  res.status(200).json({ message: "Acceso administrativo confirmado.", usuario: req.usuario.nombre });
});

module.exports = router;
