const multer = require("multer");
const { AppError } = require("../../common/utils/AppError");
const { almacenamiento } = require("../../common/storage/almacenamiento");
const { prisma } = require("../../config/prisma");
const { TIPOS_EVIDENCIA } = require("./catalogo");

const FORMATOS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const CARPETA = "cultura";
const BUCKET = "privado";

function recibir(req, res, next) {
  multer({
    storage: almacenamiento.motorMulter({ carpeta: CARPETA, extensionDe: (file) => FORMATOS[file.mimetype] || "" }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!FORMATOS[file.mimetype]) return cb(new AppError(400, "La evidencia debe ser JPG, PNG, WEBP o PDF."));
      cb(null, true);
    },
  }).single("evidencia")(req, res, (err) => {
    if (!err) return next();
    next(err instanceof AppError ? err : new AppError(400, "No se pudo subir el archivo. Debe pesar hasta 5 MB."));
  });
}

async function guardar(req, res) {
  if (!req.file) throw new AppError(400, "Adjunta la foto o el PDF de la planilla.");
  const grupoId = req.body.grupoId || null;
  const eventoId = req.body.eventoId || null;
  const pausaId = req.body.pausaId || null;
  const representacionId = req.body.representacionId || null;
  const tipo = req.body.tipo || (req.file.mimetype === "application/pdf" ? "planilla" : "fotografia");
  try {
    if (!grupoId && !eventoId && !pausaId && !representacionId) throw new AppError(400, "Indica el grupo, el evento, la pausa creativa o la representación de la evidencia.");
    if (representacionId && !(await prisma.representacionRed.findUnique({ where: { id: representacionId } }))) throw new AppError(404, "No se encontró la representación.");
    if (grupoId && !(await prisma.grupoCultural.findUnique({ where: { id: grupoId } }))) throw new AppError(404, "No se encontró el grupo.");
    if (eventoId && !(await prisma.eventoCultural.findUnique({ where: { id: eventoId } }))) throw new AppError(404, "No se encontró el evento.");
    if (pausaId && !(await prisma.pausaCreativa.findUnique({ where: { id: pausaId } }))) throw new AppError(404, "No se encontró la pausa creativa.");
    if (!TIPOS_EVIDENCIA.includes(tipo)) throw new AppError(400, "Clasifica el archivo como fotografia, planilla u oficio.");
    if (tipo === "fotografia" && req.file.mimetype === "application/pdf") throw new AppError(400, "Un PDF se clasifica como planilla física u oficio.");
  } catch (err) {
    await almacenamiento.descartar(req.file, { bucket: BUCKET });
    throw err;
  }
  const clave = await almacenamiento.guardar(req.file, { carpeta: CARPETA, bucket: BUCKET, extension: FORMATOS[req.file.mimetype] });
  try {
    const evidencia = await prisma.evidenciaCultural.create({
      data: {
        grupoId,
        eventoId,
        pausaId,
        representacionId,
        tipo,
        archivo: almacenamiento.nombreDe(req.file) || clave.split("/").pop(),
        nombreOriginal: String(req.file.originalname || "evidencia").slice(0, 200),
        mime: req.file.mimetype,
        subidoPor: req.usuario.emailInstitucional,
      },
    });
    res.status(201).json(evidencia);
  } catch (err) {
    await almacenamiento.borrar(clave, { bucket: BUCKET });
    throw err;
  }
}

async function listar(filtro = {}) {
  const filas = await prisma.evidenciaCultural.findMany({ orderBy: { fecha: "desc" } });
  return filas
    .filter((e) => !filtro.grupoId || e.grupoId === filtro.grupoId)
    .filter((e) => !filtro.eventoId || e.eventoId === filtro.eventoId)
    .filter((e) => !filtro.pausaId || e.pausaId === filtro.pausaId)
    .filter((e) => !filtro.representacionId || e.representacionId === filtro.representacionId)
    .map((e) => ({ id: e.id, tipo: e.tipo, nombreOriginal: e.nombreOriginal, mime: e.mime, fecha: e.fecha, grupoId: e.grupoId, eventoId: e.eventoId, pausaId: e.pausaId, representacionId: e.representacionId }));
}

function claveDe(nombre) {
  if (!nombre || String(nombre).includes("..") || String(nombre).includes("/") || String(nombre).includes("\\")) return null;
  return `${CARPETA}/${nombre}`;
}

async function archivo(id) {
  const evidencia = await prisma.evidenciaCultural.findUnique({ where: { id } });
  if (!evidencia) throw new AppError(404, "No se encontró la evidencia.");
  const clave = claveDe(evidencia.archivo);
  if (!clave) throw new AppError(404, "Archivo no disponible.");
  return { clave, bucket: BUCKET, evidencia };
}

// Quita una evidencia (fila y archivo); sirve para corregir una foto subida por error.
async function eliminar(id) {
  const { clave, evidencia } = await archivo(id);
  await prisma.evidenciaCultural.delete({ where: { id: evidencia.id } });
  await almacenamiento.borrar(clave, { bucket: BUCKET });
}

module.exports = { recibir, guardar, listar, archivo, eliminar };
