const { BaseController } = require("./BaseController");
const resumen = require("../services/ResumenService");
const tablero = require("../services/TableroService");
const configuracion = require("../services/ConfigService");
const disciplinas = require("../services/DisciplinaService");
const docentes = require("../services/DocenteService");
const u = require("../utils");

// Inicio, tablero, catalogos, requisito de horas y disciplinas.
class CoordinacionController extends BaseController {
  resumen = async (req, res) => this.ok(res, await resumen.resumen());

  tablero = async (req, res) => this.ok(res, await tablero.tablero({ periodo: req.query.periodo }));

  catalogos = async (req, res) =>
    this.ok(res, {
      dias: u.DIAS,
      tipos: u.TIPOS,
      categorias: u.CATEGORIAS,
      tiposEvento: u.TIPOS_EVENTO,
      prioridades: u.PRIORIDADES,
      periodoActual: u.periodoActual(),
      disciplinas: await disciplinas.listar({ incluirInactivas: true }),
      docentes: (await docentes.listar()).map(({ id, nombre, email, activo, especialidad }) => ({ id, nombre, email, activo, especialidad })),
      config: await configuracion.obtener(),
    });

  guardarConfig = async (req, res) => this.ok(res, { config: await configuracion.guardar(req.body) });

  crearDisciplina = async (req, res) => this.creado(res, { disciplina: await disciplinas.crear(req.body) });

  actualizarDisciplina = async (req, res) => this.ok(res, { disciplina: await disciplinas.actualizar(req.params.id, req.body) });
}

module.exports = new CoordinacionController();
