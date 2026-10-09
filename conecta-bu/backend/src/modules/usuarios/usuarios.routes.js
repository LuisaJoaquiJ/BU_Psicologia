const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { listar, cambiarRol, cambiarEstado } = require("./usuarios.controller");

const router = Router();

// RN-008: la administracion de usuarios y roles es exclusiva del
// superadministrador de Conecta BU (controla todos los modulos).
router.use(authMiddleware, requireRole("SuperAdministrador"));

// RF-012
router.get("/", listar);
router.patch("/:id/rol", requireFields(["rol"]), cambiarRol);
router.patch("/:id/estado", requireFields(["habilitado"]), cambiarEstado);

module.exports = router;
