const { BaseController } = require("./BaseController");
const grupos = require("../services/GrupoService");
const inscripciones = require("../services/InscripcionService");
const sesiones = require("../services/SesionService");
const resumen = require("../services/ResumenService");
const { reporteExcel } = require("../archivos");

// Grupos, inscritos, sesiones de asistencia y reporte del periodo (coordinacion).
class GrupoController extends BaseController {
  listar = async (req, res) => this.ok(res, await grupos.listar(req.query));

  crear = async (req, res) => this.creado(res, { grupo: await grupos.crear(req.body) });

  detalle = async (req, res) => this.ok(res, { grupo: await grupos.detalle(req.params.id) });

  actualizar = async (req, res) => this.ok(res, { grupo: await grupos.actualizar(req.params.id, req.body) });

  inscribir = async (req, res) => this.creado(res, { grupo: await inscripciones.inscribirPorCorreo(req.params.id, req.body.email) });

  retirar = async (req, res) => {
    await inscripciones.retirar(req.params.id, req.params.usuarioId);
    this.ok(res, { grupo: await grupos.detalle(req.params.id) });
  };

  registrarSesion = async (req, res) => this.creado(res, { grupo: await sesiones.registrar(req.params.id, req.body, req.usuario) });

  actualizarSesion = async (req, res) => this.ok(res, { grupo: await sesiones.actualizar(req.params.id, req.body) });

  eliminarSesion = async (req, res) => this.ok(res, { grupo: await sesiones.eliminar(req.params.id) });

  reporte = async (req, res) => {
    const datos = await resumen.datosReporte(req.query);
    this.archivo(res, await reporteExcel(datos), `deporte-horas-${datos.periodo}.xlsx`, "xlsx");
  };
}

module.exports = new GrupoController();
