const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { almacenamiento } = require("../../../common/storage/almacenamiento");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { actividadService } = require("./ActividadService");

// Evidencias de las actividades (fotos de la jornada, planillas firmadas,
// actas). Reemplazan la hoja "REGISTRO FOTOGRAFICO" del informe de gestion:
// quedan asociadas a la actividad, la fecha y quien las subio.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };
const BUCKET = "privado";

class EvidenciaService {
  constructor(r = repos, actividades = actividadService) {
    this.repos = r;
    this.actividades = actividades;
    this.subir = multer({
      storage: almacenamiento.motorMulter({
        carpeta: (req) => `evidencias/${String(req.params.id).replace(/[^0-9a-zA-Z-]/g, "")}`,
        extensionDe: (file) => TIPOS[file.mimetype],
      }),
      limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 10 },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "Solo se permiten fotos (JPG, PNG, WEBP) o PDF."));
        cb(null, true);
      },
    }).array("archivos", 10);
  }

  carpetaDe(actividadId) {
    return `evidencias/${String(actividadId).replace(/[^0-9a-zA-Z-]/g, "")}`;
  }

  // Middleware que recibe los archivos.
  recibir = (req, res, next) => this.subir(req, res, next);

  borrarArchivos(archivos = []) {
    return almacenamiento.descartarVarios(archivos, { bucket: BUCKET });
  }

  async guardar(actividadId, archivos, { descripcion, fecha }, usuarioId) {
    try {
      await this.actividades.obtenerOFallar(actividadId);
      if (!archivos?.length) throw new AppError(400, "Adjunta al menos una foto o PDF.");
      const fechaEvidencia = fecha ? aFechaUTC(fecha) : hoyBogota();
      const texto = String(descripcion || "").trim().slice(0, 300) || null;
      const creadas = [];
      for (const archivo of archivos) {
        const clave = await almacenamiento.guardar(archivo, { carpeta: this.carpetaDe(actividadId), bucket: BUCKET, extension: TIPOS[archivo.mimetype] });
        creadas.push(
          await this.repos.evidencias.crear({
            actividadId,
            fecha: fechaEvidencia,
            descripcion: texto,
            nombreArchivo: String(archivo.originalname || "evidencia").slice(0, 255),
            ruta: clave,
            tipoMime: archivo.mimetype,
            tamanoBytes: archivo.size,
            subidoPorId: usuarioId || null,
          }),
        );
      }
      return creadas;
    } catch (err) {
      await this.borrarArchivos(archivos);
      throw err;
    }
  }

  // Clave relativa dentro de evidencias/; nunca se sirve algo fuera de esa carpeta.
  claveDe(evidencia) {
    const clave = evidencia?.ruta;
    if (!clave || typeof clave !== "string" || clave.includes("..") || clave.startsWith("/") || !clave.startsWith("evidencias/")) {
      throw new AppError(404, "Archivo no disponible.");
    }
    if (!almacenamiento.usaSupabase() && !almacenamiento.rutaSegura(clave)) throw new AppError(404, "Archivo no disponible.");
    return clave;
  }

  async obtenerOFallar(id) {
    const evidencia = await this.repos.evidencias.buscarPorId(id);
    if (!evidencia) throw new AppError(404, "La evidencia no existe.");
    return evidencia;
  }

  async eliminar(id) {
    const evidencia = await this.obtenerOFallar(id);
    await this.repos.evidencias.eliminar(id);
    await almacenamiento.borrar(this.claveDe(evidencia), { bucket: BUCKET });
    return { eliminada: id };
  }

  // Contenido de una foto (para el informe de gestion), o null si no se puede leer.
  async leer(evidencia) {
    try {
      return await almacenamiento.leer(this.claveDe(evidencia), { bucket: BUCKET });
    } catch {
      return null;
    }
  }

  refDe(evidencia) {
    return { clave: this.claveDe(evidencia), bucket: BUCKET, nombre: evidencia.nombreArchivo, tipo: evidencia.tipoMime };
  }
}

module.exports = { EvidenciaService, evidenciaService: new EvidenciaService() };
