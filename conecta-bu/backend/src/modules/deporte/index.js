// Modulo Deporte: routers que monta app.js.
//   /api/v1/deporte           -> estudiante
//   /api/v1/deporte/admin     -> coordinacion
//   /api/v1/deporte/docente   -> panel del docente
//   /api/v1/deporte/imagenes  -> fotos publicas
module.exports = {
  router: require("./routes/estudiante.routes"),
  admin: require("./routes/admin.routes"),
  docente: require("./routes/docente.routes"),
  imagenes: require("./routes/imagenes.routes"),
};
