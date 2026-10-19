const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const docentes = require("./DocenteService");
const disciplinas = require("./DisciplinaService");
const u = require("../utils");

// Grupos de la oferta de cada periodo: disciplina, horario, lugar, docente y cupo.
class GrupoService {
  async obtenerOFallar(id) {
    const grupo = await repos.grupos.buscarPorId(id);
    if (!grupo) throw new AppError(404, "El grupo no existe.");
    return grupo;
  }

  // Map(grupoId -> inscritos activos).
  async conteoInscritos(grupoIds) {
    return u.contarPor(await repos.inscripciones.activasDeGrupos(grupoIds), "grupoId");
  }

  // Docentes por id, para mostrar el nombre del docente de cada grupo.
  async mapaDocentes() {
    return u.porId(await repos.docentes.listar());
  }

  serializar(g, disciplina, inscritos = 0, porDocente) {
    const docente = g.docenteId && porDocente ? porDocente.get(g.docenteId) : null;
    return {
      ...g,
      instructor: docente?.nombre || g.instructor,
      docente: docente ? { id: docente.id, nombre: docente.nombre, email: docente.email, activo: docente.activo } : null,
      disciplina: disciplina
        ? { id: disciplina.id, nombre: disciplina.nombre, tipo: disciplina.tipo, categorias: disciplina.categorias || [], imagenUrl: imagenes.urlImagen("disciplinas", disciplina) }
        : null,
      horarioTexto: u.textoHorario(g.horario),
      horasSemana: u.redondear(u.horasSemana(g.horario)),
      inscritos,
      cuposDisponibles: Math.max(0, g.cupo - inscritos),
    };
  }

  async listar({ periodo, docenteId } = {}) {
    const per = periodo ? u.validarPeriodo(periodo) : u.periodoActual();
    const [grupos, listaDisciplinas, porDocente] = await Promise.all([
      repos.grupos.delPeriodo(per, docenteId ? { docenteId } : {}),
      repos.disciplinas.listar(),
      this.mapaDocentes(),
    ]);
    const ids = grupos.map((g) => g.id);
    const [inscritos, sesiones] = await Promise.all([this.conteoInscritos(ids), repos.sesiones.deGrupos(ids)]);
    return {
      periodo: per,
      grupos: grupos.map((g) => {
        const delGrupo = sesiones.filter((s) => s.grupoId === g.id);
        return {
          ...this.serializar(g, listaDisciplinas.find((d) => d.id === g.disciplinaId), inscritos.get(g.id) || 0, porDocente),
          sesiones: delGrupo.length,
          horasDictadas: u.redondear(delGrupo.reduce((s, x) => s + x.horas, 0)),
        };
      }),
    };
  }

  async crear(cuerpo) {
    const data = this.datos(cuerpo);
    const disciplina = await disciplinas.exigirExistente(data.disciplinaId);
    await docentes.validarAsignacion(data.docenteId, { ...data, id: null });
    const grupo = await repos.grupos.crear(data);
    return this.serializar(grupo, disciplina, 0, await this.mapaDocentes());
  }

  async actualizar(id, cuerpo) {
    const grupo = await this.obtenerOFallar(id);
    const data = this.datos(cuerpo, true);
    if (data.cupo !== undefined) {
      const inscritos = (await this.conteoInscritos([id])).get(id) || 0;
      if (data.cupo < inscritos) throw new AppError(409, `El grupo ya tiene ${inscritos} inscritos; el cupo no puede ser menor.`);
    }
    if (data.disciplinaId) await disciplinas.exigirExistente(data.disciplinaId);
    // RF-007: sin cruces de horario para el docente (al asignarlo o al cambiar el horario).
    const docenteId = data.docenteId !== undefined ? data.docenteId : grupo.docenteId;
    if (docenteId && (data.docenteId !== undefined || data.horario || data.periodo)) await docentes.validarAsignacion(docenteId, { ...grupo, ...data });
    await repos.grupos.actualizar(grupo.id, data);
    return this.detalle(grupo.id);
  }

