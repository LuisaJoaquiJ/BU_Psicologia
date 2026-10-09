const { Router } = require("express");
const multer = require("multer");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { AppError } = require("../../common/utils/AppError");
const catalogos = require("./catalogos");
const personas = require("./personas.service");
const actividades = require("./actividades.service");
const atenciones = require("./atenciones.service");
const evidencias = require("./evidencias.service");
const reportes = require("./reportes.service");
const { importarExcel } = require("./importador.service");
const { routerPersonal: reportesSst } = require("./sst.routes");

// Modulo Salud integral (/api/v1/salud). Todo es exclusivo del rol "Salud"
// (personal de la Unidad de Salud): maneja datos personales y de salud.
const router = Router();
router.use(authMiddleware, requireModulo("salud"));

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function enviarExcel(res, { buffer, nombre }) {
  res.set({ "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
  res.status(200).send(Buffer.from(buffer));
}

// ---- Catalogos -------------------------------------------------------------
router.get(
  "/catalogos",
  manejar(async (req, res) => {
    res.json({
      programas: catalogos.PROGRAMAS,
      poblaciones: catalogos.POBLACIONES,
      tiposDocumento: catalogos.TIPOS_DOCUMENTO,
      categorias: catalogos.CATEGORIAS,
      examenesLaborales: catalogos.EXAMENES_LABORALES,
      periodos: await actividades.listarPeriodos(),
      periodoActual: catalogos.periodoDeFecha(new Date(Date.now() - 5 * 3600 * 1000)),
    });
  })
);

// ---- Personas --------------------------------------------------------------
router.get("/personas/buscar", manejar(async (req, res) => res.json(await personas.buscarPersonas(req.query.q))));
router.get("/personas", manejar(async (req, res) => res.json(await personas.listarPersonas(req.query))));
router.post("/personas", manejar(async (req, res) => res.status(201).json({ persona: await personas.crearPersona(req.body) })));
router.get("/personas/:id", manejar(async (req, res) => res.json({ persona: await personas.obtenerPersona(req.params.id) })));
router.patch("/personas/:id", manejar(async (req, res) => res.json({ persona: await personas.actualizarPersona(req.params.id, req.body) })));

// ---- Actividades -----------------------------------------------------------
router.get(
  "/actividades",
  manejar(async (req, res) =>
    res.json({
      actividades: await actividades.listarActividades({
        periodo: req.query.periodo,
        categoria: req.query.categoria,
        incluirInactivas: req.query.incluirInactivas === "true",
      }),
    })
  )
);
router.post("/actividades", manejar(async (req, res) => res.status(201).json({ actividad: await actividades.crearActividad(req.body) })));
router.post(
  "/actividades/copiar-periodo",
  manejar(async (req, res) => res.status(201).json(await actividades.copiarCatalogo(req.body.origen, req.body.destino)))
);
router.get("/actividades/:id", manejar(async (req, res) => res.json({ actividad: await actividades.obtenerActividad(req.params.id) })));
router.patch("/actividades/:id", manejar(async (req, res) => res.json({ actividad: await actividades.actualizarActividad(req.params.id, req.body) })));

// ---- Evidencias ------------------------------------------------------------
router.post(
  "/actividades/:id/evidencias",
  (req, res, next) => evidencias.subirEvidencias(req, res, next),
  manejar(async (req, res) =>
    res.status(201).json({ evidencias: await evidencias.guardarEvidencias(req.params.id, req.files, req.body, req.usuario.id) })
  )
);
router.get(
  "/evidencias/:id/archivo",
  manejar(async (req, res) => {
    const evidencia = await evidencias.obtenerEvidenciaOFallar(req.params.id);
    res.set("Content-Type", evidencia.tipoMime);
    res.set("Content-Disposition", `inline; filename="${encodeURIComponent(evidencia.nombreArchivo)}"`);
    res.set("Cache-Control", "private, max-age=3600");
    res.sendFile(evidencias.rutaAbsoluta(evidencia), (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: "Archivo no disponible.", error: "Not Found" });
    });
  })
);
router.delete("/evidencias/:id", manejar(async (req, res) => res.json(await evidencias.eliminarEvidencia(req.params.id))));

// ---- Atenciones (registro rapido) -------------------------------------------
router.post("/atenciones", manejar(async (req, res) => res.status(201).json({ atencion: await atenciones.registrarAtencion(req.body, req.usuario.id) })));
router.post("/atenciones/lote", manejar(async (req, res) => res.status(201).json(await atenciones.registrarLote(req.body, req.usuario.id))));
router.get("/atenciones", manejar(async (req, res) => res.json({ atenciones: await atenciones.listarAtenciones(req.query) })));
router.patch("/atenciones/:id", manejar(async (req, res) => res.json({ atencion: await atenciones.actualizarAtencion(req.params.id, req.body) })));
router.delete("/atenciones/:id", manejar(async (req, res) => res.json(await atenciones.eliminarAtencion(req.params.id))));

// ---- Reportes --------------------------------------------------------------
router.get("/resumen", manejar(async (req, res) => res.json(await reportes.resumen(req.query))));
router.get("/reportes/gestion", manejar(async (req, res) => enviarExcel(res, await reportes.informeGestion(req.query))));
router.get(
  "/reportes/snies",
  manejar(async (req, res) => {
    const reporte = await reportes.reporteSnies(req.query);
    if (reporte.sinResponsable.length) res.set("X-Actividades-Sin-Responsable", String(reporte.sinResponsable.length));
    enviarExcel(res, reporte);
  })
);
router.get("/reportes/registro", manejar(async (req, res) => enviarExcel(res, await reportes.registroGeneral(req.query))));

// ---- Salidas institucionales y reportes SST (revision) ----------------------
router.use("/reportes-sst", reportesSst);

// ---- Importar Excel existentes ---------------------------------------------
const subirExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!/\.xlsx$/i.test(file.originalname || "")) return cb(new AppError(400, "Sube el archivo en formato .xlsx."));
    cb(null, true);
  },
}).single("archivo");

router.post(
  "/importar",
  (req, res, next) => subirExcel(req, res, next),
  manejar(async (req, res) => {
    if (!req.file) throw new AppError(400, "Adjunta el archivo de Excel.");
    const resultado = await importarExcel(req.file.buffer, { confirmar: req.query.confirmar === "true" }, req.usuario.id);
    res.status(resultado.confirmado ? 201 : 200).json(resultado);
  })
);

module.exports = router;
