const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { listar } = require("./servicios.controller");

const router = Router();

// RF-003 / HU-06: cualquier usuario autenticado puede consultar los servicios.
router.get("/", authMiddleware, listar);

module.exports = router;
