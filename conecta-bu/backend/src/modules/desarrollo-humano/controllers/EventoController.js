const { BaseController } = require("./BaseController");
const { eventoService } = require("../services/EventoService");
const { eventoEstudianteService } = require("../services/EventoEstudianteService");
const { imagenEventoService } = require("../services/ImagenEventoService");
const automatizaciones = require("../../../integrations/automatizaciones");

// Eventos y talleres: personal (RF-009, RF-011) y estudiante (RF-010).
class EventoController extends BaseController {
  // ---- Personal ----
  crear = async (req, res) => {
    const evento = await eventoService.crear(req.body);
    this.creado(res, { evento });
    if (evento.estado === "Publicado") automatizaciones.eventoPublicado(evento); // RF-013
  };

  listarAdmin = async (req, res) => this.ok(res, { eventos: await eventoService.listar({ estado: req.query.estado }) });

  obtenerAdmin = async (req, res) => this.ok(res, { evento: await eventoService.obtener(req.params.id) });

  actualizar = async (req, res) => this.ok(res, { evento: await eventoService.actualizar(req.params.id, req.body) });

  cambiarEstado = async (req, res) => {
    const evento = await eventoService.cambiarEstado(req.usuario.id, req.params.id, req.body.estado);
    this.ok(res, { evento });
    if (evento.estado === "Publicado") automatizaciones.eventoPublicado(evento); // RF-013
  };

  eliminar = async (req, res) => {
    const confirmar = req.query.confirmar === "true" || req.body?.confirmar === true;
    this.ok(res, await eventoService.eliminar(req.params.id, confirmar));
  };

  inscritos = async (req, res) => this.ok(res, await eventoService.inscritos(req.params.id));

  asistencia = async (req, res) => {
    const { id: eventoId, inscripcionId } = req.params;
    this.ok(res, { inscripcion: await eventoService.registrarAsistencia(req.usuario.id, { eventoId, inscripcionId, asistio: req.body.asistio }) });
  };

  subirImagen = async (req, res) => this.ok(res, { imagenUrl: imagenEventoService.url(await imagenEventoService.guardar(req.params.id, req.file)) });

  quitarImagen = async (req, res) => {
    await imagenEventoService.quitar(req.params.id);
    this.ok(res, { imagenUrl: null });
  };

  // Foto publica (la usa <img>, que no envia la sesion).
  imagen = async (req, res) => {
    const ruta = await imagenEventoService.archivoDe(req.params.id);
    if (!ruta) return res.status(404).json({ message: "El evento no tiene imagen." });
    // helmet pone "Cross-Origin-Resource-Policy: same-origin"; es una imagen publica.
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "public, max-age=86400");
    res.sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: "No se encontró la imagen." });
    });
  };

  // ---- Estudiante ----
  publicados = async (req, res) => this.ok(res, { eventos: await eventoEstudianteService.publicados(req.usuario.id) });

  publicos = async (req, res) => this.ok(res, { eventos: await eventoEstudianteService.publicos() });

  detalle = async (req, res) => this.ok(res, { evento: await eventoEstudianteService.detalle(req.params.id, req.usuario.id) });

  inscribirse = async (req, res) => {
    const inscripcion = await eventoEstudianteService.inscribirse(req.usuario.id, req.params.id);
    this.creado(res, { inscripcion });
    automatizaciones.inscripcionEvento(req.usuario, inscripcion); // RF-013
  };

  cancelar = async (req, res) => {
    const inscripcion = await eventoEstudianteService.cancelar(req.usuario.id, req.params.id);
    this.ok(res, { inscripcion });
    automatizaciones.inscripcionCancelada(req.usuario, inscripcion); // RF-013
  };

  misInscripciones = async (req, res) => this.ok(res, { inscripciones: await eventoEstudianteService.mias(req.usuario.id) });
}

module.exports = { EventoController, eventoController: new EventoController() };
