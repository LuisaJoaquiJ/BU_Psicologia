const { prisma } = require("../../config/prisma");
const { moduloDeServicio } = require("../../common/utils/modulos");
const { CATEGORIAS } = require("../salud/catalogos");
const { TIPOS: TIPOS_SST } = require("../salud/sst.catalogos");
const deporte = require("../deporte/deporte.service");

// Tablero del superadministrador: cifras de todos los modulos de Bienestar
// en un mismo rango de meses (por defecto, los ultimos 6 incluido el actual).

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ESTADOS_CITA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const ESTADOS_SST = ["Recibido", "Verificado", "RequiereAjustes", "Cerrado"];

// "2026-10" a partir de una fecha (las fechas @db.Date llegan en UTC).
function claveMes(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Meses del rango, del mas antiguo al actual (hora de Bogota, UTC-5).
function mesesDelRango(cantidad) {
  const ahora = new Date(Date.now() - 5 * 3600 * 1000);
  const lista = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    const clave = claveMes(d);
    lista.push({ clave, etiqueta: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` });
  }
  return lista;
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

async function estadisticas({ meses } = {}) {
  const cantidad = [3, 6, 12].includes(Number(meses)) ? Number(meses) : 6;
  const rango = mesesDelRango(cantidad);
  const claves = new Set(rango.map((m) => m.clave));
  const enRango = (fecha) => claves.has(claveMes(fecha));

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
  const eventosRango = eventos.filter((e) => ["Publicado", "Cerrado"].includes(e.estado) && enRango(e.fecha));
  const idsEventos = new Set(eventosRango.map((e) => e.id));
  const inscRango = inscripciones.filter((i) => i.estado === "Confirmada" && idsEventos.has(i.eventoId));
  const porEvento = new Map();
  for (const i of inscRango) {
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

  // ---- Tendencia mensual: participaciones de cada modulo ----
  const sumarMes = (lista, fecha) => contarPor(lista.filter((x) => enRango(fecha(x))), (x) => claveMes(fecha(x)));
  const dhMes = [
    sumarMes(citasDH.filter((c) => c.estado !== "Cancelada"), (c) => c.horario?.fecha),
    sumarMes(inscRango, (i) => eventosRango.find((e) => e.id === i.eventoId)?.fecha),
  ];
  const saludMes = [sumarMes(atencionesRango, (a) => a.fecha), sumarMes(citasSalud.filter((c) => c.estado !== "Cancelada"), (c) => c.horario?.fecha)];
  const deporteMes = [sumarMes(asistenciasRango, (a) => sesionPorId.get(a.sesionId)?.fecha)];
  const suma = (mapas, k) => mapas.reduce((s, m) => s + (m[k] || 0), 0);
  const tendencia = rango.map((m) => ({
    mes: m.clave,
    etiqueta: m.etiqueta,
    "desarrollo-humano": suma(dhMes, m.clave),
    salud: suma(saludMes, m.clave),
    deporte: suma(deporteMes, m.clave),
  }));

  // ---- Usuarios ----
  const porRol = contarPor(usuarios, (x) => x.rol?.nombre);
  const nuevos = sumarMes(usuarios, (x) => x.fechaCreacion);

  const personasDeporte = new Set(asistenciasRango.map((a) => a.usuarioId));
  return {
    meses: cantidad,
    desde: rango[0].clave,
    hasta: rango[rango.length - 1].clave,
    totales: {
      participaciones: tendencia.reduce((s, m) => s + m["desarrollo-humano"] + m.salud + m.deporte, 0),
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
      ocupacion: tasa(inscRango.length, cuposEventos),
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
      nuevosPorMes: rango.map((m) => ({ mes: m.clave, etiqueta: m.etiqueta, total: nuevos[m.clave] || 0 })),
    },
  };
}

module.exports = { estadisticas, mesesDelRango, claveMes };
