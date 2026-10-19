const { BaseController } = require("./BaseController");
const docentes = require("../services/DocenteService");
const grupos = require("../services/GrupoService");
const sesiones = require("../services/SesionService");
const alertas = require("../services/AlertaService");
const imagenes = require("../services/ImagenService");

// Panel del docente (RF-013 a RF-016, RN-004): solo sus grupos; toma y
// corrige la asistencia durante la clase y envia comunicados a sus grupos.
class DocentePanelController extends BaseController {
  inicio = async (req, res) => {
    const yo = await docentes.docenteDe(req.usuario);
    const { periodo, grupos: propios } = await grupos.listar({ docenteId: yo.id });
    this.ok(res, { docente: yo, periodo, grupos: propios });
  };

  grupo = async (req, res) => {
    await docentes.exigirGrupoPropio(req.usuario, req.params.id);
    this.ok(res, { grupo: await grupos.detalle(req.params.id) });
  };

  registrarSesion = async (req, res) => {
    await docentes.exigirGrupoPropio(req.usuario, req.params.id);
    this.creado(res, { grupo: await sesiones.registrar(req.params.id, req.body, req.usuario) });
  };

  actualizarSesion = async (req, res) => {
    const sesion = await sesiones.obtener(req.params.id);
    await docentes.exigirGrupoPropio(req.usuario, sesion.grupoId);
    this.ok(res, { grupo: await sesiones.actualizar(req.params.id, req.body) });
  };

  alertas = async (req, res) => {
    const yo = await docentes.docenteDe(req.usuario);
    const { grupos: propios } = await grupos.listar({ docenteId: yo.id });
    this.ok(res, { alertas: await alertas.listar({ grupoIds: propios.map((g) => g.id) }) });
  };

  crearAlerta = async (req, res) => {
    await docentes.exigirGrupoPropio(req.usuario, req.body.grupoId);
    this.creado(res, { alerta: await alertas.crear({ ...req.body, alcance: "Grupo" }, req.usuario) });
  };

  // Middleware: antes de recibir la foto, el comunicado debe ser de sus grupos.
  exigirAlertaPropia = (req, res, next) => docentes.exigirAlertaPropia(req.usuario, req.params.id).then(() => next(), next);

  subirFotoAlerta = async (req, res) => this.ok(res, await imagenes.guardarImagen("alertas", req.params.id, req.file));

  quitarFotoAlerta = async (req, res) => {
    await docentes.exigirAlertaPropia(req.usuario, req.params.id);
    this.ok(res, await imagenes.quitarImagen("alertas", req.params.id));
  };
}

module.exports = new DocentePanelController();
