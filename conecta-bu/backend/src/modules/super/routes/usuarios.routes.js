const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireRole } = require("../../../common/middlewares/roles.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { superController: c } = require("../controllers/SuperController");
const { manejar } = require("./manejar");

// RN-008 / RF-012: usuarios y roles, exclusivo del superadministrador
// (/api/v1/admin/usuarios).
const router = Router();
router.use(authMiddleware, requireRole("SuperAdministrador"));

router.get("/", manejar(c.usuarios));
router.patch("/:id/rol", requireFields(["rol"]), manejar(c.cambiarRol));
router.patch("/:id/estado", requireFields(["habilitado"]), manejar(c.cambiarEstado));

module.exports = router;
