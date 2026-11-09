const { BaseController } = require("./BaseController");
const inscripciones = require("../services/InscripcionService");
const horas = require("../services/HorasService");
const estudiantes = require("../services/EstudianteService");
const eventos = require("../services/EventoEstudianteService");
const alertas = require("../services/AlertaService");
const { constanciaPdf } = require("../archivos");
const repos = require("../repositories");
const notificaciones = require("../../notificaciones/service");

// Lo que el estudiante hace (inscribirse, retirarse) le llega a la coordinacion y al docente del grupo.
async function avisarAccion(usuario, { grupoId, eventoId }, titulo, verbo, ruta) {
  try {
    const grupo = grupoId ? await repos.grupos.buscarPorId(grupoId) : null;
    const evento = eventoId ? await repos.eventos.buscarPorId(eventoId) : null;
    const objeto = grupo?.nombre || evento?.nombre || "un grupo";
    const datos = { modulo: "deporte", tipo: "inscripcion", titulo, mensaje: `${usuario.nombre} ${verbo} ${objeto}.`, ruta };
    await notificaciones.avisarAlPersonal("deporte", datos);
    const docente = grupo?.docenteId ? await repos.docentes.buscarPorId(grupo.docenteId) : null;
    if (docente?.email) await notificaciones.crearPorCorreo(docente.email, { ...datos, ruta: "/deporte-docente" });
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar la accion en Deporte: ${err.message}`);
  }
}

// Area del estudiante: oferta, inscripciones, sus horas, eventos y avisos.
class MiDeporteController extends BaseController {
  oferta = async (req, res) => this.ok(res, await inscripciones.oferta(req.usuario));

  inscribir = async (req, res) => {
    await inscripciones.inscribir(req.params.id, req.usuario.id);
    await avisarAccion(req.usuario, { grupoId: req.params.id }, "Nueva inscripción", "se inscribió en", "/deporte/grupos");
    this.creado(res, await inscripciones.oferta(req.usuario));
  };

  retirar = async (req, res) => {
    await inscripciones.retirar(req.params.id, req.usuario.id);
    await avisarAccion(req.usuario, { grupoId: req.params.id }, "Una inscripción se retiró", "se retiró de", "/deporte/grupos");
    this.ok(res, await inscripciones.oferta(req.usuario));
  };

  misHoras = async (req, res) => this.ok(res, { ...(await horas.progresoDe(req.usuario.id)), grupos: await inscripciones.misGrupos(req.usuario.id) });

  constancia = async (req, res) => this.archivo(res, await constanciaPdf(await estudiantes.detalle(req.usuario.id)), "constancia-horas-deporte.pdf", "pdf");

  eventos = async (req, res) => this.ok(res, { eventos: await eventos.listar(req.usuario) });

  inscribirEvento = async (req, res) => {
    await eventos.inscribir(req.params.id, req.usuario);
    await avisarAccion(req.usuario, { eventoId: req.params.id }, "Nueva inscripción a un evento", "se inscribió en", "/deporte/eventos");
    this.creado(res, { eventos: await eventos.listar(req.usuario) });
  };

  cancelarEvento = async (req, res) => {
    await eventos.cancelar(req.params.id, req.usuario.id);
    await avisarAccion(req.usuario, { eventoId: req.params.id }, "Una inscripción a un evento se canceló", "canceló su inscripción en", "/deporte/eventos");
    this.ok(res, { eventos: await eventos.listar(req.usuario) });
  };

  avisos = async (req, res) => this.ok(res, { avisos: await alertas.paraEstudiante(req.usuario.id) });
}

module.exports = new MiDeporteController();
