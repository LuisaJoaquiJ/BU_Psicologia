const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const disciplinas = require("./DisciplinaService");
const u = require("../utils");

// Eventos deportivos puntuales (F-02 PISU: RF-002, RF-018, RF-020): la
// coordinacion los crea y toma la asistencia; el estudiante se inscribe.
class EventoService {
  async inscritosPorEvento(ids) {
    return u.contarPor(await repos.inscripcionesEvento.activasDeEventos(ids), "eventoId");
  }

  serializar(e, listaDisciplinas, inscritos = 0) {
    const hoy = hoyBogota();
    const disciplina = listaDisciplinas.find((d) => d.id === e.disciplinaId);
    return {
      ...imagenes.conImagen("eventos", e),
      fecha: u.fechaISO(e.fecha),
      fechaLimite: u.fechaISO(e.fechaLimite),
      disciplina: disciplina?.nombre || null,
      // Foto de respaldo cuando el evento no tiene la suya.
      disciplinaImagenUrl: imagenes.urlImagen("disciplinas", disciplina),
      inscritos,
      cuposDisponibles: e.cupo ? Math.max(0, e.cupo - inscritos) : null,
      inscripcionAbierta: e.estado === "Publicado" && new Date(e.fechaLimite || e.fecha) >= hoy && (!e.cupo || inscritos < e.cupo),
      yaPaso: new Date(e.fecha) < hoy,
      asistenciaDesde: u.instanteBogota(e.fecha, e.horaInicio).toISOString(),
      asistenciaHasta: u.instanteBogota(e.fecha, e.horaFin).toISOString(),
    };
  }

  async obtenerOFallar(id) {
    const evento = await repos.eventos.buscarPorId(id);
    if (!evento) throw new AppError(404, "El evento no existe.");
    return evento;
  }

  async listar() {
    const [eventos, lista] = await Promise.all([repos.eventos.listar({}, { fecha: "desc" }), repos.disciplinas.listar()]);
    const inscritos = await this.inscritosPorEvento(eventos.map((e) => e.id));
    return eventos.map((e) => this.serializar(e, lista, inscritos.get(e.id) || 0));
  }

  async crear(cuerpo, usuario) {
    const data = this.datos(cuerpo);
    this.validarFechas(data);
    if (data.disciplinaId) await disciplinas.exigirExistente(data.disciplinaId);
    if (data.fecha < hoyBogota()) throw new AppError(400, "La fecha del evento ya pasó.");
    const evento = await repos.eventos.crear({ ...data, creadoPor: usuario?.emailInstitucional || null });
    return this.detalle(evento.id);
  }

  async actualizar(id, cuerpo) {
    const actual = await this.obtenerOFallar(id);
    const data = this.datos(cuerpo, true);
    this.validarFechas({ ...actual, ...data });
    if (data.cupo) {
      const inscritos = (await this.inscritosPorEvento([id])).get(id) || 0;
      if (data.cupo < inscritos) throw new AppError(409, `El evento ya tiene ${inscritos} inscritos; el cupo no puede ser menor.`);
    }
    await repos.eventos.actualizar(id, data);
    return this.detalle(id);
  }

