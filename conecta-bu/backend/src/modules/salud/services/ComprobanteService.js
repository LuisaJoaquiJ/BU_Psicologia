const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");

// Comprobantes de pago de las inscripciones a salidas (PDF o foto).
const TIPOS = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 10;

class ComprobanteService {
  constructor() {
    this.subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => fs.mkdir(this.carpeta(), { recursive: true }, (err) => cb(err, this.carpeta())),
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`),
      }),
      limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "El comprobante debe ser PDF o una foto (JPG, PNG, WEBP)."));
        cb(null, true);
      },
    }).single("comprobante");
  }

  carpeta() {
    return path.join(config.saludUploadsDir, "salidas");
  }

  // Middleware: recibe el archivo con mensajes claros.
  recibir = (req, res, next) => {
    this.subir(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `El comprobante no puede pesar más de ${MAX_MB} MB.`));
      next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir el comprobante."));
    });
  };

  // Ruta segura (solo nombres que genera el servidor).
  ruta(nombre) {
    if (!nombre || !/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(nombre)) return null;
    return path.join(this.carpeta(), nombre);
  }

  borrar(nombre) {
    const ruta = this.ruta(nombre);
    return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
  }

  existe(ruta) {
    return Boolean(ruta) && fs.existsSync(ruta);
  }
}

module.exports = { ComprobanteService, comprobanteService: new ComprobanteService() };
