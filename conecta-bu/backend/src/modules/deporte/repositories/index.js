const r = require("./DeporteRepositories");

// Una instancia de cada repositorio con el cliente normal de Prisma.
// Para una transaccion se crea una nueva: new r.GrupoRepository(tx).
module.exports = {
  clases: r,
  config: new r.ConfigRepository(),
  disciplinas: new r.DisciplinaRepository(),
  grupos: new r.GrupoRepository(),
  inscripciones: new r.InscripcionRepository(),
  sesiones: new r.SesionRepository(),
  asistencias: new r.AsistenciaRepository(),
  horasManuales: new r.HoraManualRepository(),
  docentes: new r.DocenteRepository(),
  eventos: new r.EventoRepository(),
  inscripcionesEvento: new r.InscripcionEventoRepository(),
  alertas: new r.AlertaRepository(),
  implementos: new r.ImplementoRepository(),
  prestamos: new r.PrestamoRepository(),
  movimientos: new r.MovimientoRepository(),
  usuarios: new r.UsuarioRepository(),
  roles: new r.RolRepository(),
  accesos: new r.AccesoRepository(),
};
