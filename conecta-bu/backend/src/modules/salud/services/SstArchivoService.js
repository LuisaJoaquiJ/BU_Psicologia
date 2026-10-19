const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const cat = require("../utils/sst");

// Documentos adjuntos de los reportes SST (PDF o fotos), guardados por mes.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };

class SstArchivoService {
  constructor() {
    // multipart: "datos" (JSON con el formulario) y un archivo por documento,
    // cuyo nombre de campo es el tipo de adjunto (Licencia, Soat, Poliza...).
    this.subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const carpeta = path.join(this.carpeta(), new Date().toISOString().slice(0, 7));
          fs.mkdir(carpeta, { recursive: true }, (err) => cb(err, carpeta));
        },
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`),
      }),
      limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 20 },
      fileFilter(req, file, cb) {
        if (!cat.ADJUNTOS[file.fieldname]) return cb(new AppError(400, `El documento "${file.fieldname}" no se reconoce.`));
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "Los documentos deben ser PDF o fotos (JPG, PNG, WEBP)."));
        cb(null, true);
      },
    }).any();
  }

  carpeta() {
    return path.join(config.saludUploadsDir, "sst");
  }

  recibir = (req, res, next) => this.subir(req, res, next);

  borrar(archivos = []) {
    for (const a of archivos) fs.promises.unlink(a.path).catch(() => {});
  }

  rutaAbsoluta(adjunto) {
    const base = path.resolve(config.saludUploadsDir);
    const absoluta = path.resolve(base, adjunto.ruta);
    if (!absoluta.startsWith(base + path.sep)) throw new AppError(404, "Archivo no disponible.");
    return absoluta;
  }

  datosAdjunto(archivo, usuarioId) {
    return {
      tipo: archivo.fieldname,
      nombreArchivo: String(archivo.originalname || "documento").slice(0, 255),
      ruta: path.relative(config.saludUploadsDir, archivo.path).split(path.sep).join("/"),
      tipoMime: archivo.mimetype,
      tamanoBytes: archivo.size,
      subidoPorId: usuarioId || null,
    };
  }
}

module.exports = { SstArchivoService, sstArchivoService: new SstArchivoService() };
