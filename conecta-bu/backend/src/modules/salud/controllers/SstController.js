const fs = require("fs");
const { BaseController } = require("./BaseController");
const { AppError } = require("../../../common/utils/AppError");
const { catalogoPublico } = require("../utils/sst");
const { sstReporteService } = require("../services/SstReporteService");
const { sstRevisionService } = require("../services/SstRevisionService");
const { sstPersonaService } = require("../services/SstPersonaService");
const { sstArchivoService } = require("../services/SstArchivoService");
const { generarExcel } = require("../archivos/SstExcel");

// Datos del formulario: JSON en "datos" (multipart) o el cuerpo normal.
function leerDatos(req) {
  if (!req.is("multipart/form-data")) return req.body || {};
  try {
    return JSON.parse(req.body?.datos || "{}");
  } catch {
    throw new AppError(400, "Los datos del formulario no son válidos.");
  }
}

// Salidas institucionales y reportes SST: quien reporta y el personal de Salud.
class SstController extends BaseController {
  catalogos = async (req, res) => this.ok(res, catalogoPublico());
  personas = async (req, res) => this.ok(res, { personas: await sstPersonaService.buscar(req.query.q) });
  mios = async (req, res) => this.ok(res, { reportes: await sstReporteService.mios(req.usuario) });

  crear = async (req, res) => {
    let datos;
    try {
      datos = leerDatos(req);
    } catch (err) {
      for (const f of req.files || []) fs.promises.unlink(f.path).catch(() => {});
      throw err;
    }
    this.creado(res, { reporte: await sstReporteService.crear(datos, req.files || [], req.usuario) });
  };

  obtener = async (req, res) => this.ok(res, { reporte: await sstReporteService.obtener(req.params.id, req.usuario) });
  adjuntar = async (req, res) => this.creado(res, { reporte: await sstReporteService.agregarAdjuntos(req.params.id, req.files || [], req.usuario) });

  archivoAdjunto = async (req, res) => {
    const adjunto = await sstReporteService.adjunto(req.params.id, req.usuario);
    this.enviarArchivo(res, sstArchivoService.rutaAbsoluta(adjunto), adjunto.nombreArchivo, { tipo: adjunto.tipoMime, cache: "private, max-age=3600" });
  };

  // ---- Bandeja del personal de Salud ----
  resumen = async (req, res) => this.ok(res, await sstRevisionService.resumen());
  listar = async (req, res) => this.ok(res, await sstRevisionService.listar(req.query));
  revisar = async (req, res) => this.ok(res, { reporte: await sstRevisionService.revisar(req.params.id, req.body, req.usuario) });
  exportar = async (req, res) => {
    const { reportes } = await sstRevisionService.listar(req.query);
    const { buffer, nombre } = await generarExcel(reportes, req.query);
    this.archivo(res, buffer, nombre, "xlsx");
  };
}

module.exports = { SstController, sstController: new SstController() };
