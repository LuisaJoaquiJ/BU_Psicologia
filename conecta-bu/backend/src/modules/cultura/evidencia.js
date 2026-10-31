const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { prisma } = require("../../config/prisma");

const FORMATOS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function recibir(req, res, next) {
  const carpeta = path.join(config.saludUploadsDir, "cultura");
  fs.mkdirSync(carpeta, { recursive: true });
  multer({
    storage: multer.diskStorage({
      destination: carpeta,
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${FORMATOS[file.mimetype] || ""}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!FORMATOS[file.mimetype]) return cb(new AppError(400, "La evidencia debe ser JPG, PNG, WEBP o PDF."));
      cb(null, true);
    },
  }).single("evidencia")(req, res, (err) => {
    if (!err) return next();
    next(err instanceof AppError ? err : new AppError(400, "No se pudo subir la planilla. El archivo debe pesar hasta 5 MB."));
  });
}

async function guardar(req, res) {
  if (!req.file) throw new AppError(400, "Adjunta la foto o el PDF de la planilla.");
  const grupoId = req.body.grupoId || null;
  const eventoId = req.body.eventoId || null;
  if (!grupoId && !eventoId) throw new AppError(400, "Indica el grupo o el evento de la evidencia.");
  if (grupoId && !(await prisma.grupoCultural.findUnique({ where: { id: grupoId } }))) throw new AppError(404, "No se encontró el grupo.");
  if (eventoId && !(await prisma.eventoCultural.findUnique({ where: { id: eventoId } }))) throw new AppError(404, "No se encontró el evento.");
  const evidencia = await prisma.evidenciaCultural.create({
    data: {
      grupoId,
      eventoId,
      archivo: req.file.filename,
      nombreOriginal: String(req.file.originalname || "planilla").slice(0, 200),
      mime: req.file.mimetype,
      subidoPor: req.usuario.emailInstitucional,
    },
  });
  res.status(201).json(evidencia);
}

module.exports = { recibir, guardar };
