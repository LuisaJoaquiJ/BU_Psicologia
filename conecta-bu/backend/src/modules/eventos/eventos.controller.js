const {
  crearEvento,
  listarEventosAdmin,
  actualizarEvento,
  cambiarEstadoEvento,
  eliminarEvento,
  listarInscritosEvento,
  registrarAsistenciaEvento,
  listarEventosPublicados,
  obtenerEventoPublicado,
  inscribirseEnEvento,
  cancelarInscripcion,
  listarMisInscripciones,
  obtenerEventoOFallar,
} = require("./eventos.service");
const automatizaciones = require("../../integrations/automatizaciones");

// Envuelve cada handler para no repetir try/catch: cualquier error (incluido
// AppError) llega al middleware de errores centralizado.
function manejar(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

// ---- Administrador ---------------------------------------------------------

// RF-009
const crear = manejar(async (req, res) => {
  const evento = await crearEvento(req.body);
  res.status(201).json({ evento });
  if (evento.estado === "Publicado") automatizaciones.eventoPublicado(evento); // RF-013
});

// RF-009
const listarAdmin = manejar(async (req, res) => {
  const eventos = await listarEventosAdmin({ estado: req.query.estado });
  res.status(200).json({ eventos });
});

// RF-009
const obtenerAdmin = manejar(async (req, res) => {
  const evento = await obtenerEventoOFallar(req.params.id);
  res.status(200).json({ evento });
});

// RF-009
const actualizar = manejar(async (req, res) => {
  const evento = await actualizarEvento(req.params.id, req.body);
  res.status(200).json({ evento });
});

// RF-009
const cambiarEstado = manejar(async (req, res) => {
  const evento = await cambiarEstadoEvento(req.usuario.id, req.params.id, req.body.estado);
  res.status(200).json({ evento });
  if (evento.estado === "Publicado") automatizaciones.eventoPublicado(evento); // RF-013
});

// RF-009 (flujo alternativo: confirmacion si hay inscripciones activas)
const eliminar = manejar(async (req, res) => {
  const confirmar = req.query.confirmar === "true" || req.body?.confirmar === true;
  const resultado = await eliminarEvento(req.params.id, confirmar);
  res.status(200).json(resultado);
});

// RF-011
const inscritos = manejar(async (req, res) => {
  const resultado = await listarInscritosEvento(req.params.id);
  res.status(200).json(resultado);
});

// RF-011 / RN-010
const asistencia = manejar(async (req, res) => {
  const inscripcion = await registrarAsistenciaEvento(req.usuario.id, {
    eventoId: req.params.id,
    inscripcionId: req.params.inscripcionId,
    asistio: req.body.asistio,
  });
  res.status(200).json({ inscripcion });
});

// ---- Estudiante ------------------------------------------------------------

// RF-010
const listarPublicados = manejar(async (req, res) => {
  const eventos = await listarEventosPublicados(req.usuario.id);
  res.status(200).json({ eventos });
});

// RF-010
const detalle = manejar(async (req, res) => {
  const evento = await obtenerEventoPublicado(req.params.id, req.usuario.id);
  res.status(200).json({ evento });
});

// RF-010 / RN-006 / RN-007
const inscribirse = manejar(async (req, res) => {
  const inscripcion = await inscribirseEnEvento(req.usuario.id, req.params.id);
  res.status(201).json({ inscripcion });
  automatizaciones.inscripcionEvento(req.usuario, inscripcion); // RF-013
});

// RF-010
const cancelar = manejar(async (req, res) => {
  const inscripcion = await cancelarInscripcion(req.usuario.id, req.params.id);
  res.status(200).json({ inscripcion });
  automatizaciones.inscripcionCancelada(req.usuario, inscripcion); // RF-013
});

// RF-010
const misInscripciones = manejar(async (req, res) => {
  const inscripciones = await listarMisInscripciones(req.usuario.id);
  res.status(200).json({ inscripciones });
});

module.exports = {
  crear,
  listarAdmin,
  obtenerAdmin,
  actualizar,
  cambiarEstado,
  eliminar,
  inscritos,
  asistencia,
  listarPublicados,
  detalle,
  inscribirse,
  cancelar,
  misInscripciones,
};
