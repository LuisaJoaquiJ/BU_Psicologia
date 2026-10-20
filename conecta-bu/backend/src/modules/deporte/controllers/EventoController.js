const { BaseController } = require("./BaseController");
const eventos = require("../services/EventoService");
const alertas = require("../services/AlertaService");

// Eventos deportivos (RF-002) y comunicados (RF-011) de la coordinacion.
class EventoController extends BaseController {
  listar = async (req, res) => this.ok(res, { eventos: await eventos.listar() });

  crear = async (req, res) => this.creado(res, { evento: await eventos.crear(req.body, req.usuario) });

  detalle = async (req, res) => this.ok(res, { evento: await eventos.detalle(req.params.id) });

  actualizar = async (req, res) => this.ok(res, { evento: await eventos.actualizar(req.params.id, req.body) });

  asistencia = async (req, res) => this.ok(res, { evento: await eventos.registrarAsistencia(req.params.id, req.body.presentes) });

  listarAlertas = async (req, res) => this.ok(res, { alertas: await alertas.listar() });

  crearAlerta = async (req, res) => this.creado(res, { alerta: await alertas.crear(req.body, req.usuario) });

  eliminarAlerta = async (req, res) => this.ok(res, await alertas.eliminar(req.params.id));
}

module.exports = new EventoController();
