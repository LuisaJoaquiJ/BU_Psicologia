const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { config } = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const serviciosRoutes = require("./modules/servicios/servicios.routes");
const citasRoutes = require("./modules/citas/citas.routes");
const horariosAdminRoutes = require("./modules/horarios/horarios.routes");
const citasAdminRoutes = require("./modules/citas/citas.admin.routes");
const eventosRoutes = require("./modules/eventos/eventos.routes");
const eventosAdminRoutes = require("./modules/eventos/eventos.admin.routes");
const usuariosAdminRoutes = require("./modules/usuarios/usuarios.routes");
const estadisticasAdminRoutes = require("./modules/estadisticas/estadisticas.routes");
const asistenteRoutes = require("./modules/asistente/asistente.routes");
const saludEstudianteRoutes = require("./modules/salud/salud.estudiante.routes");
const saludRoutes = require("./modules/salud/salud.routes");
const superRoutes = require("./modules/super/super.routes");
const deporte = require("./modules/deporte/deporte.routes");
const { router: reportesSstRoutes } = require("./modules/salud/sst.routes");
const { crearRouterHorarios } = require("./modules/horarios/horarios.routes");
const { crearRouterAgenda } = require("./modules/citas/citas.admin.routes");
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
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/servicios", serviciosRoutes);
app.use("/api/v1/citas", citasRoutes);
app.use("/api/v1/admin/horarios", horariosAdminRoutes);
app.use("/api/v1/admin/citas", citasAdminRoutes);
app.use("/api/v1/eventos", eventosRoutes);
app.use("/api/v1/admin/eventos", eventosAdminRoutes);
app.use("/api/v1/admin/usuarios", usuariosAdminRoutes);
app.use("/api/v1/admin/estadisticas", estadisticasAdminRoutes);
app.use("/api/v1/asistente", asistenteRoutes);
// Modulo Salud integral: vista del estudiante y panel del personal de salud.
app.use("/api/v1/salud/estudiante", saludEstudianteRoutes);
app.use("/api/v1/salud/horarios", crearRouterHorarios("salud"));
app.use("/api/v1/salud/citas", crearRouterAgenda("salud"));
// Superadministrador: accesos de cada modulo y vista general de Conecta BU.
app.use("/api/v1/super", superRoutes);
// Modulo Deporte: estudiantes (oferta, inscripciones, horas) y personal (/admin).
app.use("/api/v1/deporte/admin", deporte.admin);
app.use("/api/v1/deporte", deporte.router);
// Salidas institucionales y reportes SST: los diligencia cualquier persona de la Institucion.
app.use("/api/v1/reportes-sst", reportesSstRoutes);
app.use("/api/v1/salud", saludRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
