const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { requireFields } = require("../../common/validators/validate");
const {
  crear,
  listarAdmin,
  obtenerAdmin,
  actualizar,
  cambiarEstado,
  eliminar,
  inscritos,
  asistencia,
} = require("./eventos.controller");

const imagen = require("./eventos.imagen");

const router = Router();

// RN-008: la gestion de eventos y su asistencia es exclusiva del Administrador.
router.use(authMiddleware, requireModulo("desarrollo-humano"));

// RF-009
router.get("/", listarAdmin);
router.post(
  "/",
  requireFields(["nombre", "fecha", "horaInicio", "horaFin", "cupos", "fechaLimiteInscripcion"]),
  crear
);
router.get("/:id", obtenerAdmin);
router.patch("/:id", actualizar);
router.patch("/:id/estado", requireFields(["estado"]), cambiarEstado);
router.delete("/:id", eliminar);

// Foto del evento (opcional): una por evento; subir otra la reemplaza.
router.post("/:id/imagen", imagen.recibirImagen, async (req, res, next) => {
  try {
    const evento = await imagen.guardarImagen(req.params.id, req.file);
    res.status(200).json({ imagenUrl: imagen.urlImagen(evento) });
  } catch (err) {
    next(err);
  }
});
router.delete("/:id/imagen", async (req, res, next) => {
  try {
    await imagen.quitarImagen(req.params.id);
    res.status(200).json({ imagenUrl: null });
  } catch (err) {
    next(err);
  }
});

// RF-011 / RN-010
router.get("/:id/inscripciones", inscritos);
router.patch("/:id/inscripciones/:inscripcionId/asistencia", requireFields(["asistio"]), asistencia);

module.exports = router;
