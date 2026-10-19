const { Router } = require("express");
const { informeController: c } = require("../controllers/InformeController");
const { manejar } = require("./manejar");

// Inicio, reportes descargables e informe de gestion para el superadministrador.
const router = Router();

router.get("/resumen", manejar(c.resumen));
router.get("/reportes/gestion", manejar(c.gestion));
router.get("/reportes/snies", manejar(c.snies));
router.get("/reportes/registro", manejar(c.registro));

router.get("/informes", manejar(c.informes));
router.get("/informes/historicos", manejar(c.historicos));
router.put("/informes/historicos", manejar(c.guardarHistoricos));
router.get("/informes/:periodo", manejar(c.informe));
router.put("/informes/:periodo", manejar(c.guardar));
router.post("/informes/:periodo/enviar", manejar(c.enviar));
router.get("/informes/:periodo/archivo", manejar(c.archivoInforme));

module.exports = router;
