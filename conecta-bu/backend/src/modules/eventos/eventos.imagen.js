const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");

// Foto de los talleres y eventos: se guarda en uploads/eventos y el evento
// solo conserva el nombre del archivo. Se ve en las tarjetas del estudiante y
// en la agenda publica.

const TIPOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;

function carpeta() {
  return path.join(config.saludUploadsDir, "eventos");
}

const subirImagen = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdir(carpeta(), { recursive: true }, (err) => cb(err, carpeta()));
    },
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}${TIPOS[file.mimetype]}`);
    },
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!TIPOS[file.mimetype]) return cb(new AppError(400, "La imagen debe ser JPG, PNG o WEBP."));
    cb(null, true);
  },
}).single("imagen");

// Envuelve multer para devolver mensajes claros (archivo muy grande, etc.).
function recibirImagen(req, res, next) {
  subirImagen(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `La imagen no puede pesar más de ${MAX_MB} MB.`));
    next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir la imagen."));
  });
}

// Nombre seguro (solo el que genera el servidor: uuid + extension).
function rutaDe(nombre) {
  if (!nombre || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nombre)) return null;
  return path.join(carpeta(), nombre);
}

function borrar(nombre) {
  const ruta = rutaDe(nombre);
  return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
}

async function guardarImagen(eventoId, archivo) {
  if (!archivo) throw new AppError(400, "Adjunta una imagen.");
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) {
    await borrar(path.basename(archivo.path));
    throw new AppError(404, "El evento no existe.");
  }
  const anterior = evento.imagen;
  const actualizado = await prisma.evento.update({ where: { id: eventoId }, data: { imagen: path.basename(archivo.path) } });
  if (anterior) await borrar(anterior);
  return actualizado;
}

async function quitarImagen(eventoId) {
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) throw new AppError(404, "El evento no existe.");
  if (evento.imagen) await borrar(evento.imagen);
  return prisma.evento.update({ where: { id: eventoId }, data: { imagen: null } });
}

// URL publica de la foto (cambia cuando se reemplaza, asi el navegador no
// muestra la anterior guardada en cache).
function urlImagen(evento) {
  return evento?.imagen ? `/api/v1/eventos/${evento.id}/imagen?v=${evento.imagen.slice(0, 8)}` : null;
}

module.exports = { recibirImagen, guardarImagen, quitarImagen, rutaDe, urlImagen, borrar };
