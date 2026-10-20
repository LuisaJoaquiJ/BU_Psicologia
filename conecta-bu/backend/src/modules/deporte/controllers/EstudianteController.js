const { BaseController } = require("./BaseController");
const estudiantes = require("../services/EstudianteService");
const { constanciaPdf } = require("../archivos");

// Estudiantes y horas (coordinacion): avance, categoria y horas reconocidas.
class EstudianteController extends BaseController {
  listar = async (req, res) => this.ok(res, await estudiantes.listar(req.query));

  detalle = async (req, res) => this.ok(res, await estudiantes.detalle(req.params.id));

  reconocerHoras = async (req, res) => this.creado(res, await estudiantes.reconocerHoras(req.params.id, req.body, req.usuario.emailInstitucional));

  eliminarHoras = async (req, res) => this.ok(res, await estudiantes.eliminarHoras(req.params.id));

  categoria = async (req, res) => this.ok(res, await estudiantes.actualizarCategoria(req.params.id, req.body.categoria));

  constancia = async (req, res) => this.archivo(res, await constanciaPdf(await estudiantes.detalle(req.params.id)), "constancia-horas-deporte.pdf", "pdf");
}

module.exports = new EstudianteController();
