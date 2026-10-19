const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const configuracion = require("./ConfigService");
const horas = require("./HorasService");
const u = require("../utils");

// Estudiantes de Deporte: su avance, categoria y horas reconocidas por la coordinacion.
class EstudianteService {
  async listar({ q, estado, categoria } = {}) {
    const [inscripciones, manuales, config] = await Promise.all([repos.inscripciones.listar(), repos.horasManuales.listar(), configuracion.obtener()]);
    const usuarios = await this.buscarUsuarios(u.texto(q, 80), new Set([...inscripciones, ...manuales].map((x) => x.usuarioId)));
    const periodo = u.periodoActual();
    const [mapa, gruposPeriodo] = await Promise.all([horas.horasDe(usuarios.map((x) => x.id)), repos.grupos.listar({ periodo })]);
    const lista = usuarios.map((x) => {
      const h = mapa.get(x.id) || horas.vacio();
      return {
        id: x.id,
        nombre: x.nombre,
        email: x.emailInstitucional,
        categoria: u.categoriaDe(x),
        total: h.total,
        horasPeriodo: h.porPeriodo[periodo] || 0,
        cumplido: h.total >= config.horasRequeridas,
        porcentaje: Math.min(100, Math.round((h.total / config.horasRequeridas) * 1000) / 10),
        gruposActivos: inscripciones
          .filter((i) => i.usuarioId === x.id && i.estado === "Activa")
          .map((i) => gruposPeriodo.find((g) => g.id === i.grupoId)?.nombre)
          .filter(Boolean),
      };
    });
    let filtrada = estado === "cumplieron" ? lista.filter((x) => x.cumplido) : estado === "pendientes" ? lista.filter((x) => !x.cumplido) : lista;
    if (categoria) filtrada = filtrada.filter((x) => x.categoria === categoria);
    return { requeridas: config.horasRequeridas, estudiantes: filtrada.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre)) };
  }

  // Con busqueda: estudiantes (o quien ya participa) que coinciden; sin ella: los que participan.
  async buscarUsuarios(busqueda, participan) {
    if (busqueda) return (await repos.usuarios.buscarTexto(busqueda)).filter((x) => x.rol?.nombre === "Estudiante" || participan.has(x.id)).slice(0, 100);
    return repos.usuarios.listarPorIds([...participan]);
  }

  async obtenerOFallar(usuarioId) {
    const usuario = (await repos.usuarios.listarPorIds([usuarioId]))[0];
    if (!usuario) throw new AppError(404, "El estudiante no existe.");
    return usuario;
  }

  async detalle(usuarioId) {
    const usuario = await this.obtenerOFallar(usuarioId);
    const [progreso, grupos, inscripciones, disciplinas] = await Promise.all([
      horas.progresoDe(usuarioId),
      repos.grupos.listar(),
      repos.inscripciones.listar({ usuarioId }),
      repos.disciplinas.listar(),
    ]);
    return {
      estudiante: { id: usuario.id, nombre: usuario.nombre, email: usuario.emailInstitucional, categoria: u.categoriaDe(usuario) },
      ...progreso,
      inscripciones: inscripciones
        .map((i) => {
          const g = grupos.find((x) => x.id === i.grupoId);
          return { grupoId: i.grupoId, grupo: g?.nombre, disciplina: disciplinas.find((d) => d.id === g?.disciplinaId)?.nombre, periodo: g?.periodo, estado: i.estado, fechaInscripcion: i.fechaInscripcion };
        })
        .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo))),
    };
  }

  // RF-005: la coordinacion define la categoria del estudiante.
  async actualizarCategoria(usuarioId, categoria) {
    await this.obtenerOFallar(usuarioId);
    if (!u.CATEGORIAS.includes(categoria)) throw new AppError(400, "La categoría debe ser Pregrado, Posgrado o Egresado.");
    await repos.usuarios.actualizar(usuarioId, { categoriaEstudiante: categoria });
    return this.detalle(usuarioId);
  }

  // Horas por torneos, representacion o eventos externos.
  async reconocerHoras(usuarioId, cuerpo = {}, registradoPor) {
    await this.obtenerOFallar(usuarioId);
    const cantidad = Number(cuerpo.horas);
    if (!Number.isFinite(cantidad) || cantidad < 0.5 || cantidad > 40) throw new AppError(400, "Las horas deben estar entre 0,5 y 40.");
    const motivo = u.texto(cuerpo.motivo, 200);
    if (!motivo) throw new AppError(400, "Escribe el motivo (torneo, evento, representación…).");
    const fecha = cuerpo.fecha ? aFechaUTC(String(cuerpo.fecha).slice(0, 10), "fecha") : hoyBogota();
    if (fecha > hoyBogota()) throw new AppError(400, "La fecha no puede ser futura.");
    let disciplinaId = null;
    if (cuerpo.disciplinaId) {
      if (!(await repos.disciplinas.buscarPorId(cuerpo.disciplinaId))) throw new AppError(400, "La disciplina no existe.");
      disciplinaId = cuerpo.disciplinaId;
    }
    await repos.horasManuales.crear({ usuarioId, horas: u.redondear(cantidad), motivo, fecha, disciplinaId, registradoPor });
    return this.detalle(usuarioId);
  }

  async eliminarHoras(id) {
    const fila = await repos.horasManuales.buscarPorId(id);
    if (!fila) throw new AppError(404, "El registro no existe.");
    await repos.horasManuales.eliminar(id);
    return this.detalle(fila.usuarioId);
  }
}

module.exports = new EstudianteService();
