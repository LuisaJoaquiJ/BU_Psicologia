const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole, requireModulo } = require("../../common/middlewares/roles.middleware");
const servicio = require("./deporte.service");
const { constanciaPdf, reporteExcel } = require("./deporte.archivos");
const { DIAS, TIPOS, periodoActual } = require("./deporte.util");

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

function enviar(res, buffer, nombre, tipo) {
  res.set({ "Content-Type": tipo, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
  res.status(200).send(buffer);
}
const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// /api/v1/deporte: area del estudiante (oferta, inscripciones y sus horas).
const router = Router();
router.use(authMiddleware);

router.get(
  "/oferta",
  requireRole("Estudiante"),
  manejar(async (req, res) => res.json(await servicio.oferta(req.usuario)))
);
router.post(
  "/grupos/:id/inscripcion",
  requireRole("Estudiante"),
  manejar(async (req, res) => {
    await servicio.inscribir(req.params.id, req.usuario.id);
    res.status(201).json(await servicio.oferta(req.usuario));
  })
);
router.delete(
  "/grupos/:id/inscripcion",
  requireRole("Estudiante"),
  manejar(async (req, res) => {
    await servicio.retirar(req.params.id, req.usuario.id);
    res.json(await servicio.oferta(req.usuario));
  })
);
router.get(
  "/mis-horas",
  requireRole("Estudiante"),
  manejar(async (req, res) => res.json({ ...(await servicio.progresoDe(req.usuario.id)), grupos: await servicio.misGrupos(req.usuario.id) }))
);
router.get(
  "/mis-horas/constancia",
  requireRole("Estudiante"),
  manejar(async (req, res) => enviar(res, await constanciaPdf(await servicio.detalleEstudiante(req.usuario.id)), "constancia-horas-deporte.pdf", PDF))
);

// /api/v1/deporte/admin: personal del modulo Deporte (instructores y coordinacion).
const admin = Router();
admin.use(authMiddleware, requireModulo("deporte"));

admin.get("/resumen", manejar(async (req, res) => res.json(await servicio.resumen())));
admin.get(
  "/catalogos",
  manejar(async (req, res) =>
    res.json({ dias: DIAS, tipos: TIPOS, periodoActual: periodoActual(), disciplinas: await servicio.listarDisciplinas({ incluirInactivas: true }), config: await servicio.obtenerConfig() })
  )
);
admin.put("/config", manejar(async (req, res) => res.json({ config: await servicio.guardarConfig(req.body) })));
admin.post("/disciplinas", manejar(async (req, res) => res.status(201).json({ disciplina: await servicio.crearDisciplina(req.body) })));
admin.patch("/disciplinas/:id", manejar(async (req, res) => res.json({ disciplina: await servicio.actualizarDisciplina(req.params.id, req.body) })));

admin.get("/grupos", manejar(async (req, res) => res.json(await servicio.listarGrupos(req.query))));
admin.post("/grupos", manejar(async (req, res) => res.status(201).json({ grupo: await servicio.crearGrupo(req.body) })));
admin.get("/grupos/:id", manejar(async (req, res) => res.json({ grupo: await servicio.detalleGrupo(req.params.id) })));
admin.patch("/grupos/:id", manejar(async (req, res) => res.json({ grupo: await servicio.actualizarGrupo(req.params.id, req.body) })));
admin.post("/grupos/:id/inscritos", manejar(async (req, res) => res.status(201).json({ grupo: await servicio.inscribirPorCorreo(req.params.id, req.body.email) })));
admin.delete(
  "/grupos/:id/inscritos/:usuarioId",
  manejar(async (req, res) => {
    await servicio.retirar(req.params.id, req.params.usuarioId);
    res.json({ grupo: await servicio.detalleGrupo(req.params.id) });
  })
);
admin.post("/grupos/:id/sesiones", manejar(async (req, res) => res.status(201).json({ grupo: await servicio.registrarSesion(req.params.id, req.body, req.usuario) })));
admin.put("/sesiones/:id", manejar(async (req, res) => res.json({ grupo: await servicio.actualizarSesion(req.params.id, req.body) })));
admin.delete("/sesiones/:id", manejar(async (req, res) => res.json({ grupo: await servicio.eliminarSesion(req.params.id) })));

admin.get("/estudiantes", manejar(async (req, res) => res.json(await servicio.listarEstudiantes(req.query))));
admin.get("/estudiantes/:id", manejar(async (req, res) => res.json(await servicio.detalleEstudiante(req.params.id))));
admin.post("/estudiantes/:id/horas", manejar(async (req, res) => res.status(201).json(await servicio.reconocerHoras(req.params.id, req.body, req.usuario.emailInstitucional))));
admin.delete("/horas/:id", manejar(async (req, res) => res.json(await servicio.eliminarHoras(req.params.id))));
admin.get(
  "/estudiantes/:id/constancia",
  manejar(async (req, res) => enviar(res, await constanciaPdf(await servicio.detalleEstudiante(req.params.id)), "constancia-horas-deporte.pdf", PDF))
);
admin.get(
  "/reporte",
  manejar(async (req, res) => {
    const datos = await servicio.datosReporte(req.query);
    enviar(res, await reporteExcel(datos), `deporte-horas-${datos.periodo}.xlsx`, XLSX);
  })
);

module.exports = { router, admin };
