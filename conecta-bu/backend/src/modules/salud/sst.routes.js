const { Router } = require("express");
const { authMiddleware } = require("../../common/middlewares/auth.middleware");
const { AppError } = require("../../common/utils/AppError");
const sst = require("./sst.service");
const excel = require("./sst.excel");
const { catalogoPublico } = require("./sst.catalogos");

const manejar = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

function leerDatos(req) {
  if (req.is("multipart/form-data")) {
    try {
      return JSON.parse(req.body?.datos || "{}");
    } catch {
      throw new AppError(400, "Los datos del formulario no son válidos.");
    }
  }
  return req.body || {};
}

function enviarArchivo(res, adjunto, rutaAbsoluta) {
  res.set("Content-Type", adjunto.tipoMime);
  res.set("Content-Disposition", `inline; filename="${encodeURIComponent(adjunto.nombreArchivo)}"`);
  res.set("Cache-Control", "private, max-age=3600");
  res.sendFile(rutaAbsoluta, (err) => {
    if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: "Archivo no disponible.", error: "Not Found" });
  });
}

// /api/v1/reportes-sst: cualquier persona de la Institucion con sesion
// reporta sus salidas, traslados o condiciones inseguras y sigue su estado.
const router = Router();
router.use(authMiddleware);

router.get("/catalogos", (req, res) => res.json(catalogoPublico()));
router.get("/personas", manejar(async (req, res) => res.json({ personas: await sst.buscarPersonas(req.query.q) })));
router.get("/mios", manejar(async (req, res) => res.json({ reportes: await sst.listarMios(req.usuario) })));
router.post(
  "/",
  (req, res, next) => sst.recibirArchivos(req, res, next),
  manejar(async (req, res) => {
    let datos;
    try {
      datos = leerDatos(req);
    } catch (err) {
      for (const f of req.files || []) require("fs").promises.unlink(f.path).catch(() => {});
      throw err;
    }
    res.status(201).json({ reporte: await sst.crearReporte(datos, req.files || [], req.usuario) });
  })
);
router.get("/:id", manejar(async (req, res) => res.json({ reporte: await sst.obtenerReporte(req.params.id, req.usuario) })));
router.post(
  "/:id/adjuntos",
  (req, res, next) => sst.recibirArchivos(req, res, next),
  manejar(async (req, res) => res.status(201).json({ reporte: await sst.agregarAdjuntos(req.params.id, req.files || [], req.usuario) }))
);
router.get(
  "/adjuntos/:id/archivo",
  manejar(async (req, res) => {
    const adjunto = await sst.obtenerAdjunto(req.params.id, req.usuario);
    enviarArchivo(res, adjunto, sst.rutaAbsoluta(adjunto));
  })
);

// /api/v1/salud/reportes-sst: bandeja del personal de Salud integral (se
// monta dentro de salud.routes, que ya exige el acceso al modulo).
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const routerPersonal = Router();
routerPersonal.get("/resumen", manejar(async (req, res) => res.json(await sst.resumen())));
routerPersonal.get("/", manejar(async (req, res) => res.json(await sst.listarReportes(req.query))));
routerPersonal.get(
  "/exportar",
  manejar(async (req, res) => {
    const { reportes } = await sst.listarReportes(req.query);
    const { buffer, nombre } = await excel.generarExcel(reportes, req.query);
    res.set({ "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
    res.status(200).send(Buffer.from(buffer));
  })
);
routerPersonal.patch("/:id", manejar(async (req, res) => res.json({ reporte: await sst.revisarReporte(req.params.id, req.body, req.usuario) })));

module.exports = { router, routerPersonal };
