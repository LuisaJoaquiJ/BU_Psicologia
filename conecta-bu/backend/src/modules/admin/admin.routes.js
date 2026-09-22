const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");

const router = Router();

// Endpoint de referencia para HU-05 / RNF-002: demuestra que las rutas
// administrativas quedan protegidas por autenticacion (401) y por rol (403).
// Los endpoints reales de horarios, eventos y usuarios se agregan en los
// siguientes sprints siguiendo este mismo patron (authMiddleware + requireRole).
router.get("/ping", authMiddleware, requireRole("Administrador"), (req, res) => {
  res.status(200).json({ message: "Acceso administrativo confirmado.", usuario: req.usuario.nombre });
});

module.exports = router;
