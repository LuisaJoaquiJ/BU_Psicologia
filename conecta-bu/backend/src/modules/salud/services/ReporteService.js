const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { CATEGORIAS, POBLACIONES, periodoDeFecha, rangoDePeriodo } = require("../utils/catalogos");
const datos = require("../utils/reportesDatos");
const { generarSnies, generarRegistro } = require("../archivos/ReportesExcel");

const DIA_MS = 24 * 60 * 60 * 1000;

// Inicio del personal de Salud y reportes descargables (SNIES y registro general).
class ReporteService {
  constructor(r = repos) {
    this.repos = r;
  }

  validarPeriodo(periodo) {
    const p = periodo || periodoDeFecha(hoyBogota());
    const rango = rangoDePeriodo(p);
    if (!rango) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
    return { periodo: p, rango };
  }

  async resumen({ periodo } = {}) {
    const { periodo: per, rango } = this.validarPeriodo(periodo);
    const hoy = hoyBogota();
    const [atenciones, actividades, evidencias, ultimas, sinConsentimiento, personasTotal] = await Promise.all([
      this.repos.atenciones.entreFechas(rango.desde, rango.hasta),
      this.repos.actividades.listar({ periodo: per }),
      this.repos.evidencias.actividadesConEvidencia(),
      this.repos.atenciones.ultimas(8),
      this.repos.personas.contar({ consentimientoDatos: false }),
      this.repos.personas.contar(),
    ]);
    const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
    const iso = datos.fechaISO;
    const hace = (dias) => new Date(hoy.getTime() - dias * DIA_MS);
    const porDia = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = iso(hace(i));
      porDia.push({ fecha: d, total: atenciones.filter((a) => iso(a.fecha) === d).length });
    }
    const conEvidencia = new Set(evidencias.map((e) => e.actividadId));
    const conAtencion = new Set(atenciones.map((a) => a.actividadId));
    const categoriaDe = (a) => actividadPorId.get(a.actividadId)?.categoria;
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
        .map(([clave, nombre]) => ({ clave, nombre, total: atenciones.filter((a) => categoriaDe(a) === clave).length }))
        .filter((c) => c.total > 0),
      topActividades: datos.contarPor(atenciones, (a) => actividadPorId.get(a.actividadId)?.nombre).slice(0, 6),
      porPrograma: datos.contarPor(atenciones.filter((a) => a.poblacion === "Estudiante"), (a) => a.programa || datos.SIN_PROGRAMA).slice(0, 8),
      porDia,
      actividadesSinEvidencia: actividades.filter((a) => !a.permanente && conAtencion.has(a.id) && !conEvidencia.has(a.id)).map((a) => ({ id: a.id, nombre: a.nombre })),
      ultimas,
    };
  }

  async snies({ periodo } = {}) {
    const { periodo: per, rango } = this.validarPeriodo(periodo);
    const [actividades, atenciones] = await Promise.all([this.repos.actividades.listar({ periodo: per }), this.repos.atenciones.entreFechas(rango.desde, rango.hasta)]);
    const snies = datos.datosSnies(actividades, atenciones, per);
    return { buffer: await generarSnies(snies), nombre: `SNIES-salud-integral-${per}.xlsx`, sinResponsable: snies.sinResponsable };
  }

  async registroGeneral({ desde, hasta } = {}) {
    const where = {};
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = aFechaUTC(desde, "fecha desde");
      if (hasta) where.fecha.lte = aFechaUTC(hasta, "fecha hasta");
    }
    const atenciones = await this.repos.atenciones.registro(where);
    const sufijo = desde || hasta ? `${desde || "inicio"}_a_${hasta || "hoy"}` : datos.fechaISO(hoyBogota());
    return { buffer: await generarRegistro(atenciones, { desde, hasta }), nombre: `registro-salud-${sufijo}.xlsx` };
  }
}

module.exports = { ReporteService, reporteService: new ReporteService() };
