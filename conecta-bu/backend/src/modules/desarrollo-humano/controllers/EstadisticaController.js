const { BaseController } = require("./BaseController");
const { estadisticaService } = require("../services/EstadisticaService");
const { tableroService } = require("../services/TableroService");
const { listarEjecuciones } = require("../../../integrations/n8n.client");

// Estadisticas, tablero e informe descargable de Desarrollo Humano (RF-015).
class EstadisticaController extends BaseController {
  estadisticas = async (req, res) => this.ok(res, await estadisticaService.obtener({ desde: req.query.desde, hasta: req.query.hasta }));

  // Tablero de lectura rapida (?periodo=semana|mes|trimestre|anio).
  tablero = async (req, res) => this.ok(res, await tableroService.tablero({ periodo: req.query.periodo }));

  informe = async (req, res) => {
    const formato = req.query.formato || "xlsx";
    const { buffer, nombre } = await estadisticaService.archivo({ desde: req.query.desde, hasta: req.query.hasta, formato });
    this.archivo(res, buffer, nombre, formato);
  };

  // RF-013: ultimas ejecuciones de las automatizaciones n8n.
  automatizaciones = async (req, res) => this.ok(res, { ejecuciones: listarEjecuciones() });
}

module.exports = { EstadisticaController, estadisticaController: new EstadisticaController() };
