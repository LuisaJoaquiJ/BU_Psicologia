const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { actividadService } = require("./ActividadService");

// Evidencias de las actividades (fotos de la jornada, planillas firmadas,
// actas). Reemplazan la hoja "REGISTRO FOTOGRAFICO" del informe de gestion:
// quedan asociadas a la actividad, la fecha y quien las subio.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };

class EvidenciaService {
  constructor(r = repos, actividades = actividadService) {
    this.repos = r;
    this.actividades = actividades;
    this.subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const carpeta = path.join(this.carpeta(), String(req.params.id).replace(/[^0-9a-zA-Z-]/g, ""));
          fs.mkdir(carpeta, { recursive: true }, (err) => cb(err, carpeta));
        },
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`),
      }),
      limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 10 },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "Solo se permiten fotos (JPG, PNG, WEBP) o PDF."));
        cb(null, true);
      },
    }).array("archivos", 10);
  }

  carpeta() {
    return path.join(config.saludUploadsDir, "evidencias");
  }

  // Middleware que recibe los archivos.
  recibir = (req, res, next) => this.subir(req, res, next);

  borrarArchivos(archivos = []) {
    for (const a of archivos) fs.promises.unlink(a.path).catch(() => {});
  }

  async guardar(actividadId, archivos, { descripcion, fecha }, usuarioId) {
    try {
      await this.actividades.obtenerOFallar(actividadId);
      if (!archivos?.length) throw new AppError(400, "Adjunta al menos una foto o PDF.");
      const fechaEvidencia = fecha ? aFechaUTC(fecha) : hoyBogota();
      const texto = String(descripcion || "").trim().slice(0, 300) || null;
      const creadas = [];
      for (const archivo of archivos) {
        creadas.push(
          await this.repos.evidencias.crear({
            actividadId,
            fecha: fechaEvidencia,
            descripcion: texto,
            nombreArchivo: String(archivo.originalname || "evidencia").slice(0, 255),
            ruta: path.relative(config.saludUploadsDir, archivo.path).split(path.sep).join("/"),
            tipoMime: archivo.mimetype,
            tamanoBytes: archivo.size,
            subidoPorId: usuarioId || null,
          }),
        );
      }
      return creadas;
    } catch (err) {
      this.borrarArchivos(archivos);
      throw err;
    }
  }

  // Nunca se sirve algo fuera de la carpeta de archivos de Salud.
  rutaAbsoluta(evidencia) {
    const absoluta = path.resolve(config.saludUploadsDir, evidencia.ruta);
    if (!absoluta.startsWith(path.resolve(config.saludUploadsDir) + path.sep)) throw new AppError(404, "Archivo no disponible.");
    return absoluta;
  }

  async obtenerOFallar(id) {
    const evidencia = await this.repos.evidencias.buscarPorId(id);
    if (!evidencia) throw new AppError(404, "La evidencia no existe.");
    return evidencia;
  }

  async eliminar(id) {
    const evidencia = await this.obtenerOFallar(id);
    await this.repos.evidencias.eliminar(id);
    await fs.promises.unlink(this.rutaAbsoluta(evidencia)).catch(() => {});
    return { eliminada: id };
  }

  // Contenido de una foto (para el informe de gestion), o null si no se puede leer.
  async leer(evidencia) {
    try {
      return await fs.promises.readFile(this.rutaAbsoluta(evidencia));
    } catch {
      return null;
    }
  }
}

module.exports = { EvidenciaService, evidenciaService: new EvidenciaService() };
