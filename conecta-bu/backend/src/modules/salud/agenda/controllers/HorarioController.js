const { BaseController } = require("./BaseController");
const { horarioService } = require("../services/HorarioService");
const { bloqueoService } = require("../services/BloqueoService");
const { MOTIVOS } = require("../utils/agenda");

// Horarios de atencion y tiempo no disponible del personal (RF-007).
class HorarioController extends BaseController {
  crear = async (req, res) => this.creado(res, { horario: await horarioService.crear(req.body) });

  listar = async (req, res) => this.ok(res, { horarios: await horarioService.listar({ fecha: req.query.fecha, servicioId: req.query.servicioId }) });

  actualizar = async (req, res) => this.ok(res, { horario: await horarioService.actualizar(req.params.id, req.body) });

  deshabilitar = async (req, res) => this.ok(res, { horario: await horarioService.deshabilitar(req.params.id, req.body?.confirmar === true) });

  habilitar = async (req, res) => this.ok(res, { horario: await horarioService.habilitar(req.params.id) });

  bloqueos = async (req, res) => this.ok(res, { motivos: MOTIVOS, bloqueos: await bloqueoService.listar(req.query) });

  citasAfectadas = async (req, res) => this.ok(res, { citas: await bloqueoService.citasEnRango(req.body) });

  crearBloqueo = async (req, res) => this.creado(res, await bloqueoService.crear(req.body, req.usuario));

  eliminarBloqueo = async (req, res) => this.ok(res, { bloqueo: await bloqueoService.eliminar(req.params.id) });
}

module.exports = { HorarioController, horarioController: new HorarioController() };
