const { BaseController } = require("./BaseController");
const { listaAsistentesService: s } = require("../services/ListaAsistentesService");

// Descarga de la lista de asistentes (?formato=xlsx|pdf).
class ListaAsistentesController extends BaseController {
  citas = async (req, res) => {
    const formato = req.query.formato || "xlsx";
    const { buffer, nombre } = await s.archivo(await s.citas(req.query), formato);
    this.archivo(res, buffer, nombre, formato);
  };

  evento = async (req, res) => {
    const formato = req.query.formato || "xlsx";
    const { buffer, nombre } = await s.archivo(await s.evento(req.params.id), formato);
    this.archivo(res, buffer, nombre, formato);
  };
}

module.exports = { ListaAsistentesController, listaAsistentesController: new ListaAsistentesController() };