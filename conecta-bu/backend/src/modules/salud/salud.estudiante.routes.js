const { Router } = require("express");
const { prisma } = require("../../config/prisma");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole } = require("../../common/middlewares/roles.middleware");
const { CATEGORIAS } = require("./catalogos");
const salidas = require("./salidas.service");

// Vista del estudiante en Salud integral: sus participaciones en
// actividades (sin datos clinicos). Se asocia por el correo institucional
// registrado en la Unidad de Salud.
const router = Router();

router.get("/mis-participaciones", authMiddleware, requireRole("Estudiante"), async (req, res, next) => {
  try {
    const persona = await prisma.personaSalud.findFirst({ where: { correo: req.usuario.emailInstitucional.toLowerCase() } });
    if (!persona) return res.json({ vinculado: false, participaciones: [] });
    const atenciones = await prisma.atencionSalud.findMany({
      where: { personaId: persona.id },
      include: { actividad: true },
      orderBy: { fecha: "desc" },
      take: 50,
    });
    res.json({
      vinculado: true,
      participaciones: atenciones.map((a) => ({
        id: a.id,
        fecha: a.fecha,
        actividad: a.actividad?.nombre,
        categoria: CATEGORIAS[a.actividad?.categoria] || null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Salidas publicadas por la Unidad de Salud: el estudiante las ve y se inscribe.
const soloEstudiante = [authMiddleware, requireRole("Estudiante")];
router.get("/salidas", soloEstudiante, async (req, res, next) => {
  try {
    res.json(await salidas.salidasParaEstudiante(req.usuario));
  } catch (err) {
    next(err);
  }
});
router.post("/salidas/:id/inscripcion", soloEstudiante, salidas.recibirComprobante, async (req, res, next) => {
  try {
    res.status(201).json({ inscripcion: await salidas.inscribirse(req.usuario, req.params.id, req.body, req.file) });
  } catch (err) {
    next(err);
  }
});
router.patch("/salidas/:id/inscripcion/cancelar", soloEstudiante, async (req, res, next) => {
  try {
    res.json({ inscripcion: await salidas.cancelarInscripcion(req.usuario, req.params.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
