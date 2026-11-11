const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const { config } = require("../../../config/env");
const { aFechaUTC, aHoraUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { reposCon } = require("../repositories");
const { DURACIONES, horaBogota, inicioDeCita, texto } = require("../utils/agenda");
const { cierreCorregible } = require("./CierreService");
const { bloqueoService } = require("./BloqueoService");
const { citaService } = require("./CitaService");

// Agenda del personal de Desarrollo Humano: citas de todos los estudiantes,
// registro de asistencia (RF-008) y atencion sin cita.
class AgendaService {
  constructor(r = repos, bloqueos = bloqueoService, citasEstudiante = citaService) {
    this.repos = r;
    this.bloqueos = bloqueos;
    this.citasEstudiante = citasEstudiante;
  }

  // RF-008 / HU-15: filtros opcionales por fecha, servicio y estado.
  listar({ fecha, servicioId, estado } = {}) {
    const where = {};
    if (estado) where.estado = estado;
    if (fecha || servicioId) {
      where.horario = {};
      if (fecha) where.horario.fecha = new Date(`${fecha}T00:00:00.000Z`);
      if (servicioId) where.horario.servicioId = servicioId;
    }
    return this.repos.citas.agenda(where);
  }

  // RF-008 / HU-16: Atendida o NoAsistio, con registro de quien la marco.
  registrarAsistencia(adminId, citaId, asistio) {
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const cita = await r.citas.buscarPorId(citaId);
      if (!cita) throw new AppError(404, "Cita no encontrada.");
      // "No asistio" sin registro es el cierre automatico: el personal aun puede corregirlo.
      if (!["Agendada", "NoAsistio"].includes(cita.estado)) throw new AppError(409, "Solo se puede registrar asistencia de una cita que este agendada.");
      if (await r.asistencias.deCita(citaId)) throw new AppError(409, "Ya se registro la asistencia de esta cita.");
      // El cierre automatico deja la cita en No asistio sin registro. Se puede
      // corregir durante 7 dias; confirmar "no asistio" la deja como registro manual.
      if (cita.cerradaAutomaticamente && !cierreCorregible(cita.cerradaAutomaticamente)) {
        throw new AppError(409, "Pasaron 7 días desde el cierre automático. Ya no se puede corregir esta cita.");
      }
      await r.citas.actualizar(citaId, { estado: asistio ? "Atendida" : "NoAsistio", cerradaAutomaticamente: null });
      await r.asistencias.crear({ citaId, asistio: Boolean(asistio), registradoPorId: adminId });
      return r.citas.completa(citaId);
    });
  }

  // Horarios a los que se puede mover una cita agendada que aun no empieza:
  // los mismos que veria el estudiante, del mismo servicio.
  async horariosLibres(citaId) {
    const cita = await this.repos.citas.completa(String(citaId || ""));
    if (!cita) throw new AppError(404, "Cita no encontrada.");
    this.exigirReprogramable(cita);
    const libres = await this.citasEstudiante.disponibles();
    return libres.filter((h) => h.servicioId === cita.horario.servicioId && h.id !== cita.horarioId);
  }

  exigirReprogramable(cita) {
    if (cita.estado !== "Agendada") throw new AppError(409, "Solo se puede reprogramar una cita que sigue agendada.");
    if (cita.horario?.sinCita) throw new AppError(409, "Una atención sin cita no se reprograma.");
    if (cita.cerradaAutomaticamente) throw new AppError(409, "Esta cita ya la cerró el sistema. Registra la asistencia en lugar de reprogramarla.");
    if (inicioDeCita(cita.horario) <= new Date()) {
      throw new AppError(409, "Esta cita ya empezó. Registra la asistencia en lugar de reprogramarla.");
    }
  }

  // Mueve la cita a otro horario libre del mismo servicio. Libera el anterior.
  reprogramar(adminId, citaId, horarioId) {
    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const cita = await r.citas.completa(String(citaId || ""));
      if (!cita) throw new AppError(404, "Cita no encontrada.");
      this.exigirReprogramable(cita);
      if (!horarioId || horarioId === cita.horarioId) throw new AppError(400, "Elige otro horario.");

      const nuevo = await r.horarios.buscarPorId(String(horarioId));
      if (!nuevo) throw new AppError(404, "El horario seleccionado no existe.");
      if (nuevo.servicioId !== cita.horario.servicioId) throw new AppError(409, "La cita se reprograma en un horario del mismo servicio.");
      if (nuevo.sinCita || inicioDeCita(nuevo) <= new Date() || (await this.bloqueos.queCruza(nuevo.fecha, nuevo.horaInicio, nuevo.horaFin))) {
        throw new AppError(409, "Ese horario ya no está disponible. Elige otro.");
      }
      const ocupado = await r.horarios.ocuparSiLibre(nuevo.id);
      if (ocupado.count === 0) throw new AppError(409, "Ese horario ya no está disponible. Elige otro.");
      await r.horarios.actualizar(cita.horarioId, { ocupado: false });
      await r.citas.actualizar(cita.id, { horarioId: nuevo.id });
      await r.historial.crear({
        citaId: cita.id,
        estadoAnterior: "Agendada",
        estadoNuevo: "Reprogramada",
        usuarioId: adminId,
      });
      return r.citas.completa(cita.id);
    });
  }

  // Busca estudiantes por nombre o correo para el formulario de atencion sin cita.
  async buscarEstudiantes(q) {
    const termino = texto(q, 80);
    if (termino.length < 2) return [];
    const usuarios = await this.repos.usuarios.buscarEstudiantes(termino);
    return usuarios.slice(0, 8).map((u) => ({ id: u.id, nombre: u.nombre, email: u.emailInstitucional }));
  }

  // Estudiante elegido de la lista o, si nunca ha entrado, uno nuevo con su
  // correo institucional (al entrar con Google usa el mismo registro).
  async resolverEstudiante({ usuarioId, correo, nombre }, r) {
    if (usuarioId) {
      const usuario = await r.usuarios.buscarPorId(String(usuarioId));
      if (!usuario) throw new AppError(404, "No encontramos a ese estudiante.");
      return usuario;
    }
    const email = texto(correo, 120).toLowerCase();
    if (!email) throw new AppError(400, "Elige al estudiante o escribe su correo institucional.");
    if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.split("@")[1] !== config.allowedGoogleDomain) {
      throw new AppError(400, `Usa el correo institucional del estudiante (@${config.allowedGoogleDomain}).`);
    }
    const existente = await r.usuarios.porCorreo(email);
    if (existente) return existente;
    const nombreLimpio = texto(nombre, 200);
    if (nombreLimpio.length < 3) throw new AppError(400, "Escribe el nombre completo del estudiante.");
    const rol = await r.roles.porNombre("Estudiante");
    if (!rol) throw new AppError(500, "El rol Estudiante no esta configurado. Ejecuta el seed de la base de datos.");
    return r.usuarios.crear({ emailInstitucional: email, nombre: nombreLimpio, rolId: rol.id });
  }

  // Franja de la atencion: hoy (o un dia anterior) a la hora indicada.
  franjaSinCita(cuerpo) {
    const hoy = hoyBogota();
    const fecha = cuerpo.fecha ? aFechaUTC(cuerpo.fecha) : hoy;
    if (fecha > hoy) throw new AppError(400, "La atención sin cita se registra el mismo día o después, no por adelantado.");
    const inicio = aHoraUTC(texto(cuerpo.hora, 5) || horaBogota());
    const duracion = DURACIONES.includes(Number(cuerpo.duracion)) ? Number(cuerpo.duracion) : 30;
    const minutosFin = Math.min(inicio.getUTCHours() * 60 + inicio.getUTCMinutes() + duracion, 23 * 60 + 59);
    const fin = new Date(Date.UTC(1970, 0, 1, Math.floor(minutosFin / 60), minutosFin % 60));
    return { fecha, horaInicio: inicio, horaFin: fin };
  }

  // El estudiante llega sin cita y se le atiende: queda como cita atendida
  // sobre un horario creado en el momento (sinCita), que no se publica.
  async registrarSinCita(adminId, cuerpo = {}) {
    const servicio = await this.repos.servicios.buscarPorId(String(cuerpo.servicioId || ""));
    if (!servicio) throw new AppError(400, "Elige el servicio que prestaste.");
    const franja = this.franjaSinCita(cuerpo);
    const observaciones = texto(cuerpo.observaciones, 2000) || null;

    return prisma.$transaction(async (tx) => {
      const r = reposCon(tx);
      const usuario = await this.resolverEstudiante(cuerpo, r);
      const horario = await r.horarios.crear({ servicioId: servicio.id, ...franja, cupo: 1, ocupado: true, sinCita: true });
      const cita = await r.citas.crear({ usuarioId: usuario.id, horarioId: horario.id, estado: "Atendida", observaciones });
      await r.asistencias.crear({ citaId: cita.id, asistio: true, registradoPorId: adminId });
      return r.citas.completa(cita.id);
    });
  }
}

module.exports = { AgendaService, agendaService: new AgendaService() };
