const { BaseController } = require("./BaseController");
const { agendaService } = require("../services/AgendaService");

// Agenda de citas del personal (RF-008) y atencion sin cita.
class AgendaController extends BaseController {
  listar = async (req, res) => {
    const { fecha, servicioId, estado } = req.query;
    this.ok(res, { citas: await agendaService.listar({ fecha, servicioId, estado }) });
  };

  asistencia = async (req, res) => this.ok(res, { cita: await agendaService.registrarAsistencia(req.usuario.id, req.params.id, req.body.asistio) });

  estudiantes = async (req, res) => this.ok(res, { estudiantes: await agendaService.buscarEstudiantes(req.query.q) });

  sinCita = async (req, res) => this.creado(res, { cita: await agendaService.registrarSinCita(req.usuario.id, req.body) });
}

module.exports = { AgendaController, agendaController: new AgendaController() };
