const { crearHorario, listarTodosLosHorarios, actualizarHorario, deshabilitarHorario, habilitarHorario } = require("./horarios.service");
// Modulo del router (Desarrollo humano o Salud), fijado por requireModulo.
const modulo = (req) => req.modulo;

// RF-007 / HU-13
async function crear(req, res, next) {
  try {
    const horario = await crearHorario(req.body, modulo(req));
    res.status(201).json({ horario });
  } catch (err) {
    next(err);
  }
}

// RF-007 / HU-13, HU-14
async function listar(req, res, next) {
  try {
    const horarios = await listarTodosLosHorarios({
      fecha: req.query.fecha,
      servicioId: req.query.servicioId,
      modulo: modulo(req),
    });
    res.status(200).json({ horarios });
  } catch (err) {
    next(err);
  }
}

// RF-007 / HU-14
async function actualizar(req, res, next) {
  try {
    const horario = await actualizarHorario(req.params.id, req.body, modulo(req));
    res.status(200).json({ horario });
  } catch (err) {
    next(err);
  }
}

// RF-007 / HU-14
async function deshabilitar(req, res, next) {
  try {
    const horario = await deshabilitarHorario(req.params.id, req.body?.confirmar === true, modulo(req));
    res.status(200).json({ horario });
  } catch (err) {
    next(err);
  }
}

// RF-007 / HU-14
async function habilitar(req, res, next) {
  try {
    const horario = await habilitarHorario(req.params.id, modulo(req));
    res.status(200).json({ horario });
  } catch (err) {
    next(err);
  }
}

module.exports = { crear, listar, actualizar, deshabilitar, habilitar };
