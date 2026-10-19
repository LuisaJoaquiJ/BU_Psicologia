const { BaseController } = require("./BaseController");
const docentes = require("../services/DocenteService");

// Registro de docentes por la coordinacion (RF-004, RF-007).
class DocenteController extends BaseController {
  listar = async (req, res) => this.ok(res, { docentes: await docentes.listar() });

  crear = async (req, res) => this.creado(res, { docente: await docentes.crear(req.body, req.usuario.emailInstitucional) });

  cargarCsv = async (req, res) => this.ok(res, await docentes.cargarCsv(req.body.contenido, req.usuario.emailInstitucional));

  actualizar = async (req, res) => this.ok(res, { docente: await docentes.actualizar(req.params.id, req.body, req.usuario.emailInstitucional) });
}

module.exports = new DocenteController();
