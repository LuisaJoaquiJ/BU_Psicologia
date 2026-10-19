const { AppError } = require("../../../common/utils/AppError");
const { prisma } = require("../../../config/prisma");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const configuracion = require("./ConfigService");
const grupos = require("./GrupoService");
const u = require("../utils");

// Inscripcion de estudiantes a los grupos: oferta, inscribir, retirar y "mis grupos".
class InscripcionService {
  // Oferta del periodo para el estudiante, con su estado en cada grupo.
  async oferta(usuario) {
    const periodo = u.periodoActual();
    const [disciplinas, lista, mias, config] = await Promise.all([
      repos.disciplinas.listarOrdenadas({ soloActivas: true }),
      repos.grupos.delPeriodo(periodo, { activo: true }),
      repos.inscripciones.activasDeUsuario(usuario.id),
      configuracion.obtener(),
    ]);
    const [inscritos, porDocente] = await Promise.all([grupos.conteoInscritos(lista.map((g) => g.id)), grupos.mapaDocentes()]);
    const mios = new Set(mias.map((i) => i.grupoId));
    const misDelPeriodo = lista.filter((g) => mios.has(g.id));
    const conEstado = (g, d) => {
      const cruce = mios.has(g.id) ? null : misDelPeriodo.find((m) => u.cruceEntre(m.horario, g.horario));
      return { ...grupos.serializar(g, d, inscritos.get(g.id) || 0, porDocente), inscrito: mios.has(g.id), cruceCon: cruce ? cruce.nombre : null };
    };
    return {
      periodo,
      categoria: u.categoriaDe(usuario),
      maxGruposPorPeriodo: config.maxGruposPorPeriodo,
      inscritoEn: misDelPeriodo.length,
      actualizado: new Date().toISOString(),
      disciplinas: disciplinas.map((d) => ({
        ...imagenes.conImagen("disciplinas", d),
        restriccion: u.restriccionCategoria(d.categorias, usuario),
        grupos: lista.filter((g) => g.disciplinaId === d.id).map((g) => conEstado(g, d)),
      })),
    };
  }

