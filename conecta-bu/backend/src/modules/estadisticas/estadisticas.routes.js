const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../common/middlewares/roles.middleware");
const { obtenerEstadisticas, obtenerInforme } = require("./estadisticas.service");
const { generarExcel } = require("./informe.excel");
const { generarPdf } = require("./informe.pdf");
const { AppError } = require("../../common/utils/AppError");
const { listarEjecuciones } = require("../../integrations/n8n.client");

const router = Router();

router.use(authMiddleware, requireModulo("desarrollo-humano"));

// RF-015: indicadores de participacion y asistencia (citas y eventos).
router.get("/", async (req, res, next) => {
  try {
    const estadisticas = await obtenerEstadisticas({ desde: req.query.desde, hasta: req.query.hasta });
    res.status(200).json(estadisticas);
  } catch (err) {
    next(err);
  }
});

// RF-015: informe descargable (Excel o PDF) con el mismo filtro de fechas.
const FORMATOS = {
  xlsx: { generar: generarExcel, tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { generar: generarPdf, tipo: "application/pdf" },
};

router.get("/informe", async (req, res, next) => {
  try {
    const formato = FORMATOS[req.query.formato || "xlsx"];
    if (!formato) throw new AppError(400, "El formato debe ser xlsx o pdf.");
    const { desde, hasta } = req.query;
    const informe = await obtenerInforme({ desde, hasta });
    const archivo = await formato.generar(informe);
    const sufijo = desde || hasta ? `${desde || "inicio"}_a_${hasta || "hoy"}` : informe.generado.toISOString().slice(0, 10);
    const extension = req.query.formato === "pdf" ? "pdf" : "xlsx";
    res.set({
      "Content-Type": formato.tipo,
      "Content-Disposition": `attachment; filename="informe-bienestar-${sufijo}.${extension}"`,
      "Cache-Control": "no-store",
    });
    res.status(200).send(Buffer.from(archivo));
  } catch (err) {
    next(err);
  }
});

// RF-013: ultimas ejecuciones de automatizaciones n8n (para revisar fallos).
router.get("/automatizaciones", (req, res) => {
  res.status(200).json({ ejecuciones: listarEjecuciones() });
});

module.exports = router;