  async detalle(id) {
    const evento = await this.obtenerOFallar(id);
    const [lista, inscripciones] = await Promise.all([repos.disciplinas.listar(), repos.inscripcionesEvento.listar({ eventoId: id })]);
    const usuarios = await repos.usuarios.listarPorIds(inscripciones.map((i) => i.usuarioId));
    const activas = inscripciones.filter((i) => i.estado === "Activa");
    return {
      ...this.serializar(evento, lista, activas.length),
      inscritosLista: activas
        .map((i) => {
          const x = usuarios.find((y) => y.id === i.usuarioId);
          return { usuarioId: i.usuarioId, nombre: x?.nombre || "—", email: x?.emailInstitucional || "", categoria: u.categoriaDe(x), asistio: i.asistio, fechaInscripcion: i.fechaInscripcion };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  // Asistencia (solo mientras dura el evento): quien asistio suma sus horas.
  async registrarAsistencia(id, presentes) {
    const evento = await this.obtenerOFallar(id);
    u.exigirQueEmpiece(evento.fecha, evento.horaInicio, "el evento");
    u.exigirQueNoTermine(evento.fecha, evento.horaFin, "el evento");
    if (!Array.isArray(presentes)) throw new AppError(400, "Envía la lista de asistentes.");
    const activas = await repos.inscripcionesEvento.activasDeEventos([id]);
    if (presentes.some((p) => !activas.some((i) => i.usuarioId === p))) throw new AppError(400, "Hay personas en la lista que no están inscritas en el evento.");
    for (const i of activas) await repos.inscripcionesEvento.actualizar(i.id, { asistio: presentes.includes(i.usuarioId) });
    if (evento.estado === "Publicado") await repos.eventos.actualizar(id, { estado: "Finalizado" });
    return this.detalle(id);
  }

  validarFechas(evento) {
    if (evento.fechaLimite && evento.fechaLimite > evento.fecha) throw new AppError(400, "La fecha límite de inscripción no puede ser posterior al evento.");
  }

  datos(cuerpo = {}, parcial = false) {
    const data = {};
    const pide = (campo) => !parcial || cuerpo[campo] !== undefined;
    if (pide("nombre")) {
      data.nombre = u.texto(cuerpo.nombre, 150);
      if (!data.nombre) throw new AppError(400, "Escribe el nombre del evento.");
    }
    if (pide("tipo")) {
      data.tipo = cuerpo.tipo || "Torneo";
      if (!u.TIPOS_EVENTO.includes(data.tipo)) throw new AppError(400, `El tipo debe ser uno de: ${u.TIPOS_EVENTO.join(", ")}.`);
    }
    if (cuerpo.descripcion !== undefined) data.descripcion = u.texto(cuerpo.descripcion, 1500);
    if (cuerpo.disciplinaId !== undefined) data.disciplinaId = cuerpo.disciplinaId || null;
    if (pide("fecha")) data.fecha = aFechaUTC(String(cuerpo.fecha || "").slice(0, 10), "fecha del evento");
    if (pide("horaInicio") || cuerpo.horaFin !== undefined) {
      data.horaInicio = u.hora(cuerpo.horaInicio, "La hora de inicio");
      data.horaFin = u.hora(cuerpo.horaFin, "La hora final");
      u.horasEntre(data.horaInicio, data.horaFin);
    }
    if (cuerpo.lugar !== undefined) data.lugar = u.texto(cuerpo.lugar, 150);
    if (cuerpo.cupo !== undefined) data.cupo = this.cupo(cuerpo.cupo);
    if (cuerpo.fechaLimite !== undefined) data.fechaLimite = cuerpo.fechaLimite ? aFechaUTC(String(cuerpo.fechaLimite).slice(0, 10), "fecha límite") : null;
    if (cuerpo.horasReconocidas !== undefined) data.horasReconocidas = this.horasReconocidas(cuerpo.horasReconocidas);
    if (cuerpo.categorias !== undefined) data.categorias = u.validarCategorias(cuerpo.categorias);
    if (cuerpo.estado !== undefined) {
      if (!u.ESTADOS_EVENTO.includes(cuerpo.estado)) throw new AppError(400, "Estado de evento no válido.");
      data.estado = cuerpo.estado;
    }
    return data;
  }

  // Vacio = sin limite.
  cupo(valor) {
    if (valor === null || valor === "") return null;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 1 || n > 5000) throw new AppError(400, "El cupo debe estar entre 1 y 5000, o vacío si no tiene límite.");
    return n;
  }

  // Vacio o 0 = no reconoce horas.
  horasReconocidas(valor) {
    if (valor === null || valor === "" || Number(valor) === 0) return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0.5 || n > 40) throw new AppError(400, "Las horas reconocidas deben estar entre 0,5 y 40.");
    return n;
  }
}

module.exports = new EventoService();
