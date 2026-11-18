const { BaseController } = require("./BaseController");
const { controlAsistenciaService: s } = require("../services/ControlAsistenciaService");

class ControlAsistenciaController extends BaseController {
  obtener = async (req, res) => this.ok(res, await s.obtener(req.params.id));

  cambiarAbierta = async (req, res) =>
    this.ok(res, await s.cambiarAbierta(req.params.id, req.body.abierta === true, req.usuario?.nombre));

  rotarCodigo = async (req, res) => this.ok(res, await s.rotarCodigo(req.params.id));

  escanear = async (req, res) => this.ok(res, await s.registrarEscaneo(req.usuario.id, req.body.codigo));

  obtenerParaEstudiante = async (req, res) =>
    this.ok(res, await s.obtenerParaEstudiante(req.params.id, req.usuario.id));
}

module.exports = {
  ControlAsistenciaController,
  controlAsistenciaController: new ControlAsistenciaController(),
};