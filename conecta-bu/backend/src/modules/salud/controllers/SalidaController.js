const { BaseController } = require("./BaseController");
const { salidaService } = require("../services/SalidaService");
const { inscripcionSalidaService } = require("../services/InscripcionSalidaService");

// Salidas con inscripcion: personal de Salud y estudiantes.
class SalidaController extends BaseController {
  listar = async (req, res) => this.ok(res, { salidas: await salidaService.listar() });
  crear = async (req, res) => this.creado(res, { salida: await salidaService.crear(req.body, req.usuario) });
  obtener = async (req, res) => this.ok(res, { salida: await salidaService.obtener(req.params.id) });
  actualizar = async (req, res) => this.ok(res, { salida: await salidaService.actualizar(req.params.id, req.body) });
  cambiarEstado = async (req, res) => this.ok(res, { salida: await salidaService.cambiarEstado(req.params.id, req.body.estado) });
  eliminar = async (req, res) => this.ok(res, await salidaService.eliminar(req.params.id));
  inscripciones = async (req, res) => this.ok(res, { inscripciones: await salidaService.inscripciones(req.params.id) });
  revisar = async (req, res) => this.ok(res, { inscripcion: await salidaService.revisarInscripcion(req.params.id, req.params.inscripcionId, req.body, req.usuario) });

  comprobante = async (req, res) => {
    const { ruta, nombre } = await salidaService.comprobanteDe(req.params.id, req.params.inscripcionId);
    this.enviarArchivo(res, ruta, nombre);
  };

  listado = async (req, res) => {
    const { buffer, nombre } = await salidaService.listado(req.params.id, { todos: req.query.todos === "1" });
    this.archivo(res, buffer, nombre, "xlsx");
  };

  // ---- Estudiante ----
  paraEstudiante = async (req, res) => this.ok(res, await inscripcionSalidaService.paraEstudiante(req.usuario));
  inscribirse = async (req, res) => this.creado(res, { inscripcion: await inscripcionSalidaService.inscribirse(req.usuario, req.params.id, req.body, req.file) });
  cancelar = async (req, res) => this.ok(res, { inscripcion: await inscripcionSalidaService.cancelar(req.usuario, req.params.id) });
}

module.exports = { SalidaController, salidaController: new SalidaController() };
