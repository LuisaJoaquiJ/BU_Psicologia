const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { config } = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const adminRoutes = require("./modules/admin/admin.routes");
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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
