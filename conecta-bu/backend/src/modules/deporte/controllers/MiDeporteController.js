const { BaseController } = require("./BaseController");
const inscripciones = require("../services/InscripcionService");
const horas = require("../services/HorasService");
const estudiantes = require("../services/EstudianteService");
const eventos = require("../services/EventoEstudianteService");
const alertas = require("../services/AlertaService");
const { constanciaPdf } = require("../archivos");

// Area del estudiante: oferta, inscripciones, sus horas, eventos y avisos.
class MiDeporteController extends BaseController {
  oferta = async (req, res) => this.ok(res, await inscripciones.oferta(req.usuario));

  inscribir = async (req, res) => {
    await inscripciones.inscribir(req.params.id, req.usuario.id);
    this.creado(res, await inscripciones.oferta(req.usuario));
  };

  retirar = async (req, res) => {
    await inscripciones.retirar(req.params.id, req.usuario.id);
    this.ok(res, await inscripciones.oferta(req.usuario));
  };

  misHoras = async (req, res) => this.ok(res, { ...(await horas.progresoDe(req.usuario.id)), grupos: await inscripciones.misGrupos(req.usuario.id) });

  constancia = async (req, res) => this.archivo(res, await constanciaPdf(await estudiantes.detalle(req.usuario.id)), "constancia-horas-deporte.pdf", "pdf");

  eventos = async (req, res) => this.ok(res, { eventos: await eventos.listar(req.usuario) });

  inscribirEvento = async (req, res) => {
    await eventos.inscribir(req.params.id, req.usuario);
    this.creado(res, { eventos: await eventos.listar(req.usuario) });
  };

  cancelarEvento = async (req, res) => {
    await eventos.cancelar(req.params.id, req.usuario.id);
    this.ok(res, { eventos: await eventos.listar(req.usuario) });
  };

  avisos = async (req, res) => this.ok(res, { avisos: await alertas.paraEstudiante(req.usuario.id) });
}

module.exports = new MiDeporteController();
