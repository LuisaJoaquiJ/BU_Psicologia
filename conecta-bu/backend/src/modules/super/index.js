// Modulo del superadministrador: accesos del personal de cada modulo,
// usuarios y roles, y el tablero con las cifras de todos los modulos (que
// lee directamente de las tablas, sin usar codigo de los modulos).
module.exports = {
  router: require("./routes/super.routes"),
  usuarios: require("./routes/usuarios.routes"),
};
