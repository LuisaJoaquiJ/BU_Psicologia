const { prisma } = require("../../../../config/prisma");
const { AppError } = require("../../../../common/utils/AppError");
const { config } = require("../../../../config/env");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { bloqueoService } = require("./BloqueoService");
const { inicioDeCita } = require("../utils/agenda");

// Citas del estudiante en Salud integral (RF-004 a RF-006).
class CitaService {
  constructor(r = repos, bloqueos = bloqueoService) {
    this.repos = r;
    this.bloqueos = bloqueos;
  }

  // RF-004 / HU-07: horarios libres de hoy en adelante, sin los que caen en
  // un tiempo no disponible del personal.
  async disponibles() {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const horarios = await this.repos.horarios.buscar({ ocupado: false, fecha: { gte: inicioHoy } });
    return this.bloqueos.quitarBloqueados(horarios.filter((h) => !h.sinCita));
  }

  // RF-005 / HU-08 a HU-10: en una transaccion valida que el estudiante no
  // tenga otra cita activa (RN-004) y que el horario siga libre (RN-003).
  agendar(usuarioId, horarioId) {
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const horario = await r.horarios.buscarPorId(horarioId);
      if (!horario) throw new AppError(404, "El horario seleccionado no existe.");
      if ((await r.citas.activasDeUsuario(usuarioId)).length) {
        throw new AppError(409, "Ya tienes una cita activa. Cancelala antes de agendar otra.");
      }
      // Actualizacion condicional: solo ocupa el horario si sigue libre.
      const resultado = await r.horarios.ocuparSiLibre(horarioId);
      if (resultado.count === 0) throw new AppError(409, "Ese horario ya no esta disponible. Elige otro.");
      return r.citas.crearConHorario({ usuarioId, horarioId, estado: "Agendada" });
    });
  }

  // RF-006 / HU-11: citas propias, sin las notas internas del personal.
  async mias(usuarioId) {
    const citas = await this.repos.citas.deUsuario(usuarioId);
    return citas.map(({ observaciones, ...c }) => c);
  }

  // RF-006 / HU-12: cancela una cita propia y libera el horario, con al
  // menos HORAS_MINIMAS_CANCELACION horas de anticipacion.
  cancelar(usuarioId, citaId) {
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const cita = await r.citas.buscarPorId(citaId);
      if (!cita || cita.usuarioId !== usuarioId) throw new AppError(404, "Cita no encontrada.");
      if (cita.estado !== "Agendada") throw new AppError(409, "Esta cita ya no se puede cancelar.");

      const horario = await r.horarios.buscarPorId(cita.horarioId);
      const horasRestantes = (inicioDeCita(horario) - Date.now()) / (60 * 60 * 1000);
      if (horasRestantes < config.horasMinimasCancelacion) {
        throw new AppError(
          409,
          `Solo puedes cancelar con al menos ${config.horasMinimasCancelacion} horas de anticipacion. ` +
            "Si no puedes asistir, comunicate con Bienestar Universitario.",
        );
      }
      const actualizada = await r.citas.cambiarEstado(citaId, "Cancelada", { horario: { include: { servicio: true } } });
      await r.horarios.actualizar(cita.horarioId, { ocupado: false });
      return actualizada;
    });
  }
}

module.exports = { CitaService, citaService: new CitaService() };
