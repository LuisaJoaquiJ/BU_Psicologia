const repos = require("../repositories");
const configuracion = require("./ConfigService");
const { fechaISO, redondear, porId, periodoDeFecha, periodoActual } = require("../utils");

// Horas de deporte de cada estudiante: clases a las que asistio, horas que le
// reconocio la coordinacion y eventos con horas a los que asistio.
const VACIO = () => ({ total: 0, porPeriodo: {}, porDisciplina: {}, historial: [] });

class HorasService {
  // Map(usuarioId -> { total, porPeriodo, porDisciplina, historial }) de todos o de los indicados.
  async horasDe(usuarioIds) {
    const filtro = usuarioIds ? { usuarioId: { in: usuarioIds } } : {};
    const [asistencias, manuales, eventosAsistidos, disciplinas] = await Promise.all([
      repos.asistencias.listar({ ...filtro, presente: true }),
      repos.horasManuales.listar(filtro),
      repos.inscripcionesEvento.listar({ ...filtro, estado: "Activa", asistio: true }),
      repos.disciplinas.listar(),
    ]);
    const sesiones = await repos.sesiones.listarPorIds(asistencias.map((a) => a.sesionId));
    const [grupos, eventos] = await Promise.all([
      repos.grupos.listarPorIds(sesiones.map((s) => s.grupoId)),
      repos.eventos.listarPorIds(eventosAsistidos.map((i) => i.eventoId)),
    ]);
    const ctx = { sesiones: porId(sesiones), grupos: porId(grupos), disciplinas: porId(disciplinas), eventos: porId(eventos) };

    const porUsuario = new Map();
    const sumar = (usuarioId, item) => {
      if (!porUsuario.has(usuarioId)) porUsuario.set(usuarioId, VACIO());
      const r = porUsuario.get(usuarioId);
      r.total += item.horas;
      r.porPeriodo[item.periodo] = (r.porPeriodo[item.periodo] || 0) + item.horas;
      r.porDisciplina[item.disciplina] = (r.porDisciplina[item.disciplina] || 0) + item.horas;
      r.historial.push(item);
    };
    for (const a of asistencias) {
      const item = this.deAsistencia(a, ctx);
      if (item) sumar(a.usuarioId, item);
    }
    for (const m of manuales) sumar(m.usuarioId, this.deReconocimiento(m, ctx));
    for (const i of eventosAsistidos) {
      const item = this.deEvento(i, ctx);
      if (item) sumar(i.usuarioId, item);
    }
    for (const r of porUsuario.values()) this.redondearTotales(r);
    return porUsuario;
  }

  deAsistencia(a, ctx) {
    const s = ctx.sesiones.get(a.sesionId);
    if (!s) return null;
    const g = ctx.grupos.get(s.grupoId);
    const disciplina = ctx.disciplinas.get(g?.disciplinaId)?.nombre || "—";
    return { tipo: "asistencia", id: s.id, fecha: fechaISO(s.fecha), horas: s.horas, disciplina, grupo: g?.nombre, detalle: s.tema || `${s.inicio} a ${s.fin}`, periodo: periodoDeFecha(s.fecha) };
  }

  deReconocimiento(m, ctx) {
    const disciplina = ctx.disciplinas.get(m.disciplinaId)?.nombre || "Reconocimiento";
    return { tipo: "reconocida", id: m.id, fecha: fechaISO(m.fecha), horas: m.horas, disciplina, grupo: null, detalle: m.motivo, periodo: periodoDeFecha(m.fecha), registradoPor: m.registradoPor };
  }

  // Solo eventos que reconocen horas.
  deEvento(i, ctx) {
    const e = ctx.eventos.get(i.eventoId);
    if (!e?.horasReconocidas) return null;
    const disciplina = ctx.disciplinas.get(e.disciplinaId)?.nombre || "Eventos";
    return { tipo: "evento", id: e.id, fecha: fechaISO(e.fecha), horas: e.horasReconocidas, disciplina, grupo: null, detalle: `${e.tipo}: ${e.nombre}`, periodo: periodoDeFecha(e.fecha) };
  }

  redondearTotales(r) {
    r.total = redondear(r.total);
    for (const k of Object.keys(r.porPeriodo)) r.porPeriodo[k] = redondear(r.porPeriodo[k]);
    for (const k of Object.keys(r.porDisciplina)) r.porDisciplina[k] = redondear(r.porDisciplina[k]);
    r.historial.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }

  vacio() {
    return VACIO();
  }

  // Avance de un estudiante hacia las horas requeridas.
  async progresoDe(usuarioId) {
    const [mapa, config] = await Promise.all([this.horasDe([usuarioId]), configuracion.obtener()]);
    const h = mapa.get(usuarioId) || VACIO();
    const periodo = periodoActual();
    return {
      requeridas: config.horasRequeridas,
      total: h.total,
      faltan: redondear(Math.max(0, config.horasRequeridas - h.total)),
      porcentaje: Math.min(100, Math.round((h.total / config.horasRequeridas) * 1000) / 10),
      cumplido: h.total >= config.horasRequeridas,
      periodo,
      horasPeriodo: h.porPeriodo[periodo] || 0,
      porDisciplina: Object.entries(h.porDisciplina)
        .map(([nombre, horas]) => ({ nombre, horas }))
        .sort((a, b) => b.horas - a.horas),
      porPeriodo: Object.entries(h.porPeriodo)
        .map(([p, horas]) => ({ periodo: p, horas }))
        .sort((a, b) => b.periodo.localeCompare(a.periodo)),
      historial: h.historial,
    };
  }
}

module.exports = new HorasService();
