const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { almacenamiento } = require("../../common/storage/almacenamiento");

// Fotos de portada de los eventos de la agenda y de las convocatorias. Son
// publicas (las ven el portal y los estudiantes), a diferencia de las
// evidencias: no deben llevar listados ni datos de personas.
const FORMATOS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 5;
const BUCKET = "publico";

// tipo: carpeta en cultura/, modelo de Prisma y como se nombra en los mensajes.
const TIPOS = {
  eventos: { modelo: "eventoCultural", nombre: "el evento" },
  convocatorias: { modelo: "convocatoriaCultural", nombre: "la convocatoria" },
  grupos: { modelo: "grupoCultural", nombre: "el grupo" },
};

function crear(tipo) {
  const { modelo, nombre } = TIPOS[tipo];
  const carpeta = () => `cultura/${tipo}`;

  const subir = multer({
    storage: almacenamiento.motorMulter({ carpeta: carpeta(), extensionDe: (file) => FORMATOS[file.mimetype] }),
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
  const claveDe = (archivo) => (archivo && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(archivo) ? `${carpeta()}/${archivo}` : null);
  const borrar = (archivo) => {
    const clave = claveDe(archivo);
    return clave ? almacenamiento.borrar(clave, { bucket: BUCKET }) : Promise.resolve();
  };

  // La URL cambia al reemplazar la foto, para que el navegador no muestre la anterior.
  const urlImagen = (fila) => (fila?.imagen ? `/api/v1/cultura/publico/imagenes/${tipo}/${fila.id}?v=${fila.imagen.slice(0, 8)}` : null);

  async function guardar(id, archivo) {
    if (!archivo) throw new AppError(400, "Adjunta una foto.");
    const fila = await prisma[modelo].findUnique({ where: { id } });
    if (!fila) {
      await almacenamiento.descartar(archivo, { bucket: BUCKET });
      throw new AppError(404, `No se encontró ${nombre}.`);
    }
    const clave = await almacenamiento.guardar(archivo, { carpeta: carpeta(), bucket: BUCKET, extension: FORMATOS[archivo.mimetype] });
    const actualizado = await prisma[modelo].update({ where: { id }, data: { imagen: almacenamiento.nombreDe(archivo) || clave.split("/").pop() } });
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
    const clave = claveDe(fila?.imagen);
    if (!clave) return res.status(404).json({ message: `${nombre[0].toUpperCase()}${nombre.slice(1)} no tiene foto.` });
    return almacenamiento.enviar(res, {
      clave,
      bucket: BUCKET,
      cache: "public, max-age=86400",
      headers: { "Cross-Origin-Resource-Policy": "cross-origin" },
      mensaje404: "No se encontró la foto.",
    });
  }

  return { recibir, guardar, quitar, servir, urlImagen };
}

const eventos = crear("eventos");
const convocatorias = crear("convocatorias");
const grupos = crear("grupos");

// Las funciones sueltas siguen siendo las de los eventos (como antes).
module.exports = { ...eventos, eventos, convocatorias, grupos };
