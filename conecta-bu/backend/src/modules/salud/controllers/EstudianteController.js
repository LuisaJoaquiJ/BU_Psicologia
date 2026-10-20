const { BaseController } = require("./BaseController");
const { jornadaService } = require("../services/JornadaService");
const { CATEGORIAS } = require("../utils/catalogos");
const { personaService } = require("../services/PersonaService");

// Vista del estudiante en Salud integral: sus participaciones (sin datos
// clinicos), asociadas por el correo registrado en la Unidad de Salud.
class EstudianteController extends BaseController {
  jornadas = async (req, res) => this.ok(res, await jornadaService.paraEstudiante(req.usuario));
  inscribirseJornada = async (req, res) => this.creado(res, await jornadaService.inscribirse(req.params.id, req.usuario, req.body || {}));
  cancelarJornada = async (req, res) => this.ok(res, await jornadaService.cancelar(req.params.id, req.usuario));
  participaciones = async (req, res) => this.ok(res, await personaService.participacionesDe(req.usuario.emailInstitucional, CATEGORIAS));
}

module.exports = { EstudianteController, estudianteController: new EstudianteController() };
