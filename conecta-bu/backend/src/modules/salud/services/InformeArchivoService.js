const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { nombreArchivo } = require("../utils/informe/edicion");
const { generarExcel } = require("../archivos/informe/InformeExcel");
const { generarPdf } = require("../archivos/informe/InformePdf");
const { evidenciaService } = require("./EvidenciaService");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Archivo del informe de gestion (PDF o Excel) con las fotos de las evidencias.
class InformeArchivoService {
  constructor(r = repos, evidencias = evidenciaService) {
    this.repos = r;
    this.evidencias = evidencias;
  }

  // Contenido de la foto de una evidencia del informe, o null.
  leerEvidencia = async (e) => {
    const evidencia = await this.repos.evidencias.buscarPorId(e.id);
    return evidencia ? this.evidencias.leer(evidencia) : null;
  };

  async generar(informe, cifras, formato) {
    if (formato === "pdf") return { buffer: await generarPdf(informe, cifras, this.leerEvidencia), nombre: nombreArchivo(informe, "pdf"), tipo: "application/pdf" };
    if (formato === "xlsx") return { buffer: await generarExcel(informe, cifras, this.leerEvidencia), nombre: nombreArchivo(informe, "xlsx"), tipo: XLSX };
    throw new AppError(400, "El formato debe ser pdf o xlsx.");
  }
}

module.exports = { InformeArchivoService, informeArchivoService: new InformeArchivoService() };
