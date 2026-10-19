const { BaseController } = require("./BaseController");
const { resumenService } = require("../services/ResumenService");
const { estadisticaService } = require("../services/EstadisticaService");
const { accesoService } = require("../services/AccesoService");
const { usuarioService } = require("../services/UsuarioService");

// Panel del superadministrador: resumen, tablero, accesos y usuarios.
class SuperController extends BaseController {
  resumen = async (req, res) => this.ok(res, await resumenService.resumen());

  // Tablero con las cifras de todos los modulos (?periodo=semana|mes|trimestre|anio).
  estadisticas = async (req, res) => this.ok(res, await estadisticaService.tablero(req.query));

  accesos = async (req, res) => this.ok(res, await accesoService.listar());

  asignar = async (req, res) => this.creado(res, { acceso: await accesoService.asignar(req.body, req.usuario.emailInstitucional) });

  cambiarModulo = async (req, res) => this.ok(res, { acceso: await accesoService.cambiarModulo(req.params.id, req.body, req.usuario.emailInstitucional) });

  quitar = async (req, res) => this.ok(res, await accesoService.quitar(req.params.id));

  // RF-012
  usuarios = async (req, res) => {
    const { busqueda, rol, habilitado } = req.query;
    const [usuarios, roles] = await Promise.all([usuarioService.listar({ busqueda, rol, habilitado }), usuarioService.roles()]);
    this.ok(res, { usuarios, roles });
  };

  cambiarRol = async (req, res) => this.ok(res, { usuario: await usuarioService.cambiarRol(req.usuario.id, req.params.id, req.body.rol) });

  cambiarEstado = async (req, res) => this.ok(res, { usuario: await usuarioService.cambiarEstado(req.usuario.id, req.params.id, req.body.habilitado) });
}

module.exports = { SuperController, superController: new SuperController() };
