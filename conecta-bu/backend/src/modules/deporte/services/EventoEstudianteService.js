const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const eventos = require("./EventoService");
const u = require("../utils");

// Eventos deportivos desde el lado del estudiante (RF-018, RF-020).
class EventoEstudianteService {
  // Eventos visibles: los proximos y los pasados en los que estuvo inscrito.
  async listar(usuario) {
    const hoy = hoyBogota();
    const [todos, disciplinas, mias] = await Promise.all([
      repos.eventos.listar({ fecha: { gte: new Date(hoy.getTime() - 30 * 864e5) } }, { fecha: "asc" }),
      repos.disciplinas.listar(),
      repos.inscripcionesEvento.listar({ usuarioId: usuario.id }),
    ]);
    const visibles = todos.filter((e) => e.estado !== "Borrador");
    const inscritos = await eventos.inscritosPorEvento(visibles.map((e) => e.id));
    return visibles
      .map((e) => {
        const mia = mias.find((i) => i.eventoId === e.id);
        return {
          ...eventos.serializar(e, disciplinas, inscritos.get(e.id) || 0),
          inscrito: mia?.estado === "Activa",
          asistio: mia?.estado === "Activa" ? mia.asistio : null,
          restriccion: u.restriccionCategoria(e.categorias, usuario),
        };
      })
      .filter((e) => !e.yaPaso || e.inscrito);
  }

  async inscribir(eventoId, usuario) {
    const evento = await repos.eventos.buscarPorId(eventoId);
    if (!evento || evento.estado === "Borrador") throw new AppError(404, "El evento no existe.");
    if (evento.estado !== "Publicado") throw new AppError(409, `El evento está ${evento.estado.toLowerCase()}.`);
    if (new Date(evento.fechaLimite || evento.fecha) < hoyBogota()) throw new AppError(409, "Las inscripciones de este evento ya cerraron.", "INSCRIPCIONES_CERRADAS");
    const restriccion = u.restriccionCategoria(evento.categorias, usuario);
    if (restriccion) throw new AppError(409, `No puedes inscribirte: ${restriccion}`, "CATEGORIA_NO_PERMITIDA");
    const existente = await repos.inscripcionesEvento.buscarUno({ eventoId, usuarioId: usuario.id });
    if (existente?.estado === "Activa") throw new AppError(409, "Ya estás inscrito en este evento.", "YA_INSCRITO");
    if (evento.cupo) {
      const inscritos = (await eventos.inscritosPorEvento([eventoId])).get(eventoId) || 0;
      if (inscritos >= evento.cupo) throw new AppError(409, "El evento no tiene cupos disponibles.", "SIN_CUPO");
    }
    if (existente) await repos.inscripcionesEvento.actualizar(existente.id, { estado: "Activa", asistio: null, fechaInscripcion: new Date() });
    else await repos.inscripcionesEvento.crear({ eventoId, usuarioId: usuario.id });
  }

  async cancelar(eventoId, usuarioId) {
    const inscripcion = await repos.inscripcionesEvento.buscarUno({ eventoId, usuarioId, estado: "Activa" });
    if (!inscripcion) throw new AppError(404, "No estás inscrito en este evento.");
    const evento = await repos.eventos.buscarPorId(eventoId);
    if (evento && new Date(evento.fecha) < hoyBogota()) throw new AppError(409, "El evento ya pasó.");
    await repos.inscripcionesEvento.actualizar(inscripcion.id, { estado: "Cancelada" });
  }
}

module.exports = new EventoEstudianteService();
