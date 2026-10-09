const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC } = require("../../common/utils/fechas");
const { CATEGORIAS, periodoDeFecha, rangoDePeriodo } = require("./catalogos");

// Actividades de la Unidad de Salud: servicios permanentes (atencion basica,
// telemedicina...) y jornadas puntuales (feria de la salud, tamizajes,
// capacitaciones). Cada una tiene codigo SNIES, meta y seguimiento.

const fechaISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function enteroOpcional(valor, campo, { min = 0, max = 1e9 } = {}) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, `El campo ${campo} debe ser un número entero válido.`);
  return n;
}

function textoLargo(valor) {
  if (valor === undefined) return undefined;
  const t = String(valor ?? "").trim();
  return t ? t.slice(0, 5000) : null;
}

function validarPeriodo(periodo) {
  if (!rangoDePeriodo(periodo)) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return periodo;
}

function validarActividad(datos, { parcial = false } = {}) {
  const limpio = {};
  if (!parcial || datos.nombre !== undefined) {
    limpio.nombre = String(datos.nombre || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!limpio.nombre) throw new AppError(400, "La actividad necesita un nombre.");
  }
  if (!parcial || datos.categoria !== undefined) {
    limpio.categoria = datos.categoria || "PromocionPrevencion";
    if (!CATEGORIAS[limpio.categoria]) throw new AppError(400, "La categoría no es válida.");
  }
  if (datos.periodo !== undefined || !parcial) limpio.periodo = validarPeriodo(datos.periodo || periodoDeFecha(new Date()));
  if (datos.fechaInicio !== undefined) limpio.fechaInicio = aFechaUTC(datos.fechaInicio, "fecha de inicio");
  if (datos.fechaFin !== undefined) limpio.fechaFin = aFechaUTC(datos.fechaFin, "fecha final");
  if (datos.tipoSnies !== undefined) limpio.tipoSnies = enteroOpcional(datos.tipoSnies, "tipo SNIES", { min: 1, max: 99 }) ?? 1;
  for (const campo of ["permanente", "clinica", "activa"]) {
    if (datos[campo] !== undefined) limpio[campo] = datos[campo] === true;
  }
  const meta = enteroOpcional(datos.meta, "meta", { max: 10000 });
  if (meta !== undefined) limpio.meta = meta;
  const presupuesto = enteroOpcional(datos.presupuesto, "presupuesto");
  if (presupuesto !== undefined) limpio.presupuesto = presupuesto;
  const horas = enteroOpcional(datos.horasDedicacion, "horas de dedicación", { max: 5000 });
  if (horas !== undefined) limpio.horasDedicacion = horas;
  if (datos.responsableDocumento !== undefined) {
    limpio.responsableDocumento = String(datos.responsableDocumento || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 30) || null;
  }
  for (const campo of ["avances", "dificultades", "aprendizajes", "observaciones"]) {
    const t = textoLargo(datos[campo]);
    if (t !== undefined) limpio[campo] = t;
  }
  return limpio;
}

// Indicadores de una actividad a partir de sus atenciones: asistentes,
// personas distintas, jornadas realizadas (fechas distintas) y cumplimiento
// de la meta (jornadas / meta; un servicio permanente cumple si se presto).
function indicadores(actividad, atenciones, evidencias = 0) {
  const fechas = new Set(atenciones.map((a) => fechaISO(a.fecha)));
  const personas = new Set(atenciones.map((a) => a.personaId));
  const jornadas = actividad.permanente ? (atenciones.length ? 1 : 0) : fechas.size;
  const meta = actividad.meta || null;
  return {
    asistentes: atenciones.length,
    personas: personas.size,
    jornadas,
    meta,
    cumplimiento: meta ? Math.round((jornadas / meta) * 1000) / 10 : null,
    ultimaFecha: atenciones.length ? [...fechas].sort().pop() : null,
    evidencias,
  };
}

async function listarActividades({ periodo, categoria, incluirInactivas } = {}) {
  const per = validarPeriodo(periodo || periodoDeFecha(new Date()));
  const where = { periodo: per };
  if (categoria) where.categoria = categoria;
  if (!incluirInactivas) where.activa = true;

  const actividades = await prisma.actividadSalud.findMany({ where, orderBy: { codigo: "asc" } });
  const ids = actividades.map((a) => a.id);
  const [atenciones, evidencias] = await Promise.all([
    prisma.atencionSalud.findMany({ where: { actividadId: { in: ids } }, select: { actividadId: true, personaId: true, fecha: true } }),
    prisma.evidenciaSalud.findMany({ where: { actividadId: { in: ids } }, select: { actividadId: true } }),
  ]);
  return actividades.map((a) => ({
    ...a,
    indicadores: indicadores(
      a,
      atenciones.filter((x) => x.actividadId === a.id),
      evidencias.filter((x) => x.actividadId === a.id).length
    ),
  }));
}

