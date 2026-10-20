const { AppError } = require("../../../../common/utils/AppError");
const { aFechaUTC, aHoraUTC, hoyBogota } = require("../../../../common/utils/fechas");
const automatizaciones = require("../../../../integrations/automatizaciones");
const repos = require("../repositories");
const { MOTIVOS, cruza, ms, iso, esVerdadero } = require("../utils/agenda");

// Tiempo no disponible del personal de Salud integral: mientras dure, los
// horarios que se crucen no se ofrecen a los estudiantes y no se pueden
// publicar nuevos. El motivo solo lo ve el personal.
class BloqueoService {
  constructor(r = repos) {
    this.repos = r;
  }

  serializar(b) {
    return { ...b, fechaInicio: iso(b.fechaInicio), fechaFin: iso(b.fechaFin) };
  }

  // Quita de una lista de horarios los que caen dentro de un bloqueo.
  async quitarBloqueados(horarios) {
    if (!horarios.length) return horarios;
    const bloqueos = await this.repos.bloqueos.entre(hoyBogota());
    if (!bloqueos.length) return horarios;
    return horarios.filter((h) => !bloqueos.some((b) => cruza(b, h.fecha, h.horaInicio, h.horaFin)));
  }

  // Bloqueo que impide publicar un horario en ese dia y hora, si lo hay.
  async queCruza(fecha, horaInicio, horaFin) {
    const bloqueos = await this.repos.bloqueos.entre(fecha, fecha);
    return bloqueos.find((b) => cruza(b, fecha, horaInicio, horaFin)) || null;
  }

  async exigirLibre(fecha, horaInicio, horaFin) {
    const bloqueo = await this.queCruza(fecha, horaInicio, horaFin);
    if (bloqueo) {
      throw new AppError(409, `Ese tiempo lo marcaste como no disponible (${bloqueo.motivo}). Elige otra hora o quita ese bloqueo.`, "HORARIO_EN_BLOQUEO");
    }
  }

  async listar({ desde, hasta } = {}) {
    const lista = await this.repos.bloqueos.entre(desde ? aFechaUTC(desde) : null, hasta ? aFechaUTC(hasta) : null);
    return lista.map((b) => this.serializar(b));
  }

  datos(cuerpo) {
    const motivo = String(cuerpo.motivo || "").trim();
    if (!MOTIVOS.includes(motivo)) throw new AppError(400, "Elige el motivo por el que no vas a estar disponible.");
    const detalle =
      String(cuerpo.detalle || "")
        .trim()
        .slice(0, 300) || null;
    if (motivo === "Otro" && !detalle) throw new AppError(400, "Cuéntanos brevemente el motivo.");

    const fechaInicio = aFechaUTC(cuerpo.fechaInicio, "fecha de inicio");
    const fechaFin = cuerpo.fechaFin ? aFechaUTC(cuerpo.fechaFin, "fecha de fin") : fechaInicio;
    if (fechaFin < fechaInicio) throw new AppError(400, "La fecha de fin no puede ser anterior a la de inicio.");
    if (fechaFin < hoyBogota()) throw new AppError(400, "Ese tiempo ya pasó: elige hoy o una fecha futura.");
    if ((ms(fechaFin) - ms(fechaInicio)) / 864e5 > 120) throw new AppError(400, "Registra máximo 4 meses seguidos.");

    const todoElDia = cuerpo.todoElDia === undefined ? true : esVerdadero(cuerpo.todoElDia);
    let horaInicio = null;
    let horaFin = null;
    if (!todoElDia) {
      horaInicio = aHoraUTC(cuerpo.horaInicio, "hora de inicio");
      horaFin = aHoraUTC(cuerpo.horaFin, "hora de fin");
      if (horaInicio >= horaFin) throw new AppError(400, "La hora de inicio debe ser anterior a la hora de fin.");
    }
    return { motivo, detalle, fechaInicio, fechaFin, todoElDia, horaInicio, horaFin };
  }

  // Horarios publicados que quedan dentro del bloqueo.
  async horariosAfectados(datos) {
    const horarios = await this.repos.horarios.entreFechas(datos.fechaInicio, datos.fechaFin);
    return horarios.filter((h) => !h.sinCita && cruza(datos, h.fecha, h.horaInicio, h.horaFin));
  }

  // Crea el bloqueo. Si hay citas agendadas en ese tiempo, pide confirmar;
  // al confirmar, se cancelan (y se avisa a cada estudiante).
  async crear(cuerpo, usuario) {
    const datos = this.datos(cuerpo);
    const horarios = await this.horariosAfectados(datos);
    const afectadas = [];
    for (const h of horarios) {
      const cita = await this.repos.citas.agendadaDelHorario(h.id);
      if (cita) afectadas.push(cita);
    }

    if (afectadas.length && !esVerdadero(cuerpo.confirmar)) {
      const cuantas = afectadas.length === 1 ? "hay 1 cita agendada" : `hay ${afectadas.length} citas agendadas`;
      throw new AppError(409, `En ese tiempo ${cuantas}. Confirma para cancelarlas y avisar a los estudiantes.`, "CITAS_EN_BLOQUEO");
    }

    const bloqueo = await this.repos.bloqueos.crear({ ...datos, creadoPor: usuario?.nombre || null });
    for (const cita of afectadas) {
      const cancelada = await this.repos.citas.cambiarEstado(cita.id, "Cancelada");
      await this.repos.horarios.actualizar(cita.horarioId, { ocupado: true });
      if (cancelada?.usuario) automatizaciones.citaCancelada(cancelada.usuario, cancelada, "Salud Integral");
    }
    return { bloqueo: this.serializar(bloqueo), citasCanceladas: afectadas.length, horariosAfectados: horarios.length };
  }

  // Citas que se cancelarian, para mostrarlas antes de confirmar.
  async citasEnRango(cuerpo) {
    const horarios = await this.horariosAfectados(this.datos(cuerpo));
    const lista = [];
    for (const h of horarios) {
      const cita = await this.repos.citas.agendadaDelHorario(h.id, { usuario: true });
      if (cita) lista.push({ id: cita.id, estudiante: cita.usuario?.nombre || "", servicio: h.servicio?.nombre, fecha: iso(h.fecha), horaInicio: h.horaInicio });
    }
    return lista;
  }

  async eliminar(id) {
    const bloqueo = await this.repos.bloqueos.buscarPorId(id);
    if (!bloqueo) throw new AppError(404, "No encontramos ese tiempo no disponible.");
    await this.repos.bloqueos.eliminar(id);
    return this.serializar(bloqueo);
  }
}

module.exports = { BloqueoService, bloqueoService: new BloqueoService() };
