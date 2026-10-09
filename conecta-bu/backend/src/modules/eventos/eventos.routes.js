const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const {
  listarPublicados,
  proximosPublicos,
  detalle,
  inscribirse,
  cancelar,
  misInscripciones,
} = require("./eventos.controller");

const { prisma } = require("../../config/prisma");
const { rutaDe } = require("./eventos.imagen");

const router = Router();

// Pagina de inicio publica: agenda de difusion, sin datos personales.
router.get("/publicos", proximosPublicos);

// Foto del evento: publica (se usa en <img>, que no envia la sesion).
router.get("/:id/imagen", async (req, res, next) => {
  try {
    const evento = await prisma.evento.findUnique({ where: { id: req.params.id } });
    const ruta = rutaDe(evento?.imagen);
    if (!ruta) return res.status(404).json({ message: "El evento no tiene imagen." });
    // helmet pone "Cross-Origin-Resource-Policy: same-origin": si el frontend
    // corre en otro puerto (VITE_API_URL=http://localhost:4000/...), el
    // navegador bloquearia la foto. Es una imagen publica, se permite.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: "No se encontró la imagen." });
    });
  } catch (err) {
    next(err);
  }
});

// RF-010: consulta e inscripcion a eventos. Requiere sesion (RNF-002); cada
// estudiante solo ve y gestiona sus propias inscripciones (RN-002).
router.use(authMiddleware);

router.get("/", listarPublicados);
router.get("/mis-inscripciones", misInscripciones);
router.get("/:id", detalle);

// RN-006 / RN-007
router.post("/:id/inscripciones", inscribirse);
router.patch("/:id/inscripciones/cancelar", cancelar);

module.exports = router;
