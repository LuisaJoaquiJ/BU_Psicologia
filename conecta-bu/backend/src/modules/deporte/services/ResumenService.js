const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const configuracion = require("./ConfigService");
const horas = require("./HorasService");
const grupos = require("./GrupoService");
const estudiantes = require("./EstudianteService");
const u = require("../utils");

// Inicio del personal de Deporte (cifras del periodo, clases de hoy,
// ocupacion de cupos) y datos del reporte en Excel.
class ResumenService {
  async resumen() {
    const periodo = u.periodoActual();
    const hoy = hoyBogota();
    const [{ grupos: lista }, config, sesionesHoy] = await Promise.all([grupos.listar({ periodo }), configuracion.obtener(), repos.sesiones.listar({ fecha: hoy })]);
    const ids = lista.map((g) => g.id);
    const [inscripciones, sesiones] = await Promise.all([repos.inscripciones.activasDeGrupos(ids), repos.sesiones.deGrupos(ids)]);
    const asistencias = await repos.asistencias.deSesiones(sesiones.map((s) => s.id));
    const totales = [...(await horas.horasDe()).entries()].map(([id, h]) => ({ id, total: h.total }));
    const sesionPorId = u.porId(sesiones);
    const presentes = asistencias.filter((a) => a.presente);
    return {
      periodo,
      requeridas: config.horasRequeridas,
      gruposActivos: lista.filter((g) => g.activo).length,
      inscritos: new Set(inscripciones.map((i) => i.usuarioId)).size,
      sesiones: sesiones.length,
      horasOtorgadas: u.redondear(presentes.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0)),
      asistenciaPromedio: asistencias.length ? Math.round((presentes.length / asistencias.length) * 1000) / 10 : null,
      cumplieron: totales.filter((t) => t.total >= config.horasRequeridas).length,
      clasesHoy: this.clasesDeHoy(lista, sesionesHoy, hoy),
      porDisciplina: this.inscritosPorDisciplina(lista),
      ocupacion: this.ocupacion(lista),
      actualizado: new Date().toISOString(),
      cercaDeCumplir: await this.cercaDeCumplir(totales, config.horasRequeridas),
    };
  }

  // Grupos con clase hoy y desde/hasta cuando se toma la asistencia.
  clasesDeHoy(lista, sesionesHoy, hoy) {
    const dia = u.diaSemana(hoy);
    return lista
      .filter((g) => g.activo && (g.horario || []).some((h) => h.dia === dia))
      .map((g) => {
        const franja = g.horario.find((h) => h.dia === dia);
        return {
          id: g.id,
          nombre: g.nombre,
          disciplina: g.disciplina?.nombre,
          franja,
          lugar: g.lugar,
          docente: g.docente?.nombre || g.instructor,
          inscritos: g.inscritos,
          asistenciaTomada: sesionesHoy.some((s) => s.grupoId === g.id),
          disponibleDesde: u.instanteBogota(hoy, franja.inicio).toISOString(),
          disponibleHasta: u.instanteBogota(hoy, franja.fin).toISOString(),
        };
      })
      .sort((a, b) => a.franja.inicio.localeCompare(b.franja.inicio));
  }

  inscritosPorDisciplina(lista) {
    const suma = new Map();
    for (const g of lista) suma.set(g.disciplina?.nombre || "—", (suma.get(g.disciplina?.nombre || "—") || 0) + g.inscritos);
    return [...suma.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
  }

  // RF-012: ocupacion de cupos por grupo y por disciplina.
  ocupacion(lista) {
    const activos = lista.filter((g) => g.activo);
    const ocupadosDe = (g) => Math.min(g.inscritos, g.cupo);
    const pct = (ocupados, cupos) => (cupos ? Math.round((ocupados / cupos) * 1000) / 10 : 0);
    const cupos = activos.reduce((s, g) => s + g.cupo, 0);
    const ocupados = activos.reduce((s, g) => s + ocupadosDe(g), 0);
    const porDisc = new Map();
    for (const g of activos) {
      const k = g.disciplina?.nombre || "—";
      const x = porDisc.get(k) || { nombre: k, cupos: 0, ocupados: 0, grupos: 0 };
      x.cupos += g.cupo;
      x.ocupados += ocupadosDe(g);
      x.grupos += 1;
      porDisc.set(k, x);
    }
    return {
      cupos,
      ocupados,
      libres: Math.max(0, cupos - ocupados),
      porcentaje: pct(ocupados, cupos),
      llenos: activos.filter((g) => g.inscritos >= g.cupo).length,
      porDisciplina: [...porDisc.values()].map((x) => ({ ...x, libres: x.cupos - x.ocupados, porcentaje: pct(x.ocupados, x.cupos) })).sort((a, b) => b.porcentaje - a.porcentaje),
      porGrupo: activos
        .map((g) => ({ id: g.id, nombre: g.nombre, disciplina: g.disciplina?.nombre, docente: g.docente?.nombre || g.instructor, cupo: g.cupo, inscritos: g.inscritos, libres: Math.max(0, g.cupo - g.inscritos), porcentaje: pct(ocupadosDe(g), g.cupo) }))
        .sort((a, b) => b.porcentaje - a.porcentaje),
    };
  }

  // Estudiantes con el 75 % o mas de las horas (sin completarlas).
  async cercaDeCumplir(totales, requeridas) {
    const cerca = totales.filter((t) => t.total < requeridas && t.total >= requeridas * 0.75).sort((a, b) => b.total - a.total).slice(0, 8);
    const usuarios = await repos.usuarios.listarPorIds(cerca.map((c) => c.id));
    return cerca.map((c) => {
      const x = usuarios.find((y) => y.id === c.id);
      return { id: c.id, nombre: x?.nombre, email: x?.emailInstitucional, total: c.total };
    });
  }

  // Datos del reporte en Excel del periodo: estudiantes, grupos y asistencia.
  async datosReporte({ periodo } = {}) {
    const { periodo: per, grupos: lista } = await grupos.listar({ periodo });
    const { requeridas, estudiantes: listaEstudiantes } = await estudiantes.listar();
    const sesiones = await repos.sesiones.deGrupos(lista.map((g) => g.id), { fecha: "asc" });
    const asistencias = await repos.asistencias.deSesiones(sesiones.map((s) => s.id));
    const usuarios = await repos.usuarios.listarPorIds(asistencias.map((a) => a.usuarioId));
    const filas = asistencias.map((a) => {
      const s = sesiones.find((x) => x.id === a.sesionId);
      const g = lista.find((x) => x.id === s.grupoId);
      const usuario = usuarios.find((x) => x.id === a.usuarioId);
      return { fecha: u.fechaISO(s.fecha), disciplina: g?.disciplina?.nombre, grupo: g?.nombre, nombre: usuario?.nombre, email: usuario?.emailInstitucional, presente: a.presente, horas: s.horas };
    });
    filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.grupo).localeCompare(String(b.grupo)) || String(a.nombre).localeCompare(String(b.nombre)));
    return { periodo: per, requeridas, estudiantes: listaEstudiantes, grupos: lista, asistencias: filas };
  }
}

module.exports = new ResumenService();
