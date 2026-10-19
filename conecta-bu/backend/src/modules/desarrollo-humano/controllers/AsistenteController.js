const { BaseController } = require("./BaseController");
const { asistenteService } = require("../services/AsistenteService");

// RF-014: asistente de orientacion del estudiante.
class AsistenteController extends BaseController {
  consultar = async (req, res) => this.ok(res, await asistenteService.responder(req.usuario, req.body.pregunta, req.body.historial));
}

module.exports = { AsistenteController, asistenteController: new AsistenteController() };
