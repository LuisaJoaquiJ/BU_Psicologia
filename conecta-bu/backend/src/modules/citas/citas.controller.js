const {
  listarHorariosDisponibles,
  crearCita,
  listarMisCitas,
  cancelarCita,
  listarAgendaAdmin,
  registrarAsistencia,
} = require("./citas.service");
const automatizaciones = require("../../integrations/automatizaciones");
const { moduloSolicitado, moduloDeRol } = require("../../common/utils/modulos");

// RF-004 / HU-07
async function horariosDisponibles(req, res, next) {
  try {
    const horarios = await listarHorariosDisponibles(moduloSolicitado(req));
    res.status(200).json({ horarios });
  } catch (err) {
    next(err);
  }
}

// RF-005 / HU-08, HU-09, HU-10
async function agendar(req, res, next) {
  try {
    const cita = await crearCita(req.usuario.id, req.body.horarioId);
    res.status(201).json({ cita });
    automatizaciones.citaAgendada(req.usuario, cita); // RF-013 (no bloquea)
  } catch (err) {
    next(err);
  }
}

// RF-006 / HU-11
async function misCitas(req, res, next) {
  try {
    const citas = await listarMisCitas(req.usuario.id);
    res.status(200).json({ citas });
  } catch (err) {
    next(err);
  }
}

// RF-006 / HU-12
async function cancelar(req, res, next) {
  try {
    const cita = await cancelarCita(req.usuario.id, req.params.id);
    res.status(200).json({ cita });
    automatizaciones.citaCancelada(req.usuario, cita); // RF-013 (no bloquea)
  } catch (err) {
    next(err);
  }
}

// RF-008 / HU-15
async function agendaAdmin(req, res, next) {
  try {
    const citas = await listarAgendaAdmin({
      fecha: req.query.fecha,
      servicioId: req.query.servicioId,
      estado: req.query.estado,
      modulo: moduloDeRol(req.usuario.rol.nombre),
    });
    res.status(200).json({ citas });
  } catch (err) {
    next(err);
  }
}

// RF-008 / HU-16
async function asistencia(req, res, next) {
  try {
    const cita = await registrarAsistencia(req.usuario.id, req.params.id, req.body.asistio, moduloDeRol(req.usuario.rol.nombre));
    res.status(200).json({ cita });
  } catch (err) {
    next(err);
  }
}

module.exports = { horariosDisponibles, agendar, misCitas, cancelar, agendaAdmin, asistencia };
