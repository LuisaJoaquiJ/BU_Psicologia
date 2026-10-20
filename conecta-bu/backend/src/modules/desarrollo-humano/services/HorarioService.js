const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { bloqueoService } = require("./BloqueoService");
const { fechaHorario, horaHorario } = require("../utils/agenda");

// Horarios de atencion que publica el personal de Desarrollo Humano
// (RF-007 / HU-13, HU-14).
class HorarioService {
  constructor(r = repos, bloqueos = bloqueoService) {
    this.repos = r;
    this.bloqueos = bloqueos;
  }

  async exigirServicio(servicioId) {
    const servicio = await this.repos.servicios.buscarPorId(servicioId);
    if (!servicio) throw new AppError(404, "El servicio seleccionado no existe.");
    return servicio;
  }

  async obtener(id) {
    const horario = await this.repos.horarios.conServicio(id);
    if (!horario) throw new AppError(404, "El horario no existe.");
    return horario;
  }

  // RN: dentro de un mismo servicio y fecha, dos horarios no pueden solaparse.
  async exigirSinCruce({ servicioId, fecha, horaInicio, horaFin, excluirId }) {
    const horarios = await this.repos.horarios.delServicioEnFecha(servicioId, fecha);
    const solapa = horarios.some((h) => h.id !== excluirId && !h.sinCita && h.horaInicio < horaFin && h.horaFin > horaInicio);
    if (solapa) throw new AppError(409, "Ya existe un horario de este servicio que se cruza con ese rango de horas.");
  }

  // Valida el rango, que no caiga en un tiempo no disponible y que no se cruce.
  async validarFranja(franja) {
    if (franja.horaInicio >= franja.horaFin) throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
    await this.bloqueos.exigirLibre(franja.fecha, franja.horaInicio, franja.horaFin);
    await this.exigirSinCruce(franja);
  }

  // RF-007 / HU-13: publica un nuevo horario disponible.
  async crear({ servicioId, fecha, horaInicio, horaFin, cupo }) {
    await this.exigirServicio(servicioId);
    const franja = { servicioId, fecha: fechaHorario(fecha), horaInicio: horaHorario(horaInicio), horaFin: horaHorario(horaFin) };
    await this.validarFranja(franja);
    return this.repos.horarios.crearConServicio({ ...franja, cupo: cupo ? Number(cupo) : 1, ocupado: false });
  }

  // RF-007 / HU-13, HU-14: todos los horarios (tambien ocupados o
  // deshabilitados) para gestionarlos. Las atenciones sin cita no se listan.
  async listar({ fecha, servicioId } = {}) {
    const where = {};
    if (fecha) where.fecha = fechaHorario(fecha);
    if (servicioId) where.servicioId = servicioId;
    const horarios = await this.repos.horarios.buscar(where);
    return horarios.filter((h) => !h.sinCita);
  }

  // RF-007 / HU-14: modifica un horario que no tiene una cita activa.
  async actualizar(id, cambios) {
    const horario = await this.obtener(id);
    if (cambios.servicioId && cambios.servicioId !== horario.servicioId) await this.exigirServicio(cambios.servicioId);
    if (await this.repos.citas.agendadaDelHorario(id)) {
      throw new AppError(409, "Este horario tiene una cita agendada. Cancelala o reagendala antes de modificarlo.");
    }
    const franja = {
      servicioId: cambios.servicioId || horario.servicioId,
      fecha: cambios.fecha ? fechaHorario(cambios.fecha) : horario.fecha,
      horaInicio: cambios.horaInicio ? horaHorario(cambios.horaInicio) : horario.horaInicio,
      horaFin: cambios.horaFin ? horaHorario(cambios.horaFin) : horario.horaFin,
      excluirId: id,
    };
    await this.validarFranja(franja);
    const { excluirId, ...data } = franja;
    return this.repos.horarios.actualizarConServicio(id, { ...data, cupo: cambios.cupo ? Number(cambios.cupo) : horario.cupo });
  }

  // RF-007 / HU-14: deja de ofrecerlo. Si tiene una cita agendada exige
  // confirmar, porque tambien la cancela.
  async deshabilitar(id, confirmar) {
    await this.obtener(id);
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const horario = await r.horarios.buscarPorId(id);
      if (!horario) throw new AppError(404, "El horario no existe.");
      const citaActiva = await r.citas.agendadaDelHorario(id);
      // Ya estaba deshabilitado y no hay nada que cancelar.
      if (horario.ocupado && !citaActiva) return horario;
      if (citaActiva && !confirmar) {
        throw new AppError(409, "Este horario tiene una cita agendada. Confirma para deshabilitarlo y cancelar esa cita.");
      }
      if (citaActiva) await r.citas.actualizar(citaActiva.id, { estado: "Cancelada" });
      return r.horarios.actualizarConServicio(id, { ocupado: true });
    });
  }

  // RF-007 / HU-14: vuelve a ofrecerlo, salvo que tenga una cita activa.
  async habilitar(id) {
    const horario = await this.obtener(id);
    if (!horario.ocupado) return this.repos.horarios.conServicio(id);
    if (await this.repos.citas.agendadaDelHorario(id)) {
      throw new AppError(409, "No se puede habilitar: el horario tiene una cita activa asociada.");
    }
    return this.repos.horarios.actualizarConServicio(id, { ocupado: false });
  }
}

module.exports = { HorarioService, horarioService: new HorarioService() };
