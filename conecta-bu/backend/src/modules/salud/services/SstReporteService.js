const { AppError } = require("../../../common/utils/AppError");
const { modulosDeUsuario } = require("../../../common/utils/modulos");
const repos = require("../repositories");
const cat = require("../utils/sst");
const { validarReporte, faltantes, validarTiposPermitidos, serializar } = require("../utils/sst/validacion");
const { sstArchivoService } = require("./SstArchivoService");

// Salidas institucionales y reportes SST: cualquier persona de la
// Institucion reporta con su cuenta y sigue el estado; el personal de Salud
// integral tambien puede verlos y completar documentos.
class SstReporteService {
  constructor(r = repos, archivos = sstArchivoService) {
    this.repos = r;
    this.archivos = archivos;
  }

  esPersonalSalud(usuario) {
    return modulosDeUsuario(usuario).includes("salud");
  }

  async crear(datos, archivos = [], usuario) {
    try {
      const limpio = validarReporte(datos, usuario);
      const medio = cat.esSalida(limpio.tipo) ? limpio.medioTransporte : null;
      validarTiposPermitidos(limpio.tipo, medio, archivos);
      if (medio !== null || cat.esSalida(limpio.tipo)) {
        const sinAdjuntar = faltantes(limpio.tipo, limpio.medioTransporte, archivos.map((a) => a.fieldname));
        if (sinAdjuntar.length) throw new AppError(400, `Adjunta: ${sinAdjuntar.map((t) => cat.ADJUNTOS[t].toLowerCase()).join(", ")}.`, "FALTAN_DOCUMENTOS");
      }
      const reporte = await this.repos.reportesSst.crearConAdjuntos({
        ...limpio,
        acompanantes: limpio.acompanantes || undefined,
        reportadoPorId: usuario.id,
        adjuntos: { create: archivos.map((a) => this.archivos.datosAdjunto(a, usuario.id)) },
      });
      return serializar(reporte);
    } catch (err) {
      this.archivos.borrar(archivos);
      throw err;
    }
  }

  async obtenerOFallar(id) {
    const reporte = await this.repos.reportesSst.completo(id);
    if (!reporte) throw new AppError(404, "El reporte no existe.");
    return reporte;
  }

  async obtener(id, usuario) {
    const reporte = await this.obtenerOFallar(id);
    if (reporte.reportadoPorId !== usuario.id && !this.esPersonalSalud(usuario)) throw new AppError(404, "El reporte no existe.");
    return serializar(reporte);
  }

  async mios(usuario) {
    return (await this.repos.reportesSst.buscar({ reportadoPorId: usuario.id }, { limite: 100 })).map(serializar);
  }

  // Quien reporto puede completar documentos mientras no este verificado.
  async agregarAdjuntos(id, archivos = [], usuario) {
    try {
      const reporte = await this.obtenerOFallar(id);
      const personal = this.esPersonalSalud(usuario);
      if (reporte.reportadoPorId !== usuario.id && !personal) throw new AppError(404, "El reporte no existe.");
      if (!personal && !["Recibido", "RequiereAjustes"].includes(reporte.estado)) {
        throw new AppError(409, "Este reporte ya fue revisado; comunícate con la Unidad de Salud.");
      }
      if (!archivos.length) throw new AppError(400, "Adjunta al menos un documento.");
      validarTiposPermitidos(reporte.tipo, reporte.medioTransporte, archivos);
      for (const a of archivos) await this.repos.adjuntosSst.crear({ reporteId: id, ...this.archivos.datosAdjunto(a, usuario.id) });
      // Al corregir, vuelve a la bandeja de revision.
      if (!personal && reporte.estado === "RequiereAjustes") await this.repos.reportesSst.actualizar(id, { estado: "Recibido" });
      return serializar(await this.obtenerOFallar(id));
    } catch (err) {
      this.archivos.borrar(archivos);
      throw err;
    }
  }

  async adjunto(id, usuario) {
    const adjunto = await this.repos.adjuntosSst.conReporte(id);
    if (!adjunto || (adjunto.reporte.reportadoPorId !== usuario.id && !this.esPersonalSalud(usuario))) {
      throw new AppError(404, "El documento no existe.");
    }
    return adjunto;
  }
}

module.exports = { SstReporteService, sstReporteService: new SstReporteService() };
