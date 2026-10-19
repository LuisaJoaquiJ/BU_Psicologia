const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { config } = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const desarrollo = require("./modules/desarrollo-humano");
const salud = require("./modules/salud");
const superadmin = require("./modules/super");
const deporte = require("./modules/deporte");
const { notFoundHandler, errorHandler } = require("./common/middlewares/error.middleware");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    // Para leer el nombre de los Excel descargados y avisos de los reportes.
    exposedHeaders: ["Content-Disposition", "X-Actividades-Sin-Responsable"],
  })
);
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ status: "ok", servicio: "conecta-bu-backend" });
});

app.use("/api/v1/auth", authRoutes);
// Desarrollo Humano y Orientacion.
app.use("/api/v1/admin", desarrollo.admin);
app.use("/api/v1/servicios", desarrollo.servicios);
app.use("/api/v1/citas", desarrollo.citas);
app.use("/api/v1/admin/horarios", desarrollo.horarios);
app.use("/api/v1/admin/citas", desarrollo.agenda);
app.use("/api/v1/eventos", desarrollo.eventos);
app.use("/api/v1/admin/eventos", desarrollo.eventosAdmin);
app.use("/api/v1/admin/estadisticas", desarrollo.estadisticas);
app.use("/api/v1/asistente", desarrollo.asistente);
// Modulo Salud integral: vista del estudiante y panel del personal de salud.
app.use("/api/v1/salud/estudiante", salud.estudiante);
app.use("/api/v1/salud/servicios", salud.agenda.servicios);
app.use("/api/v1/salud/estudiante/citas", salud.agenda.citas);
app.use("/api/v1/salud/horarios", salud.agenda.horarios);
app.use("/api/v1/salud/citas", salud.agenda.agenda);
// Superadministrador: accesos de cada modulo y vista general de Conecta BU.
app.use("/api/v1/admin/usuarios", superadmin.usuarios);
app.use("/api/v1/super/informes", salud.informesSuper);
app.use("/api/v1/super", superadmin.router);
// Modulo Deporte: estudiantes (oferta, inscripciones, horas) y personal (/admin).
app.use("/api/v1/deporte/imagenes", deporte.imagenes);
app.use("/api/v1/deporte/admin", deporte.admin);
app.use("/api/v1/deporte/docente", deporte.docente);
app.use("/api/v1/deporte", deporte.router);
// Salidas institucionales y reportes SST: los diligencia cualquier persona de la Institucion.
app.use("/api/v1/reportes-sst", salud.reportesSst);
app.use("/api/v1/salud", salud.personal);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
