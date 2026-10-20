const { contarPor, ordenar } = require("../conteos");
const { TIPOS_SST, ESTADOS_SST } = require("../etiquetas");
const { aDiaBogota } = require("../periodos");

// Ultimos movimientos en todos los modulos.
function actividadReciente({ usuarios, citas, eventos, inscripciones, atenciones, actividades, reportes, deporte }) {
  const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
  const nombre = (id) => String(usuarioPorId.get(id)?.nombre || "Un estudiante").split(" ")[0];
  const queHizo = (c) => (c.estado === "Cancelada" ? "canceló una cita" : c.horario?.sinCita ? "fue atendido sin cita" : "agendó una cita");
  return [
    ...citas.map((c) => ({
      modulo: c.modulo,
      tipo: c.estado === "Cancelada" ? "cancelada" : "cita",
      fecha: c.estado === "Cancelada" ? c.fechaActualizacion || c.fechaAgendamiento : c.fechaAgendamiento,
      texto: `${nombre(c.usuarioId)} ${queHizo(c)}`,
      detalle: c.horario?.servicio?.nombre,
    })),
    ...inscripciones
      .filter((i) => i.estado === "Confirmada")
      .map((i) => ({ modulo: "desarrollo-humano", tipo: "inscripcion", fecha: i.fechaInscripcion, texto: `${nombre(i.usuarioId)} se inscribió a un evento`, detalle: eventoPorId.get(i.eventoId)?.nombre })),
    ...atenciones.map((a) => ({ modulo: "salud", tipo: "atencion", fecha: a.fechaRegistro, texto: "Atención de salud registrada", detalle: actividadPorId.get(a.actividadId)?.nombre })),
    ...deporte.sesiones.map((s) => ({ modulo: "deporte", tipo: "sesion", fecha: s.fechaRegistro, texto: "Asistencia de deporte tomada", detalle: s.tema || `${s.inicio} a ${s.fin}` })),
    ...reportes.map((r) => ({ modulo: "salud", tipo: "sst", fecha: r.fechaCreacion, texto: "Nuevo reporte de salida o seguridad", detalle: TIPOS_SST[r.tipo] || r.tipo })),
  ]
    .filter((a) => a.fecha && !Number.isNaN(new Date(a.fecha).getTime()))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 8)
    .map((a) => ({ ...a, fecha: new Date(a.fecha).toISOString() }));
}

// Salidas y reportes SST del periodo.
function seccionSst(reportes, p) {
  const enRango = reportes.filter((r) => p.enActual(r.fechaCreacion));
  const estados = contarPor(enRango, (r) => r.estado);
  return {
    total: enRango.length,
    anterior: reportes.filter((r) => p.enAnterior(r.fechaCreacion)).length,
    resumen: {
      total: enRango.length,
      porTipo: ordenar(contarPor(enRango, (r) => r.tipo), TIPOS_SST),
      porEstado: Object.fromEntries(ESTADOS_SST.map((e) => [e, estados[e] || 0])),
    },
  };
}

// Usuarios por rol y nuevos por cubeta del periodo.
function seccionUsuarios(usuarios, p) {
  const nuevos = contarPor(usuarios, (x) => p.cubetaDe(aDiaBogota(x.fechaCreacion)));
  return {
    total: usuarios.length,
    porRol: contarPor(usuarios, (x) => x.rol?.nombre),
    nuevosPorMes: p.cubetas.map((m) => ({ mes: m.clave, etiqueta: m.etiqueta, total: nuevos[m.clave] || 0 })),
  };
}

module.exports = { actividadReciente, seccionSst, seccionUsuarios };
