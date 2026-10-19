const agenda = require("./AgendaRepositories");

// Repositorios de la agenda de Salud integral para un cliente de Prisma (el
// normal o el de una transaccion: reposCon(tx)).
function reposCon(db) {
  return {
    servicios: new agenda.ServicioRepository(db),
    horarios: new agenda.HorarioRepository(db),
    citas: new agenda.CitaRepository(db),
    asistencias: new agenda.AsistenciaCitaRepository(db),
    bloqueos: new agenda.BloqueoRepository(db),
    usuarios: new agenda.UsuarioRepository(db),
    roles: new agenda.RolRepository(db),
  };
}

module.exports = { ...reposCon(), reposCon };
