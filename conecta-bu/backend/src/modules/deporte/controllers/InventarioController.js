const { BaseController } = require("./BaseController");
const inventario = require("../services/InventarioService");
const prestamos = require("../services/PrestamoService");
const { inventarioExcel } = require("../archivos");

// Inventario de implementos y sus prestamos.
class InventarioController extends BaseController {
  listar = async (req, res) => this.ok(res, { ...(await inventario.listar()), prestamos: await prestamos.activos() });

  reporte = async (req, res) => this.archivo(res, await inventarioExcel(await prestamos.datosExcel()), "inventario-deporte.xlsx", "xlsx");

  crear = async (req, res) => this.creado(res, { implemento: await inventario.crear(req.body, req.usuario.emailInstitucional) });

  detalle = async (req, res) => this.ok(res, { implemento: await inventario.detalle(req.params.id) });

  actualizar = async (req, res) => this.ok(res, { implemento: await inventario.actualizar(req.params.id, req.body) });

  ajustar = async (req, res) => this.creado(res, { implemento: await inventario.ajustarExistencias(req.params.id, req.body, req.usuario.emailInstitucional) });

  prestar = async (req, res) => this.creado(res, { implemento: await prestamos.prestar(req.params.id, req.body, req.usuario.emailInstitucional) });

  devolver = async (req, res) => this.ok(res, { implemento: await prestamos.devolver(req.params.id, req.body, req.usuario.emailInstitucional) });
}

module.exports = new InventarioController();
