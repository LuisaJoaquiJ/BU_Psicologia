// Agenda de citas propia de Salud integral (servicios, horarios, citas,
// tiempo no disponible y atencion sin cita), con sus propias tablas.
module.exports = {
  servicios: require("./routes/servicios.routes"),
  citas: require("./routes/citas.routes"),
  horarios: require("./routes/horarios.routes"),
  agenda: require("./routes/agenda.routes"),
};