async function obtenerActividadOFallar(id) {
  const actividad = await prisma.actividadSalud.findUnique({ where: { id } });
  if (!actividad) throw new AppError(404, "La actividad no existe.");
  return actividad;
}

async function obtenerActividad(id) {
  const actividad = await obtenerActividadOFallar(id);
  const [atenciones, evidencias] = await Promise.all([
    prisma.atencionSalud.findMany({
      where: { actividadId: id },
      include: { persona: true, registradoPor: { select: { nombre: true } } },
      orderBy: [{ fecha: "desc" }, { fechaRegistro: "desc" }],
    }),
    prisma.evidenciaSalud.findMany({
      where: { actividadId: id },
      include: { subidoPor: { select: { nombre: true } } },
      orderBy: { fechaSubida: "desc" },
    }),
  ]);
  return { ...actividad, indicadores: indicadores(actividad, atenciones, evidencias.length), atenciones, evidencias };
}

async function siguienteCodigo(periodo) {
  const ultima = await prisma.actividadSalud.findFirst({ where: { periodo }, orderBy: { codigo: "desc" } });
  return (ultima?.codigo || 0) + 1;
}

async function crearActividad(datos) {
  const limpio = validarActividad(datos);
  const rango = rangoDePeriodo(limpio.periodo);
  limpio.fechaInicio = limpio.fechaInicio || rango.desde;
  limpio.fechaFin = limpio.fechaFin || (limpio.permanente ? rango.hasta : limpio.fechaInicio);
  if (limpio.fechaInicio > limpio.fechaFin) throw new AppError(400, "La fecha de inicio no puede ser posterior a la fecha final.");
  limpio.codigo = datos.codigo !== undefined && datos.codigo !== "" ? enteroOpcional(datos.codigo, "código", { min: 1 }) : await siguienteCodigo(limpio.periodo);
  try {
    return await prisma.actividadSalud.create({ data: limpio });
  } catch (err) {
    if (err?.code === "P2002") throw new AppError(409, `Ya existe una actividad con el código ${limpio.codigo} en ${limpio.periodo}.`);
    throw err;
  }
}

async function actualizarActividad(id, datos) {
  const actual = await obtenerActividadOFallar(id);
  const limpio = validarActividad(datos, { parcial: true });
  if (datos.codigo !== undefined) limpio.codigo = enteroOpcional(datos.codigo, "código", { min: 1 });
  const inicio = limpio.fechaInicio || actual.fechaInicio;
  const fin = limpio.fechaFin || actual.fechaFin;
  if (new Date(inicio) > new Date(fin)) throw new AppError(400, "La fecha de inicio no puede ser posterior a la fecha final.");
  try {
    return await prisma.actividadSalud.update({ where: { id }, data: limpio });
  } catch (err) {
    if (err?.code === "P2002") throw new AppError(409, "Ya existe otra actividad con ese código en el periodo.");
    throw err;
  }
}

// Inicio de semestre: copia el catalogo de un periodo al siguiente (mismos
// nombres, categorias y codigos; fechas del nuevo periodo; sin atenciones).
async function copiarCatalogo(origen, destino) {
  validarPeriodo(origen);
  validarPeriodo(destino);
  if (origen === destino) throw new AppError(400, "Elige un periodo de destino distinto.");
  const yaHay = await prisma.actividadSalud.count({ where: { periodo: destino } });
  if (yaHay > 0) throw new AppError(409, `El periodo ${destino} ya tiene actividades.`);
  const actividades = await prisma.actividadSalud.findMany({ where: { periodo: origen }, orderBy: { codigo: "asc" } });
  if (!actividades.length) throw new AppError(404, `No hay actividades en ${origen} para copiar.`);
  const rango = rangoDePeriodo(destino);
  await prisma.actividadSalud.createMany({
    data: actividades.map((a) => ({
      codigo: a.codigo,
      periodo: destino,
      nombre: a.nombre,
      categoria: a.categoria,
      tipoSnies: a.tipoSnies,
      permanente: a.permanente,
      clinica: a.clinica,
      meta: a.meta,
      horasDedicacion: a.horasDedicacion,
      responsableDocumento: a.responsableDocumento,
      fechaInicio: rango.desde,
      fechaFin: a.permanente ? rango.hasta : rango.desde,
      activa: a.activa,
    })),
  });
  return { copiadas: actividades.length, periodo: destino };
}

async function listarPeriodos() {
  const actividades = await prisma.actividadSalud.findMany({ select: { periodo: true } });
  const periodos = new Set(actividades.map((a) => a.periodo));
  periodos.add(periodoDeFecha(new Date()));
  return [...periodos].sort().reverse();
}

module.exports = {
  fechaISO,
  indicadores,
  listarActividades,
  obtenerActividad,
  obtenerActividadOFallar,
  crearActividad,
  actualizarActividad,
  copiarCatalogo,
  listarPeriodos,
  siguienteCodigo,
};
