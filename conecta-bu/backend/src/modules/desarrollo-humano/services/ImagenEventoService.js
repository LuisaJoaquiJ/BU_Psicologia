const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");

// Foto de los talleres y eventos: se guarda en uploads/eventos y el evento
// solo conserva el nombre del archivo. Se ve en las tarjetas del estudiante y
// en la agenda publica.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;

class ImagenEventoService {
  constructor(r = repos) {
    this.repos = r;
    this.subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => fs.mkdir(this.carpeta(), { recursive: true }, (err) => cb(err, this.carpeta())),
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`),
      }),
      limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "La imagen debe ser JPG, PNG o WEBP."));
        cb(null, true);
      },
    }).single("imagen");
  }

  carpeta() {
    return path.join(config.saludUploadsDir, "eventos");
  }

  // Middleware: recibe el archivo con mensajes claros (muy grande, etc.).
  recibir = (req, res, next) => {
    this.subir(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `La imagen no puede pesar más de ${MAX_MB} MB.`));
      next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir la imagen."));
    });
  };

  // Nombre seguro (solo el que genera el servidor: uuid + extension).
  rutaDe(nombre) {
    if (!nombre || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nombre)) return null;
    return path.join(this.carpeta(), nombre);
  }

  borrar(nombre) {
    const ruta = this.rutaDe(nombre);
    return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
  }

  async guardar(eventoId, archivo) {
    if (!archivo) throw new AppError(400, "Adjunta una imagen.");
    const evento = await this.repos.eventos.buscarPorId(eventoId);
    if (!evento) {
      await this.borrar(path.basename(archivo.path));
      throw new AppError(404, "El evento no existe.");
    }
    const actualizado = await this.repos.eventos.actualizar(eventoId, { imagen: path.basename(archivo.path) });
    if (evento.imagen) await this.borrar(evento.imagen);
    return actualizado;
  }

  async quitar(eventoId) {
    const evento = await this.repos.eventos.buscarPorId(eventoId);
    if (!evento) throw new AppError(404, "El evento no existe.");
    if (evento.imagen) await this.borrar(evento.imagen);
    return this.repos.eventos.actualizar(eventoId, { imagen: null });
  }

  // Ruta del archivo de la foto de un evento, o null si no tiene.
  async archivoDe(eventoId) {
    const evento = await this.repos.eventos.buscarPorId(eventoId);
    return this.rutaDe(evento?.imagen);
  }

  // URL publica (cambia al reemplazarla, asi el navegador no usa la anterior).
  url(evento) {
    return evento?.imagen ? `/api/v1/eventos/${evento.id}/imagen?v=${evento.imagen.slice(0, 8)}` : null;
  }

  conUrl = (evento) => (evento ? { ...evento, imagenUrl: this.url(evento) } : evento);
}

module.exports = { ImagenEventoService, imagenEventoService: new ImagenEventoService() };
