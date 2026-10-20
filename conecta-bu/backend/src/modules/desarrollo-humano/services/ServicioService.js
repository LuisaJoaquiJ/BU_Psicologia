const repos = require("../repositories");

// RF-003 / HU-06: servicios publicados (activos) de Desarrollo Humano.
class ServicioService {
  constructor(r = repos) {
    this.repos = r;
  }

  activos() {
    return this.repos.servicios.activos();
  }
}

module.exports = { ServicioService, servicioService: new ServicioService() };
