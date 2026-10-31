const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole, requireModulo } = require("../../common/middlewares/roles.middleware");
const cultura = require("./cultura.service");
const { ipDe } = require("./catalogo");
const evidencia = require("./evidencia");

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const estudiante = Router();
estudiante.use(authMiddleware, requireRole("Estudiante"));
estudiante.get("/perfil", manejar(async (req, res) => res.json(await cultura.leerPerfil(req.usuario.id))));
estudiante.put("/perfil", manejar(async (req, res) => res.json(await cultura.guardarPerfil(req.usuario.id, req.body?.tipoSnies))));
estudiante.get("/grupos", manejar(async (req, res) => res.json(await cultura.ofertaGrupos(req.usuario.id))));
estudiante.post("/grupos/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.inscribirGrupo(req.usuario.id, req.params.id, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));
estudiante.delete("/grupos/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.retirarGrupo(req.usuario.id, req.params.id))));
estudiante.post("/grupos/:id/asistencia", manejar(async (req, res) => res.status(201).json(await cultura.marcarPropia(req.usuario.id, req.params.id, ipDe(req)))));
estudiante.get("/agenda", manejar(async (req, res) => res.json(await cultura.listarAgenda(req.usuario.id))));
estudiante.post("/agenda/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.inscribirEvento(req.usuario.id, req.params.id, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));
estudiante.delete("/agenda/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.cancelarEvento(req.usuario.id, req.params.id))));
estudiante.get("/convocatorias", manejar(async (req, res) => res.json(await cultura.listarConvocatorias(req.usuario.id))));
estudiante.post("/convocatorias/:id/postulacion", manejar(async (req, res) => res.status(201).json(await cultura.postular(req.usuario.id, req.params.id, req.body?.motivacion, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));

const admin = Router();
admin.use(authMiddleware, requireRole("Administrador"), requireModulo("cultura"));
admin.get("/areas", manejar(async (req, res) => res.json(await cultura.listarAreas())));
admin.get("/grupos", manejar(async (req, res) => res.json(await cultura.listarGruposAdmin(req.query.periodo))));
admin.post("/grupos", manejar(async (req, res) => res.status(201).json(await cultura.crearGrupo(req.body))));
admin.patch("/grupos/:id", manejar(async (req, res) => res.json(await cultura.editarGrupo(req.params.id, req.body))));
admin.post("/grupos/:id/asistencia", manejar(async (req, res) => res.json(await cultura.registrarAsistencia(req.params.id, req.body, req.usuario.emailInstitucional, ipDe(req)))));
admin.get("/informe", manejar(async (req, res) => {
  const buffer = await cultura.informeSnies();
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=\"SNIES-cultura.xlsx\"",
  });
  res.send(Buffer.from(buffer));
}));
admin.post("/evidencias", evidencia.recibir, manejar(evidencia.guardar));
admin.get("/agenda", manejar(async (req, res) => res.json(await cultura.listarEventosAdmin())));
admin.post("/agenda", manejar(async (req, res) => res.status(201).json(await cultura.crearEvento(req.body))));
admin.patch("/agenda/:id", manejar(async (req, res) => res.json(await cultura.editarEvento(req.params.id, req.body))));
admin.patch("/agenda/:id/asistencia", manejar(async (req, res) => res.json(await cultura.marcarAsistenciaEvento(req.params.id, req.body?.usuarioId, req.body?.asistio))));
admin.get("/convocatorias", manejar(async (req, res) => res.json(await cultura.listarConvocatoriasAdmin())));
admin.post("/convocatorias", manejar(async (req, res) => res.status(201).json(await cultura.crearConvocatoria(req.body))));
admin.patch("/convocatorias/:id", manejar(async (req, res) => res.json(await cultura.editarConvocatoria(req.params.id, req.body))));
admin.patch("/postulaciones/:id", manejar(async (req, res) => res.json(await cultura.resolverPostulacion(req.params.id, req.body?.estado))));

module.exports = { estudiante, admin };
