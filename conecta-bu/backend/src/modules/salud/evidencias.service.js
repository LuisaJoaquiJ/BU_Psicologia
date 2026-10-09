const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const { obtenerActividadOFallar } = require("./actividades.service");

// Evidencias de las actividades (fotos de la jornada, planillas firmadas,
// actas). Reemplazan la hoja "REGISTRO FOTOGRAFICO" del informe de gestion:
// quedan asociadas a la actividad, la fecha y quien las subio.

const TIPOS_PERMITIDOS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function carpetaEvidencias() {
  return path.join(config.saludUploadsDir, "evidencias");
}

const almacenamiento = multer.diskStorage({
  destination(req, file, cb) {
    const carpeta = path.join(carpetaEvidencias(), String(req.params.id).replace(/[^0-9a-zA-Z-]/g, ""));
    fs.mkdir(carpeta, { recursive: true }, (err) => cb(err, carpeta));
  },
  filename(req, file, cb) {
    cb(null, `${crypto.randomUUID()}${TIPOS_PERMITIDOS[file.mimetype]}`);
  },
});

const subirEvidencias = multer({
  storage: almacenamiento,
  limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 10 },
  fileFilter(req, file, cb) {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      return cb(new AppError(400, "Solo se permiten fotos (JPG, PNG, WEBP) o PDF."));
    }
    cb(null, true);
  },
}).array("archivos", 10);

function borrarArchivos(archivos = []) {
  for (const a of archivos) fs.promises.unlink(a.path).catch(() => {});
}

async function guardarEvidencias(actividadId, archivos, { descripcion, fecha }, usuarioId) {
  try {
    await obtenerActividadOFallar(actividadId);
    if (!archivos?.length) throw new AppError(400, "Adjunta al menos una foto o PDF.");
    const fechaEvidencia = fecha ? aFechaUTC(fecha) : hoyBogota();
    const texto = String(descripcion || "").trim().slice(0, 300) || null;
    const creadas = [];
    for (const archivo of archivos) {
      creadas.push(
        await prisma.evidenciaSalud.create({
          data: {
            actividadId,
            fecha: fechaEvidencia,
            descripcion: texto,
            nombreArchivo: String(archivo.originalname || "evidencia").slice(0, 255),
            ruta: path.relative(config.saludUploadsDir, archivo.path).split(path.sep).join("/"),
            tipoMime: archivo.mimetype,
            tamanoBytes: archivo.size,
            subidoPorId: usuarioId || null,
          },
        })
      );
    }
    return creadas;
  } catch (err) {
    borrarArchivos(archivos);
    throw err;
  }
}

function rutaAbsoluta(evidencia) {
  const absoluta = path.resolve(config.saludUploadsDir, evidencia.ruta);
  // Nunca servir algo fuera de la carpeta de evidencias.
  if (!absoluta.startsWith(path.resolve(config.saludUploadsDir) + path.sep)) {
    throw new AppError(404, "Archivo no disponible.");
  }
  return absoluta;
}

async function obtenerEvidenciaOFallar(id) {
  const evidencia = await prisma.evidenciaSalud.findUnique({ where: { id } });
  if (!evidencia) throw new AppError(404, "La evidencia no existe.");
  return evidencia;
}

async function eliminarEvidencia(id) {
  const evidencia = await obtenerEvidenciaOFallar(id);
  await prisma.evidenciaSalud.delete({ where: { id } });
  await fs.promises.unlink(rutaAbsoluta(evidencia)).catch(() => {});
  return { eliminada: id };
}

module.exports = {
  subirEvidencias,
  guardarEvidencias,
  obtenerEvidenciaOFallar,
  eliminarEvidencia,
  rutaAbsoluta,
  carpetaEvidencias,
};
