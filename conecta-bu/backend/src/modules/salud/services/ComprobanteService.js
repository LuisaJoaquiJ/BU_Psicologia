const multer = require("multer");
const { AppError } = require("../../../common/utils/AppError");
const { almacenamiento } = require("../../../common/storage/almacenamiento");

// Comprobantes de pago de las inscripciones a salidas (PDF o foto).
const TIPOS = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 10;
const CARPETA = "salidas";
const BUCKET = "privado";

class ComprobanteService {
  constructor() {
    this.subir = multer({
      storage: almacenamiento.motorMulter({ carpeta: CARPETA, extensionDe: (file) => TIPOS[file.mimetype] }),
      limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "El comprobante debe ser PDF o una foto (JPG, PNG, WEBP)."));
        cb(null, true);
      },
    }).single("comprobante");
  }

  // Middleware: recibe el archivo con mensajes claros.
  recibir = (req, res, next) => {
    this.subir(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `El comprobante no puede pesar más de ${MAX_MB} MB.`));
      next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir el comprobante."));
    });
  };

  // Clave segura (solo nombres que genera el servidor).
  claveDe(nombre) {
    if (!nombre || !/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(nombre)) return null;
    return `${CARPETA}/${nombre}`;
  }

  async persistir(archivo) {
    const clave = await almacenamiento.guardar(archivo, { carpeta: CARPETA, bucket: BUCKET, extension: TIPOS[archivo.mimetype] });
    return almacenamiento.nombreDe(archivo) || clave.split("/").pop();
  }

  borrar(nombre) {
    const clave = this.claveDe(nombre);
    return clave ? almacenamiento.borrar(clave, { bucket: BUCKET }) : Promise.resolve();
  }

  descartar(archivo) {
    return almacenamiento.descartar(archivo, { bucket: BUCKET });
  }

  async existe(nombre) {
    const clave = this.claveDe(nombre);
    return Boolean(clave) && almacenamiento.existe(clave, { bucket: BUCKET });
  }

  refDe(nombre, nombreOriginal) {
    const clave = this.claveDe(nombre);
    return clave ? { clave, bucket: BUCKET, nombre: nombreOriginal || nombre } : null;
  }
}

module.exports = { ComprobanteService, comprobanteService: new ComprobanteService() };
