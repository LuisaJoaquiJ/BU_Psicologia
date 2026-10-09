const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const { crear, listar, actualizar, deshabilitar, habilitar } = require("./horarios.controller");

const router = Router();

// RN-008: toda la gestion de horarios es exclusiva del rol Administrador.
router.use(authMiddleware, requireRole("Administrador"));

// RF-007 / HU-13
router.post("/", requireFields(["servicioId", "fecha", "horaInicio", "horaFin"]), crear);

// RF-007 / HU-13, HU-14
router.get("/", listar);

// RF-007 / HU-14
router.patch("/:id", actualizar);
router.patch("/:id/deshabilitar", deshabilitar);
router.patch("/:id/habilitar", habilitar);

module.exports = router;
