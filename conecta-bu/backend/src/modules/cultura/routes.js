const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireRole, requireModulo } = require("../../common/middlewares/roles.middleware");
const cultura = require("./cultura.service");
const ampliacion = require("./ampliacion");
const { ipDe } = require("./catalogo");
const evidencia = require("./evidencia");
const asistencia = require("./asistencia");
const imagen = require("./imagen");
const logistica = require("./logistica");
const informeCultura = require("./informe/servicio");
const area = ampliacion.exigir("administrador");
const taller = ampliacion.exigir("administrador", "docente");
const cualquiera = ampliacion.exigir("administrador", "docente", "monitor");
const delGrupo = ampliacion.sobreGrupo(["administrador", "docente", "monitor"]); // asistencia: monitor en los suyos
const delGrupoDirigido = ampliacion.sobreGrupo(["administrador", "docente"]); // ubicacion y fotos: quien dirige
const delEvento = ampliacion.sobreEvento(["administrador", "docente", "monitor"]);
const dePostulacion = ampliacion.sobrePostulacion();

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

function enviarPdf(res, buffer) {
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=\"listado-asistencia.pdf\"", "Cache-Control": "no-store" });
  res.send(buffer);
}

const estudiante = Router();
estudiante.use(authMiddleware, requireRole("Estudiante"));
estudiante.get("/perfil", manejar(async (req, res) => res.json(await cultura.leerPerfil(req.usuario.id))));
estudiante.put("/perfil", manejar(async (req, res) => res.json(await cultura.guardarPerfil(req.usuario.id, req.body || {}))));
estudiante.get("/grupos", manejar(async (req, res) => res.json(await cultura.ofertaGrupos(req.usuario.id))));
estudiante.post("/grupos/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.inscribirGrupo(req.usuario.id, req.params.id, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));
estudiante.delete("/grupos/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.retirarGrupo(req.usuario.id, req.params.id))));
estudiante.post("/asistencia/ubicacion", manejar(async (req, res) => res.status(201).json(await asistencia.marcarPorUbicacion(req.usuario.id, req.body, ipDe(req)))));
estudiante.post("/asistencia", manejar(async (req, res) => res.status(201).json(await asistencia.marcarConCodigo(req.usuario.id, req.body?.codigo, ipDe(req)))));
estudiante.get("/agenda", manejar(async (req, res) => res.json(await cultura.listarAgenda(req.usuario.id))));
estudiante.post("/agenda/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.inscribirEvento(req.usuario.id, req.params.id, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));
estudiante.delete("/agenda/:id/inscripcion", manejar(async (req, res) => res.json(await cultura.cancelarEvento(req.usuario.id, req.params.id))));
estudiante.get("/convocatorias", manejar(async (req, res) => res.json(await cultura.listarConvocatorias(req.usuario.id))));
estudiante.post("/convocatorias/:id/postulacion", manejar(async (req, res) => res.status(201).json(await cultura.postular(req.usuario.id, req.params.id, req.body?.motivacion, { tipoSnies: req.body?.tipoSnies, ip: ipDe(req) }))));

const admin = Router();
admin.use(authMiddleware, requireRole("Administrador"), requireModulo("cultura"));
// Rol del personal en el area: el panel muestra solo lo que su rol permite.
admin.get("/mi-rol", manejar(async (req, res) => res.json({ rol: await ampliacion.rolDe(req.usuario.emailInstitucional) })));
admin.get("/programas", manejar(async (req, res) => res.json(await cultura.listarProgramas())));
admin.get("/areas", manejar(async (req, res) => res.json(await cultura.listarAreas())));
admin.get("/grupos", cualquiera, manejar(async (req, res) => res.json(ampliacion.soloLosSuyos(await cultura.listarGruposAdmin(req.query.periodo), req))));
admin.post("/grupos", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearGrupoConResponsables(cultura.crearGrupo, req.body, req.usuario.emailInstitucional))));
admin.post("/grupos/:id/imagen", delGrupoDirigido, imagen.grupos.recibir, manejar(async (req, res) => res.json(await imagen.grupos.guardar(req.params.id, req.file))));
admin.delete("/grupos/:id/imagen", delGrupoDirigido, manejar(async (req, res) => res.json(await imagen.grupos.quitar(req.params.id))));
admin.patch("/grupos/:id", area, manejar(async (req, res) => res.json(await cultura.editarGrupo(req.params.id, req.body))));
admin.post("/grupos/:id/asistencia", delGrupo, manejar(async (req, res) => res.json(await cultura.registrarAsistencia(req.params.id, req.body, req.usuario.emailInstitucional, ipDe(req)))));
admin.put("/grupos/:id/ubicacion", delGrupoDirigido, manejar(async (req, res) => res.json(await asistencia.ubicacionGrupo(req.params.id, req.body))));
admin.put("/agenda/:id/ubicacion", area, manejar(async (req, res) => res.json(await asistencia.ubicacionEvento(req.params.id, req.body))));
admin.post("/grupos/:id/asistencia/abrir", delGrupo, manejar(async (req, res) => res.json(await asistencia.abrirGrupo(req.params.id, req.usuario.emailInstitucional))));
admin.post("/grupos/:id/asistencia/cerrar", delGrupo, manejar(async (req, res) => res.json(await asistencia.cerrarGrupo(req.params.id))));
admin.put("/grupos/:id/conteos", delGrupo, manejar(async (req, res) => res.json(await asistencia.conteosGrupo(req.params.id, req.body, req.usuario.emailInstitucional))));
admin.get("/grupos/:id/listado", delGrupo, manejar(async (req, res) => enviarPdf(res, await asistencia.listadoGrupo(req.params.id, req.query.fecha))));
admin.post("/agenda/:id/asistencia/abrir", delEvento, manejar(async (req, res) => res.json(await asistencia.abrirEvento(req.params.id))));
admin.post("/agenda/:id/asistencia/cerrar", delEvento, manejar(async (req, res) => res.json(await asistencia.cerrarEvento(req.params.id))));
admin.put("/agenda/:id/conteos", delEvento, manejar(async (req, res) => res.json(await asistencia.conteosEvento(req.params.id, req.body))));
admin.get("/agenda/:id/listado", delEvento, manejar(async (req, res) => enviarPdf(res, await asistencia.listadoEvento(req.params.id))));
admin.get("/inscritos", taller, manejar(async (req, res) => res.json(await ampliacion.buscarInscritos(req.query.q))));
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
admin.get("/historico", taller, manejar(async (req, res) => res.json(await ampliacion.historico(req.query))));
admin.get("/evidencias", taller, manejar(async (req, res) => res.json(await evidencia.listar(req.query))));
admin.get("/evidencias/:id/archivo", taller, manejar(async (req, res) => {
  const { absoluta, evidencia: fila } = await evidencia.archivo(req.params.id);
  res.type(fila.mime);
  res.sendFile(absoluta);
}));
admin.post("/evidencias", taller, evidencia.recibir, manejar(evidencia.guardar));
admin.delete("/evidencias/:id", area, manejar(async (req, res) => {
  await evidencia.eliminar(req.params.id);
  res.json({ ok: true });
}));
admin.get("/representaciones", area, manejar(async (req, res) => res.json(await ampliacion.listarRepresentaciones(req.query))));
admin.post("/representaciones", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearRepresentacion(req.body, req.usuario.emailInstitucional))));
admin.patch("/representaciones/:id", area, manejar(async (req, res) => res.json(await ampliacion.reconocer(req.params.id, req.body?.posicion))));
admin.get("/pausas", manejar(async (req, res) => res.json(await ampliacion.listarPausas())));
admin.post("/pausas", taller, manejar(async (req, res) => res.status(201).json(await ampliacion.crearPausa(req.body, req.usuario.emailInstitucional))));
admin.get("/apoyo", area, manejar(async (req, res) => res.json(await ampliacion.listarSolicitudes())));
admin.post("/apoyo", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearSolicitud(req.body, req.usuario.emailInstitucional))));
admin.patch("/apoyo/:id", area, manejar(async (req, res) => res.json(await ampliacion.asignarSolicitud(req.params.id, req.body || {}))));
admin.get("/equipo", area, manejar(async (req, res) => res.json(await ampliacion.listarEquipo())));
admin.get("/informe-gestion", area, manejar(async (req, res) => res.json(await informeCultura.listar())));
admin.get("/informe-gestion/:periodo", area, manejar(async (req, res) => res.json(await informeCultura.obtener(req.params.periodo))));
admin.put("/informe-gestion/:periodo", area, manejar(async (req, res) => res.json(await informeCultura.guardar(req.params.periodo, req.body))));
admin.post("/informe-gestion/:periodo/enviar", area, manejar(async (req, res) => res.json(await informeCultura.enviar(req.params.periodo, req.usuario))));
admin.get("/informe-gestion/:periodo/archivo", area, manejar(async (req, res) => {
  const { buffer, nombre, tipo } = await informeCultura.descargar(req.params.periodo, req.query.formato);
  res.set({ "Content-Type": tipo, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
  res.send(buffer);
}));
admin.post("/equipo", area, manejar(async (req, res) => res.status(201).json(await ampliacion.agregarPersona(req.body, req.usuario.emailInstitucional))));
admin.delete("/equipo/:email", area, manejar(async (req, res) => res.json(await ampliacion.quitarPersona(req.params.email, req.usuario.emailInstitucional))));
admin.put("/agenda/:id/responsables", area, manejar(async (req, res) => res.json(await ampliacion.fijarResponsablesEvento(req.params.id, req.body, { actor: req.usuario.emailInstitucional }))));
admin.put("/grupos/:id/responsables", area, manejar(async (req, res) => res.json(await ampliacion.fijarResponsables(req.params.id, req.body, { actor: req.usuario.emailInstitucional }))));
admin.put("/equipo", area, manejar(async (req, res) => res.json(await ampliacion.asignarRol(req.body?.email, req.body?.rol))));
// Inventario con prestamos y pendientes de logistica.
admin.get("/inventario", manejar(async (req, res) => res.json(await logistica.listarInventario())));
admin.post("/inventario", taller, manejar(async (req, res) => res.status(201).json(await logistica.crearArticulo(req.body || {}))));
admin.patch("/inventario/:id", taller, manejar(async (req, res) => res.json(await logistica.actualizarArticulo(req.params.id, req.body || {}))));
admin.post("/inventario/:id/prestamos", manejar(async (req, res) => res.status(201).json(await logistica.prestar(req.params.id, req.body || {}, req.usuario.emailInstitucional))));
admin.post("/prestamos/:id/devolucion", manejar(async (req, res) => res.json(await logistica.devolver(req.params.id, req.body || {}))));
admin.get("/pendientes", manejar(async (req, res) => res.json(await logistica.listarPendientes())));
admin.post("/pendientes", manejar(async (req, res) => res.status(201).json(await logistica.crearPendiente(req.body || {}, req.usuario.emailInstitucional))));
admin.patch("/pendientes/:id", manejar(async (req, res) => res.json(await logistica.actualizarPendiente(req.params.id, req.body || {}))));
admin.delete("/pendientes/:id", taller, manejar(async (req, res) => res.json(await logistica.borrarPendiente(req.params.id))));
admin.get("/agenda", cualquiera, manejar(async (req, res) => res.json(await ampliacion.conPermisoDeOperar(await cultura.listarEventosAdmin(), req))));
admin.post("/agenda", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearEventoConResponsables(cultura.crearEvento, req.body, req.usuario.emailInstitucional))));
admin.patch("/agenda/:id", area, manejar(async (req, res) => res.json(await ampliacion.editarEventoYAvisar(cultura.editarEvento, req.params.id, req.body))));
admin.post("/agenda/:id/imagen", area, imagen.recibir, manejar(async (req, res) => res.json(await imagen.guardar(req.params.id, req.file))));
admin.delete("/agenda/:id/imagen", area, manejar(async (req, res) => res.json(await imagen.quitar(req.params.id))));
admin.patch("/agenda/:id/asistencia", delEvento, manejar(async (req, res) => res.json(await cultura.marcarAsistenciaEvento(req.params.id, req.body?.usuarioId, req.body?.asistio))));
admin.get("/convocatorias", cualquiera, manejar(async (req, res) => res.json(await ampliacion.conPermisoDeDecidir(await cultura.listarConvocatoriasAdmin(), req))));
admin.post("/convocatorias", area, manejar(async (req, res) => res.status(201).json(await ampliacion.crearConvocatoriaYAvisar(cultura.crearConvocatoria, req.body))));
admin.post("/convocatorias/:id/imagen", area, imagen.convocatorias.recibir, manejar(async (req, res) => res.json(await imagen.convocatorias.guardar(req.params.id, req.file))));
admin.delete("/convocatorias/:id/imagen", area, manejar(async (req, res) => res.json(await imagen.convocatorias.quitar(req.params.id))));
admin.patch("/convocatorias/:id", area, manejar(async (req, res) => res.json(await cultura.editarConvocatoria(req.params.id, req.body))));
admin.patch("/postulaciones/:id", dePostulacion, manejar(async (req, res) => res.json(await cultura.resolverPostulacion(req.params.id, req.body?.estado, req.body?.observacion))));
admin.patch("/postulaciones/:id/audicion", dePostulacion, manejar(async (req, res) => res.json(await cultura.citarPostulacion(req.params.id, req.body))));

// Agenda del portal: sin sesion.
const publico = Router();
publico.get("/agenda", manejar(async (req, res) => res.json(await cultura.agendaPublica())));
publico.get("/imagenes/eventos/:id", manejar(imagen.servir));
publico.get("/imagenes/convocatorias/:id", manejar(imagen.convocatorias.servir));
publico.get("/imagenes/grupos/:id", manejar(imagen.grupos.servir));

module.exports = { estudiante, admin, publico };
