const { LecturaRepository } = require("../repositories/LecturaRepository");
const { crearPeriodo, variacion } = require("../utils/periodos");
const { MODULOS_TABLERO } = require("../utils/etiquetas");
const { seccionCitas, seccionEventos } = require("../utils/estadisticas/citasEventos");
const { seccionSalud, seccionDeporte } = require("../utils/estadisticas/saludDeporte");
const { fuentes, tendencia, calendario } = require("../utils/estadisticas/tendencia");
const { actividadReciente, seccionSst, seccionUsuarios } = require("../utils/estadisticas/actividad");

// Tablero del superadministrador: cifras de todos los modulos de Bienestar
// en un mismo periodo (semana, mes, trimestre o año), comparadas con el
// periodo anterior de la misma duracion. Lee las tablas de cada modulo; no
// usa codigo de los modulos.
class EstadisticaService {
  constructor(repo = new LecturaRepository()) {
    this.repo = repo;
  }

  async tablero({ periodo } = {}) {
    const p = crearPeriodo(periodo);
    const datos = await this.repo.tablero();
    const citas = seccionCitas(datos.citas, p);
    const eventos = seccionEventos(datos.eventos, datos.inscripciones, p);
    const salud = seccionSalud(datos.atenciones, datos.actividades, p);
    const deporte = seccionDeporte(datos.deporte, p);
    const sst = seccionSst(datos.reportes, p);
    const fs = fuentes(datos);
    const t = tendencia(fs, p);
    const participAct = MODULOS_TABLERO.reduce((s, m) => s + t.totales[m], 0);
    const participAnt = Object.values(t.anterior).reduce((s, n) => s + n, 0);

    return {
      periodo: p.periodo,
      texto: p.texto,
      textoAnterior: p.textoAnterior,
      desde: p.desde,
      hasta: p.hasta,
      kpis: [
        { id: "participaciones", titulo: "Participaciones", valor: participAct, anterior: participAnt, variacion: variacion(participAct, participAnt), serie: t.serie.map((x) => x["desarrollo-humano"] + x.salud + x.deporte) },
        { id: "citas", titulo: "Citas", valor: citas.total, anterior: citas.anterior, variacion: variacion(citas.total, citas.anterior) },
        { id: "atenciones", titulo: "Atenciones de salud", valor: salud.total, anterior: salud.anterior, variacion: variacion(salud.total, salud.anterior), serie: t.serie.map((x) => x.salud) },
        { id: "inscritos", titulo: "Inscritos a eventos", valor: eventos.inscritos, anterior: eventos.inscritosAnterior, variacion: variacion(eventos.inscritos, eventos.inscritosAnterior) },
        { id: "horas", titulo: "Horas de deporte", valor: deporte.horas, anterior: deporte.horasAnterior, unidad: "h", variacion: variacion(deporte.horas, deporte.horasAnterior), serie: t.serie.map((x) => x.deporte) },
        { id: "sst", titulo: "Reportes SST", valor: sst.total, anterior: sst.anterior, variacion: variacion(sst.total, sst.anterior) },
      ],
      porModulo: MODULOS_TABLERO.map((m) => ({ id: m, total: t.totales[m], anterior: t.anterior[m], variacion: variacion(t.totales[m], t.anterior[m]) })),
      calendario: calendario(fs),
      actividad: actividadReciente(datos),
      totales: {
        participaciones: participAct,
        citas: citas.total,
        atenciones: salud.total,
        inscritosEventos: eventos.inscritos,
        horasDeporte: deporte.horas,
        estudiantesDeporte: deporte.estudiantes,
        reportesSst: sst.total,
        usuarios: datos.usuarios.length,
      },
      tendencia: t.serie,
      citas: citas.porModulo,
      eventos: eventos.resumen,
      salud: salud.resumen,
      deporte: deporte.resumen,
      sst: sst.resumen,
      usuarios: seccionUsuarios(datos.usuarios, p),
    };
  }
}

module.exports = { EstadisticaService, estadisticaService: new EstadisticaService() };
