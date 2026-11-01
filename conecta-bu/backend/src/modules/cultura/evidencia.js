const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { prisma } = require("../../config/prisma");
const { TIPOS_EVIDENCIA } = require("./catalogo");

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
  const pausaId = req.body.pausaId || null;
  if (!grupoId && !eventoId && !pausaId) throw new AppError(400, "Indica el grupo, el evento o la pausa creativa de la evidencia.");
  if (grupoId && !(await prisma.grupoCultural.findUnique({ where: { id: grupoId } }))) throw new AppError(404, "No se encontró el grupo.");
  if (eventoId && !(await prisma.eventoCultural.findUnique({ where: { id: eventoId } }))) throw new AppError(404, "No se encontró el evento.");
  if (pausaId && !(await prisma.pausaCreativa.findUnique({ where: { id: pausaId } }))) throw new AppError(404, "No se encontró la pausa creativa.");
  const tipo = req.body.tipo || (req.file.mimetype === "application/pdf" ? "planilla" : "fotografia");
  if (!TIPOS_EVIDENCIA.includes(tipo)) throw new AppError(400, "Clasifica el archivo como fotografia o planilla.");
  if (tipo === "fotografia" && req.file.mimetype === "application/pdf") throw new AppError(400, "Un PDF se clasifica como planilla física.");
  const evidencia = await prisma.evidenciaCultural.create({
    data: {
      grupoId,
      eventoId,
      pausaId,
      tipo,
      archivo: req.file.filename,
      nombreOriginal: String(req.file.originalname || "evidencia").slice(0, 200),
      mime: req.file.mimetype,
      subidoPor: req.usuario.emailInstitucional,
    },
  });
  res.status(201).json(evidencia);
}

async function listar(filtro = {}) {
  const filas = await prisma.evidenciaCultural.findMany({ orderBy: { fecha: "desc" } });
  return filas
    .filter((e) => !filtro.grupoId || e.grupoId === filtro.grupoId)
    .filter((e) => !filtro.eventoId || e.eventoId === filtro.eventoId)
    .filter((e) => !filtro.pausaId || e.pausaId === filtro.pausaId)
    .map((e) => ({ id: e.id, tipo: e.tipo, nombreOriginal: e.nombreOriginal, mime: e.mime, fecha: e.fecha, grupoId: e.grupoId, eventoId: e.eventoId, pausaId: e.pausaId }));
}

async function archivo(id) {
  const evidencia = await prisma.evidenciaCultural.findUnique({ where: { id } });
  if (!evidencia) throw new AppError(404, "No se encontró la evidencia.");
  const absoluta = path.resolve(config.saludUploadsDir, "cultura", evidencia.archivo);
  const base = path.resolve(config.saludUploadsDir, "cultura") + path.sep;
  if (!absoluta.startsWith(base)) throw new AppError(404, "Archivo no disponible.");
  return { absoluta, evidencia };
}

module.exports = { recibir, guardar, listar, archivo };