  // RF-019: la inscripcion corre en una transaccion que bloquea la fila del
  // grupo (SELECT ... FOR UPDATE) para que dos solicitudes simultaneas no
  // tomen el ultimo cupo a la vez (RN-003, RNF-006).
  async inscribir(grupoId, usuarioId, opciones = {}) {
    if (typeof prisma.$transaction !== "function") return this.inscribirCon(prisma, grupoId, usuarioId, opciones);
    return prisma.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === "function") await tx.$queryRaw`SELECT id FROM deporte_grupos WHERE id = ${grupoId} FOR UPDATE`;
      return this.inscribirCon(tx, grupoId, usuarioId, opciones);
    });
  }

  // Reglas de la inscripcion con el cliente "db" (el de la transaccion).
  // "porPersonal": la coordinacion puede inscribir aunque el grupo este lleno (RF-009).
  async inscribirCon(db, grupoId, usuarioId, { porPersonal = false } = {}) {
    const r = this.repositorios(db);
    const grupo = await r.grupos.buscarPorId(grupoId);
    if (!grupo) throw new AppError(404, "El grupo no existe.");
    if (!grupo.activo) throw new AppError(409, "Este grupo no está activo.");
    if (!porPersonal) await this.validarParaEstudiante(r, grupo, usuarioId);

    const existente = await r.inscripciones.buscarUno({ grupoId, usuarioId });
    if (existente?.estado === "Activa") throw new AppError(409, "Ya estás inscrito en este grupo.", "YA_INSCRITO");
    const inscritos = await r.inscripciones.contarActivas(grupoId);
    if (!porPersonal && inscritos >= grupo.cupo) throw new AppError(409, "El grupo no tiene cupos disponibles.", "SIN_CUPO");

    const otros = (await r.grupos.listarPorIds((await r.inscripciones.activasDeUsuario(usuarioId)).map((a) => a.grupoId))).filter(
      (g) => g.periodo === grupo.periodo && g.id !== grupoId
    );
    if (!porPersonal) {
      const config = (await r.config.buscarPorId(1)) || { maxGruposPorPeriodo: 2 };
      if (otros.length >= config.maxGruposPorPeriodo) throw new AppError(409, `Puedes inscribirte máximo en ${config.maxGruposPorPeriodo} grupo(s) por periodo.`, "MAXIMO_GRUPOS");
    }
    const cruce = otros.find((g) => u.cruceEntre(g.horario, grupo.horario));
    if (cruce) throw new AppError(409, `El horario se cruza con tu grupo ${cruce.nombre}.`, "CRUCE_HORARIO");

    if (existente) return r.inscripciones.actualizar(existente.id, { estado: "Activa", fechaRetiro: null, fechaInscripcion: new Date() });
    return r.inscripciones.crear({ grupoId, usuarioId });
  }

  // Periodo actual, inscripciones abiertas y categoria permitida (RN-002).
  async validarParaEstudiante(r, grupo, usuarioId) {
    if (grupo.periodo !== u.periodoActual()) throw new AppError(409, "Solo puedes inscribirte a grupos del periodo actual.");
    if (!grupo.inscripcionesAbiertas) throw new AppError(409, "Las inscripciones de este grupo están cerradas.", "INSCRIPCIONES_CERRADAS");
    const [disciplina, usuario] = await Promise.all([r.disciplinas.buscarPorId(grupo.disciplinaId), r.usuarios.buscarPorId(usuarioId)]);
    const restriccion = u.restriccionCategoria(disciplina?.categorias, usuario);
    if (restriccion) throw new AppError(409, `No puedes inscribirte en ${disciplina.nombre}: ${restriccion}`, "CATEGORIA_NO_PERMITIDA");
  }

  repositorios(db) {
    const c = repos.clases;
    return {
      grupos: new c.GrupoRepository(db),
      inscripciones: new c.InscripcionRepository(db),
      disciplinas: new c.DisciplinaRepository(db),
      usuarios: new c.UsuarioRepository(db),
      config: new c.ConfigRepository(db),
    };
  }

  async retirar(grupoId, usuarioId) {
    const inscripcion = await repos.inscripciones.buscarUno({ grupoId, usuarioId, estado: "Activa" });
    if (!inscripcion) throw new AppError(404, "No hay una inscripción activa en este grupo.");
    await repos.inscripciones.actualizar(inscripcion.id, { estado: "Retirada", fechaRetiro: new Date() });
    return { retirado: true };
  }

  // La coordinacion inscribe por correo (el estudiante debe haber ingresado una vez).
  async inscribirPorCorreo(grupoId, email) {
    const correo = String(email || "").trim().toLowerCase();
    if (!correo) throw new AppError(400, "Escribe el correo institucional del estudiante.");
    const usuario = await repos.usuarios.porEmail(correo);
    if (!usuario) throw new AppError(404, "Ese correo aún no ha ingresado a Conecta BU. El estudiante debe iniciar sesión una vez.", "USUARIO_NO_ENCONTRADO");
    await this.inscribir(grupoId, usuario.id, { porPersonal: true });
    return grupos.detalle(grupoId);
  }

  // Grupos del estudiante en el periodo, con su asistencia (RF-022).
  async misGrupos(usuarioId) {
    const activas = await repos.inscripciones.activasDeUsuario(usuarioId);
    if (!activas.length) return [];
    const periodo = u.periodoActual();
    const propios = (await repos.grupos.listarPorIds(activas.map((a) => a.grupoId))).filter((g) => g.periodo === periodo);
    const [disciplinas, porDocente, sesiones] = await Promise.all([repos.disciplinas.listar(), grupos.mapaDocentes(), repos.sesiones.deGrupos(propios.map((g) => g.id))]);
    const asistencias = await repos.asistencias.deSesiones(sesiones.map((x) => x.id), { usuarioId });
    return propios.map((g) => ({
      ...grupos.serializar(g, disciplinas.find((d) => d.id === g.disciplinaId), 0, porDocente),
      asistencia: this.asistenciaEnGrupo(sesiones.filter((x) => x.grupoId === g.id), asistencias),
    }));
  }

  asistenciaEnGrupo(delGrupo, asistencias) {
    const propias = asistencias.filter((a) => delGrupo.some((x) => x.id === a.sesionId));
    const presentes = propias.filter((a) => a.presente).length;
    return {
      clases: propias.length,
      presentes,
      fallas: propias.length - presentes,
      porcentaje: propias.length ? Math.round((presentes / propias.length) * 1000) / 10 : null,
      ultimas: delGrupo
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 8)
        .map((x) => ({ fecha: u.fechaISO(x.fecha), presente: propias.find((a) => a.sesionId === x.id)?.presente ?? null, tema: x.tema })),
    };
  }
}

module.exports = new InscripcionService();
