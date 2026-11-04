const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");

// Foto de portada de los eventos de la agenda. Es publica (la ve el portal),
// a diferencia de las evidencias: no debe llevar listados ni datos de personas.
const FORMATOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;
const carpeta = () => path.join(config.saludUploadsDir, "cultura", "eventos");

const subir = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => fs.mkdir(carpeta(), { recursive: true }, (err) => cb(err, carpeta())),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${FORMATOS[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (FORMATOS[file.mimetype] ? cb(null, true) : cb(new AppError(400, "La foto debe ser JPG, PNG o WEBP."))),
}).single("imagen");

function recibir(req, res, next) {
  subir(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `La foto no puede pesar más de ${MAX_MB} MB.`));
    next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir la foto."));
  });
}

// Solo nombres generados aqui (uuid + extension): nadie puede pedir otro archivo.
const rutaDe = (nombre) => (nombre && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(nombre) ? path.join(carpeta(), nombre) : null);
const borrar = (nombre) => {
  const ruta = rutaDe(nombre);
  return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
};

// La URL cambia al reemplazar la foto, para que el navegador no muestre la anterior.
const urlImagen = (evento) => (evento?.imagen ? `/api/v1/cultura/publico/imagenes/eventos/${evento.id}?v=${evento.imagen.slice(0, 8)}` : null);

async function guardar(eventoId, archivo) {
  if (!archivo) throw new AppError(400, "Adjunta una foto.");
  const evento = await prisma.eventoCultural.findUnique({ where: { id: eventoId } });
  if (!evento) {
    await fs.promises.unlink(archivo.path).catch(() => {});
    throw new AppError(404, "No se encontró el evento.");
  }
  const actualizado = await prisma.eventoCultural.update({ where: { id: eventoId }, data: { imagen: path.basename(archivo.path) } });
  await borrar(evento.imagen);
  return { imagenUrl: urlImagen(actualizado) };
}

async function quitar(eventoId) {
  const evento = await prisma.eventoCultural.findUnique({ where: { id: eventoId } });
  if (!evento) throw new AppError(404, "No se encontró el evento.");
  await prisma.eventoCultural.update({ where: { id: eventoId }, data: { imagen: null } });
  await borrar(evento.imagen);
  return { imagenUrl: null };
}

async function servir(req, res) {
  const evento = await prisma.eventoCultural.findUnique({ where: { id: req.params.id } });
  const ruta = rutaDe(evento?.imagen);
  if (!ruta) return res.status(404).json({ message: "El evento no tiene foto." });
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("Cache-Control", "public, max-age=86400");
  return res.sendFile(ruta, (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: "No se encontró la foto." });
  });
}

module.exports = { recibir, guardar, quitar, servir, urlImagen };
