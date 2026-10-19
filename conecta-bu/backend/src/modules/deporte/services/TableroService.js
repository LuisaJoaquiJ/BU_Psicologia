const { crearPeriodo, variacion } = require("../utils/periodosTablero");
const repos = require("../repositories");
const configuracion = require("./ConfigService");
const horas = require("./HorasService");
const u = require("../utils");
const { AgendaTablero } = require("./AgendaTablero");

// Tablero de Deporte para la coordinacion: asistencia, horas otorgadas,
// clases dictadas y estudiantes activos, comparados con el periodo anterior
// de la misma duracion (semana, mes, trimestre o año), y los datos de cada grafica.
const ORIGENES = { asistencia: "Clases", evento: "Eventos", reconocida: "Reconocidas" };

class TableroService {
  async tablero({ periodo } = {}) {
    const p = crearPeriodo(periodo);
    const d = await this.cargarDatos();
    const serie = p.cubetas.map((c) => ({ ...c, Presentes: 0, Ausentes: 0, horas: 0, sesiones: 0, activos: 0 }));
    const cuenta = this.contarClases(p, d, serie);
    const { origen, horasDisciplina } = this.contarHoras(p, d, serie, cuenta);
    const agenda = new AgendaTablero(d);
    const asisAct = u.porcentaje(cuenta.act.presentes, cuenta.act.presentes + cuenta.act.ausentes);
    const asisAnt = u.porcentaje(cuenta.ant.presentes, cuenta.ant.presentes + cuenta.ant.ausentes);
    return {
      periodo: p.periodo,
      texto: p.texto,
      textoAnterior: p.textoAnterior,
      periodoAcademico: u.periodoActual(),
      requeridas: d.config.horasRequeridas,
      kpis: this.kpis(serie, cuenta, asisAct, asisAnt),
      serie,
      origen: Object.fromEntries(Object.entries(origen).map(([k, v]) => [k, u.redondear(v)])),
      avance: this.avance(d),
      ocupacion: this.ocupacion(d, horasDisciplina),
      horasPorDisciplina: [...horasDisciplina.entries()].map(([nombre, h]) => ({ nombre, horas: u.redondear(h) })).sort((a, b) => b.horas - a.horas),
      asistenciaGrupos: this.asistenciaPorGrupo(p, d),
      docentes: this.clasesPorDocente(p, d),
      calendario: agenda.calendario(),
      proximosEventos: agenda.proximosEventos(),
      inventario: agenda.inventario(),
      actividad: agenda.actividad(),
    };
  }

  async cargarDatos() {
    const [config, sesiones, asistencias, grupos, disciplinas, inscripciones, eventos, inscEventos, manuales, implementos, prestamos, docentes, horasPorUsuario] = await Promise.all([
      configuracion.obtener(),
      repos.sesiones.listar(),
      repos.asistencias.listar(),
      repos.grupos.listar(),
      repos.disciplinas.listar(),
      repos.inscripciones.listar(),
      repos.eventos.listar(),
      repos.inscripcionesEvento.listar(),
      repos.horasManuales.listar(),
      repos.implementos.listar(),
      repos.prestamos.listar(),
      repos.docentes.listar(),
      horas.horasDe(),
    ]);
    const usuarioIds = [...new Set([...inscripciones, ...inscEventos, ...manuales].map((x) => x.usuarioId))];
    const usuarios = await repos.usuarios.listarPorIds(usuarioIds);
    return { config, sesiones, asistencias, grupos, disciplinas, inscripciones, eventos, inscEventos, manuales, implementos, prestamos, docentes, horasPorUsuario, usuarioIds, usuarios };
  }

  // Clases dictadas y presentes/ausentes del periodo actual y del anterior.
  contarClases(p, d, serie) {
    const porClave = new Map(serie.map((s) => [s.clave, s]));
    const vacio = () => ({ presentes: 0, ausentes: 0, sesiones: 0, horas: 0, activos: new Set() });
    const cuenta = { act: vacio(), ant: vacio() };
    const lado = (fecha) => (p.enActual(fecha) ? "act" : p.enAnterior(fecha) ? "ant" : null);
    for (const s of d.sesiones) {
      const l = lado(s.fecha);
      if (l) cuenta[l].sesiones += 1;
      if (l === "act" && p.cubetaDe(s.fecha)) porClave.get(p.cubetaDe(s.fecha)).sesiones += 1;
    }
    const sesionPorId = u.porId(d.sesiones);
    for (const a of d.asistencias) {
      const s = sesionPorId.get(a.sesionId);
      const l = s && lado(s.fecha);
      if (!l) continue;
      cuenta[l][a.presente ? "presentes" : "ausentes"] += 1;
      if (l === "act" && p.cubetaDe(s.fecha)) porClave.get(p.cubetaDe(s.fecha))[a.presente ? "Presentes" : "Ausentes"] += 1;
    }
    return cuenta;
  }

