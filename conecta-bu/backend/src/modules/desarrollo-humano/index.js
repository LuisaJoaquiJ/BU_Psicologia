// Modulo Desarrollo Humano y Orientacion: agenda de citas propia, eventos y
// talleres, estadisticas e informe, y el asistente de orientacion. No usa
// nada de los demas modulos (solo la sesion y la conexion a la base de datos).
module.exports = {
  servicios: require("./routes/servicios.routes"),
  citas: require("./routes/citas.routes"),
  horarios: require("./routes/horarios.routes"),
  agenda: require("./routes/agenda.routes"),
  eventos: require("./routes/eventos.routes"),
  eventosAdmin: require("./routes/eventos.admin.routes"),
  estadisticas: require("./routes/estadisticas.routes"),
  asistente: require("./routes/asistente.routes"),
  admin: require("./routes/admin.routes"),
};
