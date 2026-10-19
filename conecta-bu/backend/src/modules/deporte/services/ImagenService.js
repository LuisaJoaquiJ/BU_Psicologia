const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");

// Fotos de Deporte: eventos, disciplinas, implementos y comunicados. Cada una
// se guarda en uploads/deporte/<tipo> y el registro solo conserva el nombre
// del archivo (uuid + extension), igual que los eventos de Desarrollo Humano.

const ENTIDADES = {
  eventos: { repo: repos.eventos, nombre: "El evento" },
  disciplinas: { repo: repos.disciplinas, nombre: "La disciplina" },
  implementos: { repo: repos.implementos, nombre: "El implemento" },
  alertas: { repo: repos.alertas, nombre: "El comunicado" },
};
const FORMATOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;

class ImagenService {
  constructor() {
    this.ENTIDADES = ENTIDADES;
  }

  entidad(tipo) {
    const e = ENTIDADES[tipo];
    if (!e) throw new AppError(404, "Tipo de imagen no válido.");
    return e;
  }

  carpeta(tipo) {
    return path.join(config.saludUploadsDir, "deporte", tipo);
  }

  // Middleware de Express que recibe el campo "imagen" (multipart) del tipo indicado.
  recibirImagen(tipo) {
    this.entidad(tipo);
    const carpeta = this.carpeta(tipo);
    const subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => fs.mkdir(carpeta, { recursive: true }, (err) => cb(err, carpeta)),
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${FORMATOS[file.mimetype]}`),
      }),
      limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
      fileFilter: (req, file, cb) => (FORMATOS[file.mimetype] ? cb(null, true) : cb(new AppError(400, "La imagen debe ser JPG, PNG o WEBP."))),
    }).single("imagen");
    return (req, res, next) =>
      subir(req, res, (err) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `La imagen no puede pesar más de ${MAX_MB} MB.`));
        next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir la imagen."));
      });
  }

  // Ruta en disco, solo para nombres generados por el servidor.
  rutaDe(tipo, nombre) {
    if (!ENTIDADES[tipo] || !nombre || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nombre)) return null;
    return path.join(this.carpeta(tipo), nombre);
  }

  borrar(tipo, nombre) {
    const ruta = this.rutaDe(tipo, nombre);
    return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
  }

  async obtener(tipo, id) {
    const { repo, nombre } = this.entidad(tipo);
    const fila = await repo.buscarPorId(id);
    if (!fila) throw new AppError(404, `${nombre} no existe.`);
    return fila;
  }

  async guardarImagen(tipo, id, archivo) {
    if (!archivo) throw new AppError(400, "Adjunta una imagen.");
    let fila;
    try {
      fila = await this.obtener(tipo, id);
    } catch (err) {
      await fs.promises.unlink(archivo.path).catch(() => {});
      throw err;
    }
    const actualizado = await ENTIDADES[tipo].repo.actualizar(id, { imagen: path.basename(archivo.path) });
    if (fila.imagen) await this.borrar(tipo, fila.imagen);
    return { imagenUrl: this.urlImagen(tipo, actualizado) };
  }

  async quitarImagen(tipo, id) {
    const fila = await this.obtener(tipo, id);
    if (fila.imagen) await this.borrar(tipo, fila.imagen);
    await ENTIDADES[tipo].repo.actualizar(id, { imagen: null });
    return { imagenUrl: null };
  }

  // URL publica; cambia al reemplazar la foto para que el navegador no use la anterior.
  urlImagen(tipo, fila) {
    return fila?.imagen ? `/api/v1/deporte/imagenes/${tipo}/${fila.id}?v=${fila.imagen.slice(0, 8)}` : null;
  }

  // Agrega imagenUrl y quita el nombre interno del archivo.
  conImagen(tipo, fila) {
    if (!fila) return fila;
    const { imagen, ...resto } = fila;
    return { ...resto, imagenUrl: this.urlImagen(tipo, fila) };
  }

  async archivoDe(tipo, id) {
    const fila = await this.entidad(tipo).repo.buscarPorId(id);
    return this.rutaDe(tipo, fila?.imagen);
  }
}

module.exports = new ImagenService();