  // Horas otorgadas (clases, eventos y reconocidas) a partir del historial de cada estudiante.
  contarHoras(p, d, serie, cuenta) {
    const porClave = new Map(serie.map((s) => [s.clave, s]));
    const activosPorCubeta = new Map();
    const origen = { Clases: 0, Eventos: 0, Reconocidas: 0 };
    const horasDisciplina = new Map();
    for (const [usuarioId, h] of d.horasPorUsuario) {
      for (const item of h.historial) {
        const l = p.enActual(item.fecha) ? "act" : p.enAnterior(item.fecha) ? "ant" : null;
        if (!l) continue;
        cuenta[l].horas += item.horas;
        cuenta[l].activos.add(usuarioId);
        if (l !== "act") continue;
        origen[ORIGENES[item.tipo]] += item.horas;
        horasDisciplina.set(item.disciplina, (horasDisciplina.get(item.disciplina) || 0) + item.horas);
        const k = p.cubetaDe(item.fecha);
        if (!k) continue;
        porClave.get(k).horas += item.horas;
        (activosPorCubeta.get(k) || activosPorCubeta.set(k, new Set()).get(k)).add(usuarioId);
      }
    }
    for (const s of serie) {
      s.horas = u.redondear(s.horas);
      s.activos = activosPorCubeta.get(s.clave)?.size || 0;
    }
    return { origen, horasDisciplina };
  }

  kpis(serie, cuenta, asisAct, asisAnt) {
    const horasAct = u.redondear(cuenta.act.horas);
    const horasAnt = u.redondear(cuenta.ant.horas);
    return [
      {
        id: "asistencia",
        titulo: "Asistencia a clases",
        valor: asisAct,
        unidad: "%",
        puntos: asisAct !== null && asisAnt !== null ? Math.round((asisAct - asisAnt) * 10) / 10 : null,
        serie: serie.map((s) => u.porcentaje(s.Presentes, s.Presentes + s.Ausentes)),
      },
      { id: "horas", titulo: "Horas otorgadas", valor: horasAct, unidad: "h", variacion: variacion(horasAct, horasAnt), serie: serie.map((s) => s.horas) },
      { id: "sesiones", titulo: "Clases dictadas", valor: cuenta.act.sesiones, variacion: variacion(cuenta.act.sesiones, cuenta.ant.sesiones), serie: serie.map((s) => s.sesiones) },
      { id: "activos", titulo: "Estudiantes con horas", valor: cuenta.act.activos.size, variacion: variacion(cuenta.act.activos.size, cuenta.ant.activos.size), serie: serie.map((s) => s.activos) },
    ];
  }

  // Avance hacia el requisito de quienes participan en Deporte.
  avance(d) {
    const req = d.config.horasRequeridas;
    const avance = { Completaron: 0, Cerca: 0, EnCurso: 0, Iniciando: 0 };
    for (const id of d.usuarioIds) {
      const pct = (d.horasPorUsuario.get(id)?.total || 0) / req;
      if (pct >= 1) avance.Completaron += 1;
      else if (pct >= 0.75) avance.Cerca += 1;
      else if (pct >= 0.25) avance.EnCurso += 1;
      else avance.Iniciando += 1;
    }
    return { ...avance, total: d.usuarioIds.length };
  }

  // Cupos e inscritos por disciplina en el periodo academico en curso.
  ocupacion(d, horasDisciplina) {
    const periodo = u.periodoActual();
    const activas = u.contarPor(d.inscripciones.filter((i) => i.estado === "Activa"), "grupoId");
    const disciplinaPorId = u.porId(d.disciplinas);
    const porDisciplina = new Map();
    for (const g of d.grupos.filter((x) => x.periodo === periodo && x.activo)) {
      const r = porDisciplina.get(g.disciplinaId) || { id: g.disciplinaId, nombre: disciplinaPorId.get(g.disciplinaId)?.nombre || "—", inscritos: 0, cupo: 0, grupos: 0 };
      r.inscritos += activas.get(g.id) || 0;
      r.cupo += g.cupo;
      r.grupos += 1;
      porDisciplina.set(g.disciplinaId, r);
    }
    return [...porDisciplina.values()].map((r) => ({ ...r, horas: u.redondear(horasDisciplina.get(r.nombre) || 0) })).sort((a, b) => b.inscritos - a.inscritos);
  }

  asistenciaPorGrupo(p, d) {
    const sesionPorId = u.porId(d.sesiones);
    const grupoPorId = u.porId(d.grupos);
    const asis = new Map();
    for (const a of d.asistencias) {
      const s = sesionPorId.get(a.sesionId);
      if (!s || !p.enActual(s.fecha)) continue;
      const r = asis.get(s.grupoId) || { presentes: 0, total: 0 };
      r.total += 1;
      if (a.presente) r.presentes += 1;
      asis.set(s.grupoId, r);
    }
    const sesiones = u.contarPor(d.sesiones.filter((s) => p.enActual(s.fecha)), "grupoId");
    return [...asis.entries()]
      .map(([id, r]) => ({ id, nombre: grupoPorId.get(id)?.nombre || "—", asistencia: u.porcentaje(r.presentes, r.total), sesiones: sesiones.get(id) || 0 }))
      .sort((a, b) => b.asistencia - a.asistencia);
  }

  clasesPorDocente(p, d) {
    const grupoPorId = u.porId(d.grupos);
    const docentePorId = u.porId(d.docentes);
    const porDocente = new Map();
    for (const s of d.sesiones.filter((x) => p.enActual(x.fecha))) {
      const g = grupoPorId.get(s.grupoId);
      const nombre = docentePorId.get(g?.docenteId)?.nombre || g?.instructor || "Sin docente";
      const r = porDocente.get(nombre) || { nombre, sesiones: 0, horas: 0 };
      r.sesiones += 1;
      r.horas += s.horas;
      porDocente.set(nombre, r);
    }
    return [...porDocente.values()].map((r) => ({ ...r, horas: u.redondear(r.horas) })).sort((a, b) => b.sesiones - a.sesiones);
  }
}

module.exports = new TableroService();
