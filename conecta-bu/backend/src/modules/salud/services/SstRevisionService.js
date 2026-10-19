const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const cat = require("../utils/sst");
const { DIA_MS, texto, parrafo, faltantes, serializar } = require("../utils/sst/validacion");
const { sstReporteService } = require("./SstReporteService");

// Bandeja del personal de Salud integral: revisa los documentos de los
// reportes SST, reporta a la ARL o gestiona ASIST CARD y cambia el estado.
const TRANSICIONES = {
  Recibido: ["Verificado", "RequiereAjustes", "Cerrado"],
  RequiereAjustes: ["Recibido", "Verificado", "Cerrado"],
  Verificado: ["Cerrado", "RequiereAjustes"],
  Cerrado: ["Recibido"],
};
const CAMPOS_BUSQUEDA = ["evento", "destino", "responsableNombre", "responsableDocumento", "nombreReporta", "correo", "lugarEvento", "pais"];
const ABIERTOS = ["Recibido", "Verificado", "RequiereAjustes"];

class SstRevisionService {
  constructor(r = repos, reportes = sstReporteService) {
    this.repos = r;
    this.reportes = reportes;
  }

  filtro({ tipo, grupo, estado, desde, hasta, q, area } = {}) {
    const where = {};
    const and = [];
    if (tipo && cat.TIPOS[tipo]) where.tipo = tipo;
    else if (grupo && cat.GRUPOS[grupo]) where.tipo = { in: Object.keys(cat.TIPOS).filter((t) => cat.TIPOS[t].grupo === grupo) };
    if (estado && cat.ESTADOS[estado]) where.estado = estado;
    if (area) where.area = area;
    // El rango aplica a la fecha de la salida o del evento.
    if (desde || hasta) {
      const rango = {};
      if (desde) rango.gte = aFechaUTC(desde, "fecha inicial");
      if (hasta) rango.lte = aFechaUTC(hasta, "fecha final");
      and.push({ OR: [{ fechaSalida: rango }, { fechaEvento: rango }] });
    }
    const busqueda = texto(q, 80);
    if (busqueda) and.push({ OR: CAMPOS_BUSQUEDA.map((c) => ({ [c]: { contains: busqueda, mode: "insensitive" } })) });
    if (and.length) where.AND = and;
    return where;
  }

  async listar(filtros = {}) {
    const reportes = await this.repos.reportesSst.buscar(this.filtro(filtros), { limite: 500 });
    const conteos = {};
    const sinEstado = this.filtro({ ...filtros, estado: undefined });
    for (const estado of Object.keys(cat.ESTADOS)) conteos[estado] = await this.repos.reportesSst.contar({ ...sinEstado, estado });
    return { reportes: reportes.map(serializar), conteos };
  }

  validarEstado(reporte, estado, observacion) {
    if (!cat.ESTADOS[estado]) throw new AppError(400, "El estado no es válido.");
    if (!TRANSICIONES[reporte.estado].includes(estado)) {
      throw new AppError(409, `Un reporte "${cat.ESTADOS[reporte.estado]}" no puede pasar a "${cat.ESTADOS[estado]}".`);
    }
    if (estado === "RequiereAjustes" && !parrafo(observacion)) throw new AppError(400, "Escribe qué debe corregir o adjuntar la persona.");
    if (estado === "Verificado" && cat.esSalida(reporte.tipo)) {
      const sinAdjuntar = faltantes(reporte.tipo, reporte.medioTransporte, reporte.adjuntos.map((a) => a.tipo));
      if (sinAdjuntar.length) {
        throw new AppError(409, `No se puede verificar: falta ${sinAdjuntar.map((t) => cat.ADJUNTOS[t].toLowerCase()).join(", ")}.`, "FALTAN_DOCUMENTOS");
      }
    }
  }

  async revisar(id, { estado, observacion, gestionExterna } = {}, usuario) {
    const reporte = await this.reportes.obtenerOFallar(id);
    const data = {};
    if (estado !== undefined && estado !== reporte.estado) {
      this.validarEstado(reporte, estado, observacion);
      data.estado = estado;
    }
    if (observacion !== undefined) data.observacionRevision = parrafo(observacion, 2000);
    if (gestionExterna !== undefined) data.gestionExterna = gestionExterna === true;
    if (!Object.keys(data).length) return serializar(reporte);
    await this.repos.reportesSst.actualizar(id, { ...data, revisadoPor: usuario.emailInstitucional, fechaRevision: new Date() });
    return serializar(await this.reportes.obtenerOFallar(id));
  }

  // Para el inicio de Salud: pendientes y proximas salidas.
  async resumen() {
    const hoy = hoyBogota();
    const en15 = new Date(hoy.getTime() + 15 * DIA_MS);
    const [pendientes, ajustes, proximas, riesgosAbiertos] = await Promise.all([
      this.repos.reportesSst.contar({ estado: "Recibido" }),
      this.repos.reportesSst.contar({ estado: "RequiereAjustes" }),
      this.repos.reportesSst.buscar({ fechaSalida: { gte: hoy, lte: en15 }, estado: { in: ABIERTOS } }, { orden: { fechaSalida: "asc" }, limite: 8 }),
      this.repos.reportesSst.contar({ tipo: "CondicionInsegura", estado: { in: ABIERTOS } }),
    ]);
    return { pendientes, ajustes, riesgosAbiertos, proximas: proximas.map(serializar) };
  }
}

module.exports = { SstRevisionService, sstRevisionService: new SstRevisionService() };
