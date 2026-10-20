const { Router } = require("express");
const multer = require("multer");
const { AppError } = require("../../../common/utils/AppError");
const { registroController: c } = require("../controllers/RegistroController");
const { evidenciaService } = require("../services/EvidenciaService");
const { manejar } = require("./manejar");

// Catalogos, personas, actividades, evidencias, atenciones e importacion.
const router = Router();

router.get("/catalogos", manejar(c.catalogos));

router.get("/personas/buscar", manejar(c.buscarPersonas));
// Lista de estudiantes activos: plantilla, descarga y carga del Excel.
router.get("/personas/estudiantes-activos", manejar(c.resumenActivos));
router.get("/personas/estudiantes-activos/plantilla", manejar(c.plantillaActivos));
router.get("/personas/estudiantes-activos/exportar", manejar(c.exportarActivos));
router.post("/personas/estudiantes-activos/importar", (req, res, next) => subirExcel(req, res, next), manejar(c.importarActivos));
router.get("/personas", manejar(c.personas));
router.post("/personas", manejar(c.crearPersona));
router.get("/personas/:id", manejar(c.persona));
router.patch("/personas/:id", manejar(c.actualizarPersona));

router.get("/actividades", manejar(c.actividades));
router.post("/actividades", manejar(c.crearActividad));
router.post("/actividades/copiar-periodo", manejar(c.copiarPeriodo));
router.get("/actividades/:id", manejar(c.actividad));
router.patch("/actividades/:id", manejar(c.actualizarActividad));
router.post("/actividades/:id/evidencias", evidenciaService.recibir, manejar(c.subirEvidencias));
router.get("/evidencias/:id/archivo", manejar(c.archivoEvidencia));
router.delete("/evidencias/:id", manejar(c.eliminarEvidencia));

// Registro rapido de atenciones y asistencias.
router.post("/atenciones", manejar(c.registrarAtencion));
router.post("/atenciones/lote", manejar(c.registrarLote));
router.get("/atenciones", manejar(c.atenciones));
router.patch("/atenciones/:id", manejar(c.actualizarAtencion));
router.delete("/atenciones/:id", manejar(c.eliminarAtencion));

// Importar los Excel que hoy lleva la Unidad de Salud.
function subirExcel(req, res, next) {
  return cargaExcel(req, res, next);
}
const cargaExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!/\.xlsx$/i.test(file.originalname || "")) return cb(new AppError(400, "Sube el archivo en formato .xlsx."));
    cb(null, true);
  },
}).single("archivo");
router.post("/importar", (req, res, next) => subirExcel(req, res, next), manejar(c.importar));

module.exports = router;
