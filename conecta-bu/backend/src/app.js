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
const { notFoundHandler, errorHandler } = require("./common/middlewares/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
