const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { requireFields } = require("../../../common/validators/validate");
const { eventoController: c } = require("../controllers/EventoController");
const { imagenEventoService } = require("../services/ImagenEventoService");
const { manejar } = require("./manejar");
const { listaAsistentesController: la } = require("../controllers/ListaAsistentesController");
const { controlAsistenciaController: ca } = require("../controllers/ControlAsistenciaController");
// RN-008: la gestion de eventos y su asistencia es del personal de Desarrollo Humano.
const router = Router();
router.use(authMiddleware, requireModulo("desarrollo-humano"));

// RF-009
router.get("/", manejar(c.listarAdmin));
router.post("/", requireFields(["nombre", "fecha", "horaInicio", "horaFin", "cupos", "fechaLimiteInscripcion"]), manejar(c.crear));
router.get("/:id", manejar(c.obtenerAdmin));
router.patch("/:id", manejar(c.actualizar));
router.patch("/:id/estado", requireFields(["estado"]), manejar(c.cambiarEstado));
router.delete("/:id", manejar(c.eliminar));

// Foto del evento (opcional): una por evento; subir otra la reemplaza.
router.post("/:id/imagen", imagenEventoService.recibir, manejar(c.subirImagen));
router.delete("/:id/imagen", manejar(c.quitarImagen));

// RF-011 / RN-010
router.get("/:id/inscripciones", manejar(c.inscritos));
router.get("/:id/inscripciones/exportar", manejar(la.evento)); // ?formato=xlsx|pdf
router.patch("/:id/inscripciones/:inscripcionId/asistencia", requireFields(["asistio"]), manejar(c.asistencia));


// Asistencia por QR (interruptor y código rotativo)
router.get("/:id/asistencia", manejar(ca.obtener));
router.patch("/:id/asistencia", requireFields(["abierta"]), manejar(ca.cambiarAbierta));
router.post("/:id/asistencia/rotar", manejar(ca.rotarCodigo));

module.exports = router;
