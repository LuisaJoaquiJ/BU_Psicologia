const { Router } = require("express");
const { salidaController: c } = require("../controllers/SalidaController");
const { manejar } = require("./manejar");
const { fotoSalidaService } = require("../services/FotoSalidaService");

// Salidas con inscripcion de estudiantes (personal de Salud).
const router = Router();

router.get("/", manejar(c.listar));
router.post("/", manejar(c.crear));
router.get("/:id", manejar(c.obtener));
router.patch("/:id", manejar(c.actualizar));
router.patch("/:id/estado", manejar(c.cambiarEstado));
router.delete("/:id", manejar(c.eliminar));
router.get("/:id/inscripciones", manejar(c.inscripciones));
router.patch("/:id/inscripciones/:inscripcionId", manejar(c.revisar));
router.get("/:id/inscripciones/:inscripcionId/comprobante", manejar(c.comprobante));
router.get("/:id/listado", manejar(c.listado));
router.post("/:id/fotos", fotoSalidaService.recibir, manejar(c.subirFotos));
router.get("/:id/fotos/:fotoId/archivo", manejar(c.foto));
router.delete("/:id/fotos/:fotoId", manejar(c.eliminarFoto));

module.exports = router;
