const { app } = require("./app");
const { config } = require("./config/env");
const { correoSuperadmin } = require("./common/utils/superadmin");
const { iniciarCierresAutomaticos } = require("./common/jobs/cierresAutomaticos");
const { asegurarOfertaCitas } = require("./modules/desarrollo-humano/utils/ofertaCitas");

app.listen(config.port, () => {
  console.log(`Conecta BU backend escuchando en http://localhost:${config.port}`);
  iniciarCierresAutomaticos();
  console.log(`Documentacion de salud: http://localhost:${config.port}/api/v1/health`);
  const superadmin = correoSuperadmin();
  if (superadmin) console.log(`Superadministrador (SUPERADMIN_EMAIL): ${superadmin}`);
  else console.warn("Aviso: SUPERADMIN_EMAIL no esta definido en backend/.env; nadie entrara como superadministrador por el .env.");
  asegurarOfertaCitas()
    .then((resultado) => {
      if (resultado.creados) {
        console.log(`Horario fijo de Desarrollo Humano: ${resultado.creados} horas abiertas (${resultado.servicio}).`);
      }
    })
    .catch((error) => console.error(`No se pudo abrir el horario fijo de citas: ${error.message}`));
});
