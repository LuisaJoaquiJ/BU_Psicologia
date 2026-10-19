const { Router } = require("express");
const { authMiddleware } = require("../../../common/middlewares/auth.middleware");
const { requireModulo } = require("../../../common/middlewares/roles.middleware");
const { sstController: sst } = require("../controllers/SstController");
const { manejar } = require("./manejar");

// Panel del personal de Salud integral (/api/v1/salud): solo los correos con
// acceso al modulo; maneja datos personales y de salud.
const router = Router();
router.use(authMiddleware, requireModulo("salud"));

router.use("/", require("./registro.routes"));
router.use("/", require("./informes.routes"));
router.use("/salidas-inscripcion", require("./salidas.routes"));

// Bandeja de salidas institucionales y reportes SST.
router.get("/reportes-sst/resumen", manejar(sst.resumen));
router.get("/reportes-sst", manejar(sst.listar));
router.get("/reportes-sst/exportar", manejar(sst.exportar));
router.patch("/reportes-sst/:id", manejar(sst.revisar));

module.exports = router;
