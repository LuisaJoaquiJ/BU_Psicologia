// Modulo Salud integral: registro de atenciones y actividades, agenda de
// citas propia, salidas con inscripcion, salidas institucionales y reportes
// SST, reportes (SNIES, registro general) e informe de gestion.
const agenda = require("./agenda");

module.exports = {
  personal: require("./routes/personal.routes"),
  estudiante: require("./routes/estudiante.routes"),
  reportesSst: require("./routes/sst.routes"),
  informesSuper: require("./routes/informesSuper.routes"),
  agenda,
};
