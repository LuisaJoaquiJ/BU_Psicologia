const { app } = require("./app");
const { config } = require("./config/env");
const { correoSuperadmin } = require("./common/utils/superadmin");
const { iniciarCierresAutomaticos } = require("./common/jobs/cierresAutomaticos");

app.listen(config.port, () => {
  console.log(`Conecta BU backend escuchando en http://localhost:${config.port}`);
  iniciarCierresAutomaticos();
  console.log(`Documentacion de salud: http://localhost:${config.port}/api/v1/health`);
  const superadmin = correoSuperadmin();
  if (superadmin) console.log(`Superadministrador (SUPERADMIN_EMAIL): ${superadmin}`);
  else console.warn("Aviso: SUPERADMIN_EMAIL no esta definido en backend/.env; nadie entrara como superadministrador por el .env.");
});
