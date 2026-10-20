const { BaseController } = require("./BaseController");
const { servicioService } = require("../services/ServicioService");
const { citaService } = require("../services/CitaService");
const automatizaciones = require("../../../integrations/automatizaciones");

// Servicios y citas del estudiante (RF-003 a RF-006).
class CitaController extends BaseController {
  servicios = async (req, res) => this.ok(res, { servicios: await servicioService.activos() });

  disponibles = async (req, res) => this.ok(res, { horarios: await citaService.disponibles() });

  agendar = async (req, res) => {
    const cita = await citaService.agendar(req.usuario.id, req.body.horarioId);
    this.creado(res, { cita });
    automatizaciones.citaAgendada(req.usuario, cita); // RF-013 (no bloquea)
  };

  mias = async (req, res) => this.ok(res, { citas: await citaService.mias(req.usuario.id) });

  cancelar = async (req, res) => {
    const cita = await citaService.cancelar(req.usuario.id, req.params.id);
    this.ok(res, { cita });
    automatizaciones.citaCancelada(req.usuario, cita); // RF-013 (no bloquea)
  };
}

module.exports = { CitaController, citaController: new CitaController() };
