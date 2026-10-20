const { BaseController } = require("./BaseController");
const { AppError } = require("../../../common/utils/AppError");
const catalogos = require("../utils/catalogos");
const { personaService } = require("../services/PersonaService");
const { actividadService } = require("../services/ActividadService");
const { atencionService } = require("../services/AtencionService");
const { evidenciaService } = require("../services/EvidenciaService");
const { importadorService } = require("../services/ImportadorService");
const { estudiantesActivosService } = require("../services/EstudiantesActivosService");
const { jornadaService } = require("../services/JornadaService");

// Registro de la Unidad de Salud: catalogos, personas, actividades,
// evidencias, atenciones e importacion de los Excel existentes.
class RegistroController extends BaseController {
  catalogos = async (req, res) =>
    this.ok(res, {
      programas: catalogos.PROGRAMAS,
      poblaciones: catalogos.POBLACIONES,
      tiposDocumento: catalogos.TIPOS_DOCUMENTO,
      categorias: catalogos.CATEGORIAS,
      examenesLaborales: catalogos.EXAMENES_LABORALES,
      periodos: await actividadService.periodos(),
      periodoActual: catalogos.periodoDeFecha(new Date(Date.now() - 5 * 3600 * 1000)),
    });

  // ---- Personas ----
  buscarPersonas = async (req, res) => this.ok(res, await personaService.buscar(req.query.q));
  personas = async (req, res) => this.ok(res, await personaService.listar(req.query));
  crearPersona = async (req, res) => this.creado(res, { persona: await personaService.crear(req.body) });
  persona = async (req, res) => this.ok(res, { persona: await personaService.obtener(req.params.id) });
  actualizarPersona = async (req, res) => this.ok(res, { persona: await personaService.actualizar(req.params.id, req.body) });

  // ---- Actividades ----
  actividades = async (req, res) => {
    const { periodo, categoria } = req.query;
    this.ok(res, { actividades: await actividadService.listar({ periodo, categoria, incluirInactivas: req.query.incluirInactivas === "true" }) });
  };
  crearActividad = async (req, res) => this.creado(res, { actividad: await actividadService.crear(req.body) });
  copiarPeriodo = async (req, res) => this.creado(res, await actividadService.copiarCatalogo(req.body.origen, req.body.destino));
  actividad = async (req, res) => this.ok(res, { actividad: await actividadService.obtener(req.params.id) });
  actualizarActividad = async (req, res) => this.ok(res, { actividad: await actividadService.actualizar(req.params.id, req.body) });

  // ---- Evidencias ----
  subirEvidencias = async (req, res) => this.creado(res, { evidencias: await evidenciaService.guardar(req.params.id, req.files, req.body, req.usuario.id) });
  eliminarEvidencia = async (req, res) => this.ok(res, await evidenciaService.eliminar(req.params.id));
  archivoEvidencia = async (req, res) => {
    const evidencia = await evidenciaService.obtenerOFallar(req.params.id);
    this.enviarArchivo(res, evidenciaService.rutaAbsoluta(evidencia), evidencia.nombreArchivo, { tipo: evidencia.tipoMime, cache: "private, max-age=3600" });
  };

  // ---- Atenciones ----
  registrarAtencion = async (req, res) => this.creado(res, { atencion: await atencionService.registrar(req.body, req.usuario.id) });
  registrarLote = async (req, res) => this.creado(res, await atencionService.registrarLote(req.body, req.usuario.id));
  atenciones = async (req, res) => this.ok(res, { atenciones: await atencionService.listar(req.query) });
  actualizarAtencion = async (req, res) => this.ok(res, { atencion: await atencionService.actualizar(req.params.id, req.body) });
  eliminarAtencion = async (req, res) => this.ok(res, await atencionService.eliminar(req.params.id));

  // ---- Inscritos de una jornada publicada y su asistencia ----
  inscritos = async (req, res) => this.ok(res, { inscritos: await jornadaService.inscritos(req.params.id) });
  asistencia = async (req, res) => this.ok(res, await jornadaService.marcarAsistencia(req.params.id, req.params.inscripcionId, req.body?.asistio === true, req.usuario));

  // ---- Estudiantes activos (lista del periodo en Excel) ----
  resumenActivos = async (req, res) => this.ok(res, await estudiantesActivosService.resumen());
  plantillaActivos = async (req, res) => this.archivo(res, await estudiantesActivosService.plantilla(), "plantilla-estudiantes-activos.xlsx", "xlsx");
  exportarActivos = async (req, res) => {
    const fecha = new Date().toISOString().slice(0, 10);
    this.archivo(res, await estudiantesActivosService.exportar(), `estudiantes-activos-${fecha}.xlsx`, "xlsx");
  };
  importarActivos = async (req, res) => {
    if (!req.file) throw new AppError(400, "Adjunta el archivo de Excel.");
    const resultado = await estudiantesActivosService.importar(req.file.buffer, { confirmar: req.query.confirmar === "true" });
    this.ok(res, resultado, resultado.confirmado ? 201 : 200);
  };

  // ---- Importar Excel ----
  importar = async (req, res) => {
    if (!req.file) throw new AppError(400, "Adjunta el archivo de Excel.");
    const resultado = await importadorService.importar(req.file.buffer, { confirmar: req.query.confirmar === "true" }, req.usuario.id);
    this.ok(res, resultado, resultado.confirmado ? 201 : 200);
  };
}

module.exports = { RegistroController, registroController: new RegistroController() };
