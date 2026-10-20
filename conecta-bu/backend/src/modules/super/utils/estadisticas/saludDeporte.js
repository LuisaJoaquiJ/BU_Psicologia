const { contarPor, ordenar, redondear } = require("../conteos");
const { CATEGORIAS_SALUD } = require("../etiquetas");
const { hoyBogota } = require("../../../../common/utils/fechas");

// Atenciones de Salud integral en el periodo.
function seccionSalud(atenciones, actividades, p) {
  const enRango = atenciones.filter((a) => p.enActual(a.fecha));
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
  const porCategoria = contarPor(enRango, (a) => actividadPorId.get(a.actividadId)?.categoria || "Otra");
  return {
    total: enRango.length,
    anterior: atenciones.filter((a) => p.enAnterior(a.fecha)).length,
    resumen: {
      atenciones: enRango.length,
      remisiones: enRango.filter((a) => a.remitido).length,
      personas: new Set(enRango.map((a) => a.personaId)).size,
      porPoblacion: ordenar(contarPor(enRango, (a) => a.poblacion)),
      porCategoria: ordenar(porCategoria, CATEGORIAS_SALUD),
    },
  };
}

// Periodo academico de Deporte: "2026-1" (enero a junio) o "2026-2".
function periodoAcademico(fecha = hoyBogota()) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

// Horas de deporte acumuladas por estudiante: clases a las que asistio,
// horas reconocidas y eventos con horas a los que asistio.
function horasPorUsuario({ sesiones, asistencias, manuales, inscEventos, eventos }) {
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const horas = new Map();
  const sumar = (id, h) => horas.set(id, (horas.get(id) || 0) + (h || 0));
  for (const a of asistencias) if (sesionPorId.has(a.sesionId)) sumar(a.usuarioId, sesionPorId.get(a.sesionId).horas);
  for (const m of manuales) sumar(m.usuarioId, m.horas);
  for (const i of inscEventos) {
    const e = eventoPorId.get(i.eventoId);
    if (e?.horasReconocidas) sumar(i.usuarioId, e.horasReconocidas);
  }
  for (const [id, h] of horas) horas.set(id, redondear(h));
  return horas;
}

// Deporte: horas del periodo, avance hacia las horas requeridas y grupos
// del periodo academico actual.
function seccionDeporte(d, p) {
  const sesionPorId = new Map(d.sesiones.map((s) => [s.id, s]));
  const fechaDe = (a) => sesionPorId.get(a.sesionId)?.fecha;
  const horasDe = (lista) => lista.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0);
  const enRango = d.asistencias.filter((a) => p.enActual(fechaDe(a)));
  const anteriores = d.asistencias.filter((a) => p.enAnterior(fechaDe(a)));

  const requeridas = d.config.horasRequeridas;
  const horas = horasPorUsuario(d);
  const inscritosTodos = new Set(d.inscripciones.map((i) => i.usuarioId));
  const totales = [...new Set([...inscritosTodos, ...horas.keys()])].map((id) => horas.get(id) || 0);
  const tramos = [
    { id: "0", nombre: "Sin horas", min: 0, max: 0 },
    { id: "1", nombre: `Menos de ${Math.round(requeridas / 2)} h`, min: 0.01, max: requeridas / 2 },
    { id: "2", nombre: `${Math.round(requeridas / 2)} a ${requeridas - 1} h`, min: requeridas / 2, max: requeridas },
    { id: "3", nombre: `${requeridas} h o más`, min: requeridas, max: Infinity },
  ];

  const periodo = periodoAcademico();
  const grupos = d.grupos.filter((g) => g.periodo === periodo);
  const idsGrupos = new Set(grupos.map((g) => g.id));
  const inscPeriodo = d.inscripciones.filter((i) => idsGrupos.has(i.grupoId));
  // Inscritos por disciplina (tambien las que aun no tienen inscritos).
  const disciplina = new Map(d.disciplinas.map((x) => [x.id, x.nombre]));
  const porDisciplina = {};
  for (const g of [...grupos].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))) {
    const k = disciplina.get(g.disciplinaId) || "—";
    porDisciplina[k] = (porDisciplina[k] || 0) + inscPeriodo.filter((i) => i.grupoId === g.id).length;
  }

  return {
    horas: redondear(horasDe(enRango)),
    horasAnterior: redondear(horasDe(anteriores)),
    estudiantes: new Set(enRango.map((a) => a.usuarioId)).size,
    resumen: {
      periodo,
      requeridas,
      inscritos: new Set(inscPeriodo.map((i) => i.usuarioId)).size,
      gruposActivos: grupos.filter((g) => g.activo).length,
      cumplieron: [...horas.values()].filter((h) => h >= requeridas).length,
      porDisciplina: ordenar(porDisciplina).map((x) => ({ id: x.nombre, nombre: x.nombre, total: x.total })),
      avanceHoras: tramos.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        total: totales.filter((h) => (t.max === 0 ? h === 0 : h >= t.min && h < t.max)).length,
      })),
    },
  };
}

module.exports = { seccionSalud, seccionDeporte, horasPorUsuario, periodoAcademico };
