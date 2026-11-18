const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { almacenamiento } = require("../../../common/storage/almacenamiento");
const cat = require("../utils/sst");

// Documentos adjuntos de los reportes SST (PDF o fotos), guardados por mes.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };
const BUCKET = "privado";

class SstArchivoService {
  constructor() {
    // multipart: "datos" (JSON con el formulario) y un archivo por documento,
    // cuyo nombre de campo es el tipo de adjunto (Licencia, Soat, Poliza...).
    this.subir = multer({
      storage: almacenamiento.motorMulter({
        carpeta: () => `sst/${new Date().toISOString().slice(0, 7)}`,
        extensionDe: (file) => TIPOS[file.mimetype],
      }),
      limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 20 },
      fileFilter(req, file, cb) {
        if (!cat.ADJUNTOS[file.fieldname]) return cb(new AppError(400, `El documento "${file.fieldname}" no se reconoce.`));
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "Los documentos deben ser PDF o fotos (JPG, PNG, WEBP)."));
        cb(null, true);
      },
    }).any();
  }

  carpetaMes() {
    return `sst/${new Date().toISOString().slice(0, 7)}`;
  }

  recibir = (req, res, next) => this.subir(req, res, next);

  borrar(archivos = []) {
    return almacenamiento.descartarVarios(archivos, { bucket: BUCKET });
  }

  claveDe(adjunto) {
    const clave = adjunto?.ruta;
    if (!clave || typeof clave !== "string" || clave.includes("..") || clave.startsWith("/") || !clave.startsWith("sst/")) {
      throw new AppError(404, "Archivo no disponible.");
    }
    if (!almacenamiento.usaSupabase() && !almacenamiento.rutaSegura(clave)) throw new AppError(404, "Archivo no disponible.");
    return clave;
  }

  async persistir(archivo) {
    return almacenamiento.guardar(archivo, { carpeta: this.carpetaMes(), bucket: BUCKET, extension: TIPOS[archivo.mimetype] });
  }

  async datosAdjunto(archivo, usuarioId) {
    const clave = await this.persistir(archivo);
    return {
      tipo: archivo.fieldname,
      nombreArchivo: String(archivo.originalname || "documento").slice(0, 255),
      ruta: clave,
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
      subidoPorId: usuarioId || null,
    };
  }

  refDe(adjunto) {
    return { clave: this.claveDe(adjunto), bucket: BUCKET, nombre: adjunto.nombreArchivo, tipo: adjunto.tipoMime };
  }
}

module.exports = { SstArchivoService, sstArchivoService: new SstArchivoService() };
