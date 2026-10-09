const { prisma } = require("../../config/prisma");
const { moduloDeServicio } = require("../../common/utils/modulos");
const { CATEGORIAS } = require("../salud/catalogos");
const { TIPOS: TIPOS_SST } = require("../salud/sst.catalogos");
const deporte = require("../deporte/deporte.service");
const { crearPeriodo, variacion, mesActual, aDia, aDiaBogota, iso } = require("../../common/utils/periodos");

// Tablero del superadministrador: cifras de todos los modulos de Bienestar
// en un mismo periodo (semana, mes, trimestre o año), comparadas con el
// periodo anterior de la misma duracion.

const ESTADOS_CITA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const ESTADOS_SST = ["Recibido", "Verificado", "RequiereAjustes", "Cerrado"];

// "2026-10" a partir de una fecha (las fechas @db.Date llegan en UTC).
function claveMes(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function contarPor(lista, clave) {
  const mapa = {};
  for (const x of lista) {
    const k = clave(x);
    if (k === null || k === undefined) continue;
    mapa[k] = (mapa[k] || 0) + 1;
  }
  return mapa;
}

const ordenar = (mapa, etiquetas = {}) =>
  Object.entries(mapa)
    .map(([id, total]) => ({ id, nombre: etiquetas[id] || id, total }))
    .sort((a, b) => b.total - a.total);

const tasa = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);

