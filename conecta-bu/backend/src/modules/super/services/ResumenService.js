const { LecturaRepository } = require("../repositories/LecturaRepository");
const { MODULOS } = require("../../../common/utils/modulos");

// Vista general de Conecta BU para el inicio del superadministrador.
class ResumenService {
  constructor(repo = new LecturaRepository()) {
    this.repo = repo;
  }

  async resumen() {
    const d = await this.repo.resumen();
    const porRol = {};
    for (const u of d.usuarios) porRol[u.rol?.nombre] = (porRol[u.rol?.nombre] || 0) + 1;
    const citasDe = (m) => d.citas.filter((c) => c.modulo === m).length;
    const personal = (m) => d.accesos.filter((a) => a.modulo === m).length;
    return {
      informesPorRevisar: d.informesPorRevisar,
      usuarios: { total: d.usuarios.length, porRol },
      modulos: [
        {
          id: "desarrollo-humano",
          nombre: MODULOS["desarrollo-humano"],
          personal: personal("desarrollo-humano"),
          indicadores: [
            { nombre: "Citas", valor: citasDe("desarrollo-humano") },
            { nombre: "Eventos publicados", valor: d.eventos.length },
          ],
        },
        {
          id: "salud",
          nombre: MODULOS.salud,
          personal: personal("salud"),
          indicadores: [
            { nombre: "Citas", valor: citasDe("salud") },
            { nombre: "Atenciones registradas", valor: d.atenciones },
            { nombre: "Personas", valor: d.personas },
          ],
        },
        {
          id: "deporte",
          nombre: MODULOS.deporte,
          personal: personal("deporte"),
          indicadores: [
            { nombre: "Estudiantes inscritos", valor: new Set(d.inscripcionesDeporte.map((i) => i.usuarioId)).size },
            { nombre: "Sesiones registradas", valor: d.sesionesDeporte },
          ],
        },
      ],
    };
  }
}

module.exports = { ResumenService, resumenService: new ResumenService() };
