const { app } = require("./app");
const { config } = require("./config/env");

app.listen(config.port, () => {
  console.log(`Conecta BU backend escuchando en http://localhost:${config.port}`);
  console.log(`Documentacion de salud: http://localhost:${config.port}/api/v1/health`);
});
