const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");

// Fotos de portada de los eventos de la agenda y de las convocatorias. Son
// publicas (las ven el portal y los estudiantes), a diferencia de las
// evidencias: no deben llevar listados ni datos de personas.
const FORMATOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;

// tipo: carpeta en uploads/cultura, modelo de Prisma y como se nombra en los mensajes.
const TIPOS = {
  eventos: { modelo: "eventoCultural", nombre: "el evento" },
  convocatorias: { modelo: "convocatoriaCultural", nombre: "la convocatoria" },
  grupos: { modelo: "grupoCultural", nombre: "el grupo" },
};

function crear(tipo) {
  const { modelo, nombre } = TIPOS[tipo];
  const carpeta = () => path.join(config.saludUploadsDir, "cultura", tipo);

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
  const rutaDe = (archivo) => (archivo && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(archivo) ? path.join(carpeta(), archivo) : null);
  const borrar = (archivo) => {
    const ruta = rutaDe(archivo);
    return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
  };

  // La URL cambia al reemplazar la foto, para que el navegador no muestre la anterior.
  const urlImagen = (fila) => (fila?.imagen ? `/api/v1/cultura/publico/imagenes/${tipo}/${fila.id}?v=${fila.imagen.slice(0, 8)}` : null);

  async function guardar(id, archivo) {
    if (!archivo) throw new AppError(400, "Adjunta una foto.");
    const fila = await prisma[modelo].findUnique({ where: { id } });
    if (!fila) {
      await fs.promises.unlink(archivo.path).catch(() => {});
      throw new AppError(404, `No se encontró ${nombre}.`);
    }
    const actualizado = await prisma[modelo].update({ where: { id }, data: { imagen: path.basename(archivo.path) } });
    await borrar(fila.imagen);
    return { imagenUrl: urlImagen(actualizado) };
  }

  async function quitar(id) {
    const fila = await prisma[modelo].findUnique({ where: { id } });
    if (!fila) throw new AppError(404, `No se encontró ${nombre}.`);
    await prisma[modelo].update({ where: { id }, data: { imagen: null } });
    await borrar(fila.imagen);
    return { imagenUrl: null };
  }

  async function servir(req, res) {
    const fila = await prisma[modelo].findUnique({ where: { id: req.params.id } });
    const ruta = rutaDe(fila?.imagen);
    if (!ruta) return res.status(404).json({ message: `${nombre[0].toUpperCase()}${nombre.slice(1)} no tiene foto.` });
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", "public, max-age=86400");
    return res.sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: "No se encontró la foto." });
    });
  }

  return { recibir, guardar, quitar, servir, urlImagen };
}

const eventos = crear("eventos");
const convocatorias = crear("convocatorias");
const grupos = crear("grupos");

// Las funciones sueltas siguen siendo las de los eventos (como antes).
module.exports = { ...eventos, eventos, convocatorias, grupos };
