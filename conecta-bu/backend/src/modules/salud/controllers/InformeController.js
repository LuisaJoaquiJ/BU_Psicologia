const { BaseController } = require("./BaseController");
const { reporteService } = require("../services/ReporteService");
const { informeService } = require("../services/InformeService");
const { informeSuperService } = require("../services/InformeSuperService");
const { historicoService } = require("../services/HistoricoService");

// Inicio, reportes (SNIES, registro general) e informe de gestion.
class InformeController extends BaseController {
  resumen = async (req, res) => this.ok(res, await reporteService.resumen(req.query));

  snies = async (req, res) => {
    const { buffer, nombre, sinResponsable } = await reporteService.snies(req.query);
    if (sinResponsable.length) res.set("X-Actividades-Sin-Responsable", String(sinResponsable.length));
    this.archivo(res, buffer, nombre, "xlsx");
  };

  registro = async (req, res) => {
    const { buffer, nombre } = await reporteService.registroGeneral(req.query);
    this.archivo(res, buffer, nombre, "xlsx");
  };

  // Informe de gestion en Excel (formato INFBI-002 completo, con graficas).
  gestion = async (req, res) => {
    const { buffer, nombre, tipo } = await informeService.descargar(req.query.periodo, "xlsx");
    this.archivo(res, buffer, nombre, tipo);
  };

  informes = async (req, res) => this.ok(res, { informes: await informeService.listar() });
  informe = async (req, res) => this.ok(res, await informeService.obtener(req.params.periodo));
  guardar = async (req, res) => this.ok(res, await informeService.guardar(req.params.periodo, req.body));
  enviar = async (req, res) => this.ok(res, await informeService.enviar(req.params.periodo, req.usuario));
  archivoInforme = async (req, res) => {
    const { buffer, nombre, tipo } = await informeService.descargar(req.params.periodo, req.query.formato || "pdf");
    this.archivo(res, buffer, nombre, tipo);
  };

  historicos = async (req, res) => this.ok(res, { historicos: await historicoService.listar() });
  guardarHistoricos = async (req, res) => this.ok(res, { historicos: await historicoService.guardar(req.body.historicos) });

  // ---- Superadministrador ----
  recibidos = async (req, res) => this.ok(res, { informes: await informeSuperService.recibidos(req.query) });
  revisar = async (req, res) => this.ok(res, { informe: await informeSuperService.revisar(req.params.id, req.body, req.usuario) });
  archivoRecibido = async (req, res) => {
    const { buffer, nombre, tipo } = await informeSuperService.descargar(req.params.id, req.query.formato || "pdf");
    this.archivo(res, buffer, nombre, tipo);
  };
}

module.exports = { InformeController, informeController: new InformeController() };
