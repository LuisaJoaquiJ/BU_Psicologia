const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");

// Fotos para promocionar una salida: las sube el personal y las ven los estudiantes.
const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 8;
const MAX_POR_VEZ = 8;
const MAX_POR_SALIDA = 12;

class FotoSalidaService {
  constructor(r = repos) {
    this.repos = r;
    this.subir = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => fs.mkdir(this.carpeta(), { recursive: true }, (err) => cb(err, this.carpeta())),
        filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`),
      }),
      limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_POR_VEZ },
      fileFilter(req, file, cb) {
        if (!TIPOS[file.mimetype]) return cb(new AppError(400, "Solo se permiten fotos JPG, PNG o WEBP."));
        cb(null, true);
      },
    }).array("fotos", MAX_POR_VEZ);
  }

  carpeta() {
    return path.join(config.saludUploadsDir, "salidas-fotos");
  }

  recibir = (req, res, next) => {
    this.subir(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `Cada foto puede pesar hasta ${MAX_MB} MB.`));
      if (err.code === "LIMIT_UNEXPECTED_FILE") return next(new AppError(400, `Máximo ${MAX_POR_VEZ} fotos por vez.`));
      next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir las fotos."));
    });
  };

  ruta(nombre) {
    return nombre && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nombre) ? path.join(this.carpeta(), nombre) : null;
  }

  borrarArchivos(archivos = []) {
    for (const a of archivos) fs.promises.unlink(a.path).catch(() => {});
  }

  // Fotos de cada salida: Map(salidaId -> [{ id, nombre }]).
  async deSalidas(ids) {
    const mapa = new Map();
    if (!ids.length) return mapa;
    for (const f of await this.repos.fotosSalida.deSalidas(ids)) {
      mapa.set(f.salidaId, [...(mapa.get(f.salidaId) || []), { id: f.id, nombre: f.nombreOriginal }]);
    }
    return mapa;
  }

  async agregar(salidaId, archivos) {
    try {
      if (!(await this.repos.salidas.buscarPorId(salidaId))) throw new AppError(404, "La salida no existe.");
      if (!archivos?.length) throw new AppError(400, "Adjunta al menos una foto.");
      const actuales = await this.repos.fotosSalida.contar({ salidaId });
      if (actuales + archivos.length > MAX_POR_SALIDA) throw new AppError(400, `Una salida admite hasta ${MAX_POR_SALIDA} fotos (ya tiene ${actuales}).`);
      const creadas = [];
      for (const a of archivos) {
        const f = await this.repos.fotosSalida.crear({
          salidaId,
          archivo: path.basename(a.path),
          nombreOriginal: String(a.originalname || "foto").slice(0, 255),
          tipoMime: a.mimetype,
        });
        creadas.push({ id: f.id, nombre: f.nombreOriginal });
      }
      return creadas;
    } catch (err) {
      this.borrarArchivos(archivos);
      throw err;
    }
  }

  async eliminar(salidaId, fotoId) {
    const foto = await this.repos.fotosSalida.buscarPorId(fotoId);
    if (!foto || foto.salidaId !== salidaId) throw new AppError(404, "La foto no existe.");
    await this.repos.fotosSalida.eliminar(fotoId);
    const ruta = this.ruta(foto.archivo);
    if (ruta) await fs.promises.unlink(ruta).catch(() => {});
    return { eliminada: fotoId };
  }

  async archivo(salidaId, fotoId) {
    const foto = await this.repos.fotosSalida.buscarPorId(fotoId);
    const ruta = foto && foto.salidaId === salidaId ? this.ruta(foto.archivo) : null;
    if (!ruta || !fs.existsSync(ruta)) throw new AppError(404, "Foto no disponible.");
    return { ruta, nombre: foto.nombreOriginal, tipo: foto.tipoMime };
  }
}

module.exports = { FotoSalidaService, fotoSalidaService: new FotoSalidaService() };
