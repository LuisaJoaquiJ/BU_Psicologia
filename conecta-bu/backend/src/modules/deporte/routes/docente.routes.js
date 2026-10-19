const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { manejar } = require("./manejar");
const c = require("../controllers/DocentePanelController");
const imagenService = require("../services/ImagenService");

// /api/v1/deporte/docente: panel del docente (RF-013 a RF-016, RN-004).
const docente = Router();
docente.use(authMiddleware, requireModulo("deporte-docente"));

docente.get("/inicio", manejar(c.inicio));
docente.get("/grupos/:id", manejar(c.grupo));
docente.post("/grupos/:id/sesiones", manejar(c.registrarSesion));
docente.put("/sesiones/:id", manejar(c.actualizarSesion));
docente.get("/alertas", manejar(c.alertas));
docente.post("/alertas", manejar(c.crearAlerta));
docente.post("/alertas/:id/imagen", c.exigirAlertaPropia, imagenService.recibirImagen("alertas"), manejar(c.subirFotoAlerta));
docente.delete("/alertas/:id/imagen", manejar(c.quitarFotoAlerta));

module.exports = docente;
