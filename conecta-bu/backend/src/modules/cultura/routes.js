const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole, requireModulo } = require("../../common/middlewares/roles.middleware");
const cultura = require("./cultura.service");
const ampliacion = require("./ampliacion");
const { ipDe } = require("./catalogo");
const evidencia = require("./evidencia");
const area = ampliacion.exigir("administrador");
const taller = ampliacion.exigir("administrador", "docente");

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
estudiante.put("/perfil", manejar(async (req, res) => res.json(await cultura.guardarPerfil(req.usuario.id, req.body || {}))));
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
admin.post("/grupos", area, manejar(async (req, res) => res.status(201).json(await cultura.crearGrupo(req.body))));
admin.patch("/grupos/:id", area, manejar(async (req, res) => res.json(await cultura.editarGrupo(req.params.id, req.body))));
admin.post("/grupos/:id/asistencia", manejar(async (req, res) => res.json(await cultura.registrarAsistencia(req.params.id, req.body, req.usuario.emailInstitucional, ipDe(req)))));
admin.get("/inscritos", manejar(async (req, res) => res.json(await ampliacion.buscarInscritos(req.query.q))));
admin.get("/informe", area, manejar(async (req, res) => {
  const salida = await cultura.informeSnies(req.query);
  if (req.query.formato === "csv") {
    res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"SNIES-cultura.csv\"" });
    return res.send(salida);
  }
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=\"SNIES-cultura.xlsx\"",
  });
  res.send(Buffer.from(salida));
}));
admin.get("/registro-calificado", area, manejar(async (req, res) => res.json(await ampliacion.registroCalificado(req.query))));
admin.get("/inclusion", area, manejar(async (req, res) => res.json(await ampliacion.inclusion(req.query))));
admin.get("/historico", manejar(async (req, res) => res.json(await ampliacion.historico(req.query))));
admin.get("/evidencias", manejar(async (req, res) => res.json(await evidencia.listar(req.query))));
admin.get("/evidencias/:id/archivo", manejar(async (req, res) => {
  const { absoluta, evidencia: fila } = await evidencia.archivo(req.params.id);
  res.type(fila.mime);
  res.sendFile(absoluta);
}));
admin.post("/evidencias", evidencia.recibir, manejar(evidencia.guardar));
admin.get("/representaciones", area, manejar(async (req, res) => res.json(await ampliacion.listarRepresentaciones(req.query))));
admin.post("/representaciones", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearRepresentacion(req.body, req.usuario.emailInstitucional))));
admin.patch("/representaciones/:id", area, manejar(async (req, res) => res.json(await ampliacion.reconocer(req.params.id, req.body?.posicion))));
admin.get("/pausas", manejar(async (req, res) => res.json(await ampliacion.listarPausas())));
admin.post("/pausas", taller, manejar(async (req, res) => res.status(201).json(await ampliacion.crearPausa(req.body, req.usuario.emailInstitucional))));
admin.get("/apoyo", area, manejar(async (req, res) => res.json(await ampliacion.listarSolicitudes())));
admin.post("/apoyo", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearSolicitud(req.body, req.usuario.emailInstitucional))));
admin.patch("/apoyo/:id", area, manejar(async (req, res) => res.json(await ampliacion.asignarSolicitud(req.params.id, req.body || {}))));
admin.get("/equipo", area, manejar(async (req, res) => res.json(await ampliacion.listarEquipo())));
admin.put("/equipo", area, manejar(async (req, res) => res.json(await ampliacion.asignarRol(req.body?.email, req.body?.rol))));
admin.get("/agenda", manejar(async (req, res) => res.json(await cultura.listarEventosAdmin())));
admin.post("/agenda", manejar(async (req, res) => res.status(201).json(await cultura.crearEvento(req.body))));
admin.patch("/agenda/:id", manejar(async (req, res) => res.json(await cultura.editarEvento(req.params.id, req.body))));
admin.patch("/agenda/:id/asistencia", manejar(async (req, res) => res.json(await cultura.marcarAsistenciaEvento(req.params.id, req.body?.usuarioId, req.body?.asistio))));
admin.get("/convocatorias", manejar(async (req, res) => res.json(await cultura.listarConvocatoriasAdmin())));
admin.post("/convocatorias", manejar(async (req, res) => res.status(201).json(await cultura.crearConvocatoria(req.body))));
admin.patch("/convocatorias/:id", manejar(async (req, res) => res.json(await cultura.editarConvocatoria(req.params.id, req.body))));
admin.patch("/postulaciones/:id", manejar(async (req, res) => res.json(await cultura.resolverPostulacion(req.params.id, req.body?.estado))));

module.exports = { estudiante, admin };