async function estadisticas({ periodo } = {}) {
  const p = crearPeriodo(periodo);
  const enRango = (fecha) => p.enActual(fecha);
  const enAnterior = (fecha) => p.enAnterior(fecha);

  const [usuarios, citas, eventos, inscripciones, atenciones, actividades, reportes, sesiones, asistencias, config, resumenDeporte, horas] =
    await Promise.all([
      prisma.usuario.findMany({ include: { rol: true } }),
      prisma.cita.findMany({ include: { horario: { include: { servicio: true } } } }),
      prisma.evento.findMany(),
      prisma.inscripcion.findMany({ include: { asistencia: true } }),
      prisma.atencionSalud.findMany(),
      prisma.actividadSalud.findMany(),
      prisma.reporteSST.findMany(),
      prisma.sesionDeporte.findMany(),
      prisma.asistenciaDeporte.findMany({ where: { presente: true } }),
      deporte.obtenerConfig(),
      deporte.resumen(),
      deporte.horasDe(),
    ]);

  // ---- Citas (Desarrollo Humano y Salud comparten la agenda) ----
  const citasRango = citas.filter((c) => enRango(c.horario?.fecha));
  const citasDe = (m) => citasRango.filter((c) => moduloDeServicio(c.horario?.servicio) === m);
  const estadosDe = (lista) => {
    const conteo = contarPor(lista, (c) => c.estado);
    const fila = Object.fromEntries(ESTADOS_CITA.map((e) => [e, conteo[e] || 0]));
    const registradas = fila.Atendida + fila.NoAsistio;
    return { ...fila, total: lista.length, tasaAsistencia: tasa(fila.Atendida, registradas) };
  };
  const citasDH = citasDe("desarrollo-humano");
  const citasSalud = citasDe("salud");

  // ---- Eventos de Desarrollo Humano ----
  // Inscripciones hechas en el periodo (por la fecha en que la persona se
  // inscribio), y eventos del periodo, con inscripciones en el o proximos.
  const publicados = eventos.filter((e) => ["Publicado", "Cerrado"].includes(e.estado));
  const idsPublicados = new Set(publicados.map((e) => e.id));
  const confirmadas = inscripciones.filter((i) => i.estado === "Confirmada" && idsPublicados.has(i.eventoId));
  const inscRango = confirmadas.filter((i) => enRango(aDiaBogota(i.fechaInscripcion)));
  const conInscripcion = new Set(inscRango.map((i) => i.eventoId));
  const hoyDia = aDia(new Date(Date.now() - 5 * 3600 * 1000));
  const eventosRango = publicados.filter((e) => enRango(e.fecha) || conInscripcion.has(e.id) || aDia(e.fecha) >= hoyDia);
  const idsEventos = new Set(eventosRango.map((e) => e.id));
  const inscEventos = confirmadas.filter((i) => idsEventos.has(i.eventoId));
  const porEvento = new Map();
  for (const i of inscEventos) {
    const r = porEvento.get(i.eventoId) || { inscritos: 0, asistieron: 0, registrados: 0 };
    r.inscritos += 1;
    if (i.asistencia) {
      r.registrados += 1;
      if (i.asistencia.asistio) r.asistieron += 1;
    }
    porEvento.set(i.eventoId, r);
  }
  const eventosDetalle = eventosRango
    .map((e) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, cupos: e.cupos, ...(porEvento.get(e.id) || { inscritos: 0, asistieron: 0, registrados: 0 }) }))
    .sort((a, b) => b.inscritos - a.inscritos);
  const asistenciaRegistrada = eventosDetalle.reduce((s, e) => s + e.registrados, 0);
  const asistieronEventos = eventosDetalle.reduce((s, e) => s + e.asistieron, 0);
  const cuposEventos = eventosDetalle.reduce((s, e) => s + e.cupos, 0);

  // ---- Salud ----
  const atencionesRango = atenciones.filter((a) => enRango(a.fecha));
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
  const porCategoria = contarPor(atencionesRango, (a) => actividadPorId.get(a.actividadId)?.categoria || "Otra");

  // ---- Deporte ----
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const asistenciasRango = asistencias.filter((a) => enRango(sesionPorId.get(a.sesionId)?.fecha));
  const horasRango = asistenciasRango.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0);
  const requeridas = config.horasRequeridas;
  const tramos = [
    { id: "0", nombre: "Sin horas", min: 0, max: 0 },
    { id: "1", nombre: `Menos de ${Math.round(requeridas / 2)} h`, min: 0.01, max: requeridas / 2 },
    { id: "2", nombre: `${Math.round(requeridas / 2)} a ${requeridas - 1} h`, min: requeridas / 2, max: requeridas },
    { id: "3", nombre: `${requeridas} h o más`, min: requeridas, max: Infinity },
  ];
  const inscritosDeporte = new Set((await prisma.inscripcionDeporte.findMany({ where: { estado: "Activa" } })).map((i) => i.usuarioId));
  const totalesDeporte = [...new Set([...inscritosDeporte, ...horas.keys()])].map((id) => horas.get(id)?.total || 0);
  const avanceHoras = tramos.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    total: totalesDeporte.filter((h) => (t.max === 0 ? h === 0 : h >= t.min && h < t.max)).length,
  }));

  // ---- Salidas y reportes SST ----
  const reportesRango = reportes.filter((r) => enRango(r.fechaCreacion));
  const etiquetasSst = Object.fromEntries(Object.entries(TIPOS_SST).map(([id, t]) => [id, t.corto || t.nombre]));
  const estadosSst = contarPor(reportesRango, (r) => r.estado);

  // ---- Tendencia: participaciones de cada modulo por cubeta del periodo ----
  // Una participacion = una cita no cancelada, una inscripcion a un evento,
  // una atencion de salud o una asistencia a una clase de deporte.
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const fechaInsc = (i) => aDiaBogota(i.fechaInscripcion);
  const fuentes = {
    "desarrollo-humano": [
      [citas.filter((c) => c.estado !== "Cancelada" && moduloDeServicio(c.horario?.servicio) === "desarrollo-humano"), (c) => c.horario?.fecha],
      [inscripciones.filter((i) => i.estado === "Confirmada" && ["Publicado", "Cerrado"].includes(eventoPorId.get(i.eventoId)?.estado)), fechaInsc],
    ],
    salud: [
      [atenciones, (a) => a.fecha],
      [citas.filter((c) => c.estado !== "Cancelada" && moduloDeServicio(c.horario?.servicio) === "salud"), (c) => c.horario?.fecha],
    ],
    deporte: [[asistencias, (a) => sesionPorId.get(a.sesionId)?.fecha]],
  };
  const tendencia = p.cubetas.map((c) => ({ mes: c.clave, etiqueta: c.etiqueta, "desarrollo-humano": 0, salud: 0, deporte: 0 }));
  const cubetaPorClave = new Map(tendencia.map((t) => [t.clave || t.mes, t]));
  const participacionesAnt = { "desarrollo-humano": 0, salud: 0, deporte: 0 };
  for (const [modulo, lista] of Object.entries(fuentes)) {
    for (const [items, fecha] of lista) {
      for (const x of items) {
        const f = fecha(x);
        const k = p.cubetaDe(f);
        if (k) cubetaPorClave.get(k)[modulo] += 1;
        else if (enAnterior(f)) participacionesAnt[modulo] += 1;
      }
    }
  }
  const totalModulo = (m) => tendencia.reduce((s, t) => s + t[m], 0);

  // ---- Periodo anterior (para comparar) ----
  const citasAnt = citas.filter((c) => enAnterior(c.horario?.fecha));
  const atencionesAnt = atenciones.filter((a) => enAnterior(a.fecha));
  const inscAnt = inscripciones.filter((i) => i.estado === "Confirmada" && enAnterior(fechaInsc(i)));
  const asistAnt = asistencias.filter((a) => enAnterior(sesionPorId.get(a.sesionId)?.fecha));
  const horasAnt = asistAnt.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0);
  const reportesAnt = reportes.filter((r) => enAnterior(r.fechaCreacion));
  const participAct = ["desarrollo-humano", "salud", "deporte"].reduce((s, m) => s + totalModulo(m), 0);
  const participAnt = Object.values(participacionesAnt).reduce((s, n) => s + n, 0);

  // ---- Calendario del mes: actividad por dia y modulo ----
  const mes = mesActual();
  const dias = {};
  for (const [modulo, lista] of Object.entries(fuentes)) {
    for (const [items, fecha] of lista) {
      for (const x of items) {
        const d = aDia(fecha(x));
        if (!d || d < mes.desde || d > mes.hasta) continue;
        const k = iso(d);
        dias[k] = dias[k] || { "desarrollo-humano": 0, salud: 0, deporte: 0 };
        dias[k][modulo] += 1;
      }
    }
  }

  // ---- Actividad reciente en todos los modulos ----
  const servicioDe = (c) => c.horario?.servicio;
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const nombre = (id) => String(usuarioPorId.get(id)?.nombre || "Un estudiante").split(" ")[0];
  const actividad = [
    ...citas.map((c) => ({
      modulo: moduloDeServicio(servicioDe(c)),
      tipo: c.estado === "Cancelada" ? "cancelada" : "cita",
      fecha: c.estado === "Cancelada" ? c.fechaActualizacion || c.fechaAgendamiento : c.fechaAgendamiento,
      texto: `${nombre(c.usuarioId)} ${c.estado === "Cancelada" ? "canceló una cita" : c.horario?.sinCita ? "fue atendido sin cita" : "agendó una cita"}`,
      detalle: servicioDe(c)?.nombre,
    })),
    ...inscripciones
      .filter((i) => i.estado === "Confirmada")
      .map((i) => ({ modulo: "desarrollo-humano", tipo: "inscripcion", fecha: i.fechaInscripcion, texto: `${nombre(i.usuarioId)} se inscribió a un evento`, detalle: eventoPorId.get(i.eventoId)?.nombre })),
    ...atenciones.map((a) => ({ modulo: "salud", tipo: "atencion", fecha: a.fechaRegistro, texto: "Atención de salud registrada", detalle: actividadPorId.get(a.actividadId)?.nombre })),
    ...sesiones.map((s) => ({ modulo: "deporte", tipo: "sesion", fecha: s.fechaRegistro, texto: "Asistencia de deporte tomada", detalle: s.tema || `${s.inicio} a ${s.fin}` })),
    ...reportes.map((r) => ({ modulo: "salud", tipo: "sst", fecha: r.fechaCreacion, texto: "Nuevo reporte de salida o seguridad", detalle: etiquetasSst[r.tipo] || r.tipo })),
  ]
    .filter((a) => a.fecha && !Number.isNaN(new Date(a.fecha).getTime()))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 8)
    .map((a) => ({ ...a, fecha: new Date(a.fecha).toISOString() }));

  // ---- Usuarios ----
  const porRol = contarPor(usuarios, (x) => x.rol?.nombre);
  const nuevos = contarPor(usuarios, (x) => p.cubetaDe(aDiaBogota(x.fechaCreacion)));

  const personasDeporte = new Set(asistenciasRango.map((a) => a.usuarioId));
  return {
    periodo: p.periodo,
    texto: p.texto,
    textoAnterior: p.textoAnterior,
    desde: p.desde,
    hasta: p.hasta,
    kpis: [
      { id: "participaciones", titulo: "Participaciones", valor: participAct, anterior: participAnt, variacion: variacion(participAct, participAnt), serie: tendencia.map((t) => t["desarrollo-humano"] + t.salud + t.deporte) },
      { id: "citas", titulo: "Citas", valor: citasDH.length + citasSalud.length, anterior: citasAnt.length, variacion: variacion(citasDH.length + citasSalud.length, citasAnt.length) },
      { id: "atenciones", titulo: "Atenciones de salud", valor: atencionesRango.length, anterior: atencionesAnt.length, variacion: variacion(atencionesRango.length, atencionesAnt.length), serie: tendencia.map((t) => t.salud) },
      { id: "inscritos", titulo: "Inscritos a eventos", valor: inscRango.length, anterior: inscAnt.length, variacion: variacion(inscRango.length, inscAnt.length) },
      { id: "horas", titulo: "Horas de deporte", valor: Math.round(horasRango * 10) / 10, anterior: Math.round(horasAnt * 10) / 10, unidad: "h", variacion: variacion(horasRango, horasAnt), serie: tendencia.map((t) => t.deporte) },
      { id: "sst", titulo: "Reportes SST", valor: reportesRango.length, anterior: reportesAnt.length, variacion: variacion(reportesRango.length, reportesAnt.length) },
    ],
    porModulo: ["desarrollo-humano", "salud", "deporte"].map((m) => ({ id: m, total: totalModulo(m), anterior: participacionesAnt[m], variacion: variacion(totalModulo(m), participacionesAnt[m]) })),
    calendario: { mes: mes.clave, hoy: mes.hoy, dias },
    actividad,
    totales: {
      participaciones: participAct,
      citas: citasDH.length + citasSalud.length,
      atenciones: atencionesRango.length,
      inscritosEventos: inscRango.length,
      horasDeporte: Math.round(horasRango * 10) / 10,
      estudiantesDeporte: personasDeporte.size,
      reportesSst: reportesRango.length,
      usuarios: usuarios.length,
    },
    tendencia,
    citas: {
      "desarrollo-humano": estadosDe(citasDH),
      salud: estadosDe(citasSalud),
    },
    eventos: {
      total: eventosDetalle.length,
      inscritos: inscRango.length,
      cupos: cuposEventos,
      ocupacion: tasa(inscEventos.length, cuposEventos),
      tasaAsistencia: tasa(asistieronEventos, asistenciaRegistrada),
      top: eventosDetalle.slice(0, 6).map(({ id, nombre, cupos, inscritos, asistieron }) => ({ id, nombre, cupos, inscritos, asistieron })),
    },
    salud: {
      atenciones: atencionesRango.length,
      remisiones: atencionesRango.filter((a) => a.remitido).length,
      personas: new Set(atencionesRango.map((a) => a.personaId)).size,
      porPoblacion: ordenar(contarPor(atencionesRango, (a) => a.poblacion)),
      porCategoria: ordenar(porCategoria, CATEGORIAS),
    },
    deporte: {
      periodo: resumenDeporte.periodo,
      requeridas,
      inscritos: resumenDeporte.inscritos,
      gruposActivos: resumenDeporte.gruposActivos,
      cumplieron: resumenDeporte.cumplieron,
      porDisciplina: resumenDeporte.porDisciplina.map((d) => ({ id: d.nombre, nombre: d.nombre, total: d.total })),
      avanceHoras,
    },
    sst: {
      total: reportesRango.length,
      porTipo: ordenar(contarPor(reportesRango, (r) => r.tipo), etiquetasSst),
      porEstado: Object.fromEntries(ESTADOS_SST.map((e) => [e, estadosSst[e] || 0])),
    },
    usuarios: {
      total: usuarios.length,
      porRol,
      nuevosPorMes: p.cubetas.map((m) => ({ mes: m.clave, etiqueta: m.etiqueta, total: nuevos[m.clave] || 0 })),
    },
  };
}

module.exports = { estadisticas, claveMes };
