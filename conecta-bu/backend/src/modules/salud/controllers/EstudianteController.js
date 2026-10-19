const { BaseController } = require("./BaseController");
const { CATEGORIAS } = require("../utils/catalogos");
const { personaService } = require("../services/PersonaService");

// Vista del estudiante en Salud integral: sus participaciones (sin datos
// clinicos), asociadas por el correo registrado en la Unidad de Salud.
class EstudianteController extends BaseController {
  participaciones = async (req, res) => this.ok(res, await personaService.participacionesDe(req.usuario.emailInstitucional, CATEGORIAS));
}

module.exports = { EstudianteController, estudianteController: new EstudianteController() };
