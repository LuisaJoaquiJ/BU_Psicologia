const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const { CATEGORIAS, POBLACIONES, periodoDeFecha, rangoDePeriodo } = require("./catalogos");
const datos = require("./reportes.datos");
const excel = require("./reportes.excel");

const DIA_MS = 24 * 60 * 60 * 1000;

function validarPeriodo(periodo) {
  const p = periodo || periodoDeFecha(hoyBogota());
  const rango = rangoDePeriodo(p);
  if (!rango) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return { periodo: p, rango };
}

async function atencionesDelPeriodo(rango, extra = {}) {
  return prisma.atencionSalud.findMany({
    where: { fecha: { gte: rango.desde, lte: rango.hasta } },
    ...extra,
  });
}

// Panel de inicio del personal de salud.
async function resumen({ periodo } = {}) {
  const { periodo: per, rango } = validarPeriodo(periodo);
  const hoy = hoyBogota();
  const [atenciones, actividades, evidencias, ultimas, sinConsentimiento, personasTotal] = await Promise.all([
    atencionesDelPeriodo(rango),
    prisma.actividadSalud.findMany({ where: { periodo: per } }),
    prisma.evidenciaSalud.findMany({ select: { actividadId: true } }),
    prisma.atencionSalud.findMany({
      include: { persona: true, actividad: true },
      orderBy: { fechaRegistro: "desc" },
      take: 8,
    }),
    prisma.personaSalud.count({ where: { consentimientoDatos: false } }),
    prisma.personaSalud.count(),
  ]);

  const nombreActividad = new Map(actividades.map((a) => [a.id, a]));
  const iso = datos.fechaISO;
  const hace = (dias) => new Date(hoy.getTime() - dias * DIA_MS);
  const porDia = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = iso(hace(i));
    porDia.push({ fecha: d, total: atenciones.filter((a) => iso(a.fecha) === d).length });
  }
  const conEvidencia = new Set(evidencias.map((e) => e.actividadId));
  const actividadesConAtencion = new Set(atenciones.map((a) => a.actividadId));

  return {
    periodo: per,
    hoy: atenciones.filter((a) => iso(a.fecha) === iso(hoy)).length,
    semana: atenciones.filter((a) => new Date(a.fecha) > hace(7)).length,
    totalPeriodo: atenciones.length,
    personasPeriodo: new Set(atenciones.map((a) => a.personaId)).size,
    personasRegistradas: personasTotal,
    sinConsentimiento,
    remisiones: atenciones.filter((a) => a.remitido).length,
    porPoblacion: POBLACIONES.map((p) => ({ nombre: p, total: atenciones.filter((a) => a.poblacion === p).length })),
    porCategoria: Object.entries(CATEGORIAS)
      .map(([clave, nombre]) => ({
        clave,
        nombre,
        total: atenciones.filter((a) => nombreActividad.get(a.actividadId)?.categoria === clave).length,
      }))
      .filter((c) => c.total > 0),
    topActividades: datos
      .contarPor(atenciones, (a) => nombreActividad.get(a.actividadId)?.nombre)
      .slice(0, 6),
    porPrograma: datos
      .contarPor(atenciones.filter((a) => a.poblacion === "Estudiante"), (a) => a.programa || datos.SIN_PROGRAMA)
      .slice(0, 8),
    porDia,
    actividadesSinEvidencia: actividades
      .filter((a) => !a.permanente && actividadesConAtencion.has(a.id) && !conEvidencia.has(a.id))
      .map((a) => ({ id: a.id, nombre: a.nombre })),
    ultimas,
  };
}

async function reporteSnies({ periodo } = {}) {
  const { periodo: per, rango } = validarPeriodo(periodo);
  const [actividades, atenciones] = await Promise.all([
    prisma.actividadSalud.findMany({ where: { periodo: per } }),
    atencionesDelPeriodo(rango),
  ]);
  const snies = datos.datosSnies(actividades, atenciones, per);
  const buffer = await excel.generarSnies(snies);
  return { buffer, nombre: `SNIES-salud-integral-${per}.xlsx`, sinResponsable: snies.sinResponsable };
}

async function registroGeneral({ desde, hasta } = {}) {
  const where = {};
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = aFechaUTC(desde, "fecha desde");
    if (hasta) where.fecha.lte = aFechaUTC(hasta, "fecha hasta");
  }
  const atenciones = await prisma.atencionSalud.findMany({
    where,
    include: { persona: true, actividad: true, registradoPor: { select: { nombre: true } } },
    orderBy: [{ fecha: "asc" }, { fechaRegistro: "asc" }],
  });
  const buffer = await excel.generarRegistro(atenciones, { desde, hasta });
  const sufijo = desde || hasta ? `${desde || "inicio"}_a_${hasta || "hoy"}` : datos.fechaISO(hoyBogota());
  return { buffer, nombre: `registro-salud-${sufijo}.xlsx` };
}

module.exports = { resumen, reporteSnies, registroGeneral, validarPeriodo };