  // Detalle con inscritos, sesiones y la sugerencia para tomar la asistencia de hoy.
  async detalle(id) {
    const grupo = await this.obtenerOFallar(id);
    const [disciplina, inscripciones, sesiones, porDocente] = await Promise.all([
      repos.disciplinas.buscarPorId(grupo.disciplinaId),
      repos.inscripciones.listar({ grupoId: id }),
      repos.sesiones.listar({ grupoId: id }, { fecha: "desc" }),
      this.mapaDocentes(),
    ]);
    const [usuarios, asistencias] = await Promise.all([
      repos.usuarios.listarPorIds(inscripciones.map((i) => i.usuarioId)),
      repos.asistencias.deSesiones(sesiones.map((s) => s.id)),
    ]);
    const activas = inscripciones.filter((i) => i.estado === "Activa");
    return {
      ...this.serializar(grupo, disciplina, activas.length, porDocente),
      inscritos: this.inscritosConAsistencia(inscripciones, usuarios, asistencias, u.porId(sesiones)),
      totalInscritos: activas.length,
      sesiones: sesiones.map((s) => {
        const deLaSesion = asistencias.filter((a) => a.sesionId === s.id);
        return {
          ...s,
          fecha: u.fechaISO(s.fecha),
          presentes: deLaSesion.filter((a) => a.presente).map((a) => a.usuarioId),
          registrados: deLaSesion.length,
          editableHasta: docentes.editableHasta(s).toISOString(),
        };
      }),
      sugerenciaSesion: this.sugerenciaDeHoy(grupo, sesiones),
    };
  }

  inscritosConAsistencia(inscripciones, usuarios, asistencias, sesionPorId) {
    return inscripciones
      .map((i) => {
        const usuario = usuarios.find((x) => x.id === i.usuarioId);
        const propias = asistencias.filter((a) => a.usuarioId === i.usuarioId);
        const presentes = propias.filter((a) => a.presente);
        return {
          usuarioId: i.usuarioId,
          nombre: usuario?.nombre || "—",
          email: usuario?.emailInstitucional || "",
          categoria: u.categoriaDe(usuario),
          estado: i.estado,
          fechaInscripcion: i.fechaInscripcion,
          asistencias: presentes.length,
          sesionesRegistradas: propias.length,
          horas: u.redondear(presentes.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0)),
        };
      })
      .sort((a, b) => (a.estado === b.estado ? a.nombre.localeCompare(b.nombre) : a.estado === "Activa" ? -1 : 1));
  }

  // Clase de hoy segun el horario: desde y hasta cuando se toma la asistencia.
  sugerenciaDeHoy(grupo, sesiones) {
    const hoy = hoyBogota();
    const franja = (grupo.horario || []).find((h) => h.dia === u.diaSemana(hoy));
    return {
      fecha: u.fechaISO(hoy),
      inicio: franja?.inicio || grupo.horario?.[0]?.inicio || "",
      fin: franja?.fin || grupo.horario?.[0]?.fin || "",
      hoyTieneClase: Boolean(franja),
      disponibleDesde: franja ? u.instanteBogota(hoy, franja.inicio).toISOString() : null,
      disponibleHasta: franja ? u.instanteBogota(hoy, franja.fin).toISOString() : null,
      yaTomada: franja ? sesiones.some((s) => u.fechaISO(s.fecha) === u.fechaISO(hoy) && s.inicio === franja.inicio) : false,
    };
  }

  datos(cuerpo = {}, parcial = false) {
    const data = {};
    const pide = (campo) => !parcial || cuerpo[campo] !== undefined;
    if (pide("disciplinaId")) {
      if (!cuerpo.disciplinaId) throw new AppError(400, "Elige la disciplina.");
      data.disciplinaId = cuerpo.disciplinaId;
    }
    if (pide("periodo")) data.periodo = u.validarPeriodo(cuerpo.periodo || u.periodoActual());
    if (pide("nombre")) {
      data.nombre = u.texto(cuerpo.nombre, 80);
      if (!data.nombre) throw new AppError(400, "Escribe el nombre del grupo (por ejemplo, Natación · Grupo 1).");
    }
    if (cuerpo.instructor !== undefined) data.instructor = u.texto(cuerpo.instructor, 150);
    if (cuerpo.docenteId !== undefined) data.docenteId = cuerpo.docenteId || null;
    if (cuerpo.lugar !== undefined) data.lugar = u.texto(cuerpo.lugar, 150);
    if (pide("cupo")) {
      const cupo = Number(cuerpo.cupo ?? 25);
      if (!Number.isInteger(cupo) || cupo < 1 || cupo > 500) throw new AppError(400, "El cupo debe estar entre 1 y 500.");
      data.cupo = cupo;
    }
    if (pide("horario")) data.horario = u.validarHorario(cuerpo.horario);
    if (cuerpo.inscripcionesAbiertas !== undefined) data.inscripcionesAbiertas = cuerpo.inscripcionesAbiertas === true;
    if (cuerpo.activo !== undefined) data.activo = cuerpo.activo === true;
    return data;
  }
}

module.exports = new GrupoService();
