const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const imagenes = require("./ImagenService");
const u = require("../utils");

// Comunicados del area de Deportes (RF-011): a todos los inscritos, a una
// disciplina o a un grupo. El estudiante los ve ordenados por prioridad.
const ORDEN_PRIORIDAD = { Urgente: 0, Importante: 1, Informativa: 2 };

class AlertaService {
  // grupoIds: solo los comunicados de esos grupos (panel del docente).
  async listar({ grupoIds } = {}) {
    let lista = await repos.alertas.listar({}, { fecha: "desc" });
    if (grupoIds) lista = lista.filter((a) => a.alcance === "Grupo" && grupoIds.includes(a.grupoId));
    const conDestino = await this.serializar(lista.slice(0, 100));
    return Promise.all(conDestino.map(async (a) => ({ ...a, alcanzados: await this.destinatarios(a) })));
  }

  async crear(cuerpo, autor) {
    const alerta = await repos.alertas.crear(await this.datos(cuerpo, autor));
    const [conDestino] = await this.serializar([alerta]);
    return { ...conDestino, alcanzados: await this.destinatarios(alerta) };
  }

  async eliminar(id) {
    const alerta = await repos.alertas.buscarPorId(id);
    if (!alerta) throw new AppError(404, "El comunicado no existe.");
    await repos.alertas.eliminar(id);
    if (alerta.imagen) await imagenes.borrar("alertas", alerta.imagen);
    return { eliminado: id };
  }

  // Lo que le llega al estudiante: a todos, a sus disciplinas y a sus grupos
  // del periodo. Vigentes y de los ultimos 60 dias.
  async paraEstudiante(usuarioId) {
    const hoy = hoyBogota();
    const [alertas, activas, grupos] = await Promise.all([
      repos.alertas.listar({ fecha: { gte: new Date(Date.now() - 60 * 864e5) } }, { fecha: "desc" }),
      repos.inscripciones.activasDeUsuario(usuarioId),
      repos.grupos.listar({ periodo: u.periodoActual() }),
    ]);
    const misGrupos = grupos.filter((g) => activas.some((i) => i.grupoId === g.id));
    const misDisciplinas = new Set(misGrupos.map((g) => g.disciplinaId));
    const leLlega = (a) =>
      a.alcance === "Todos" || (a.alcance === "Disciplina" && misDisciplinas.has(a.disciplinaId)) || (a.alcance === "Grupo" && misGrupos.some((g) => g.id === a.grupoId));
    const propias = alertas.filter((a) => (!a.vigenteHasta || new Date(a.vigenteHasta) >= hoy) && leLlega(a));
    return (await this.serializar(propias))
      .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] || new Date(b.fecha) - new Date(a.fecha))
      .map(({ autorEmail, ...a }) => a);
  }

  // Cuantos estudiantes reciben el comunicado.
  async destinatarios(alerta) {
    const grupos = await repos.grupos.listar({ periodo: u.periodoActual() });
    const ids =
      alerta.alcance === "Grupo" ? [alerta.grupoId] : alerta.alcance === "Disciplina" ? grupos.filter((g) => g.disciplinaId === alerta.disciplinaId).map((g) => g.id) : grupos.map((g) => g.id);
    if (!ids.length) return 0;
    return new Set((await repos.inscripciones.activasDeGrupos(ids)).map((i) => i.usuarioId)).size;
  }

  async serializar(lista) {
    const [disciplinas, grupos] = await Promise.all([repos.disciplinas.listar(), repos.grupos.listar()]);
    const destino = (a) =>
      a.alcance === "Grupo" ? grupos.find((g) => g.id === a.grupoId)?.nombre : a.alcance === "Disciplina" ? disciplinas.find((d) => d.id === a.disciplinaId)?.nombre : "Todos los inscritos";
    return lista.map((a) => ({ ...imagenes.conImagen("alertas", a), vigenteHasta: u.fechaISO(a.vigenteHasta), destino: destino(a) }));
  }

  async datos(cuerpo = {}, autor) {
    const data = { titulo: u.texto(cuerpo.titulo, 120), mensaje: String(cuerpo.mensaje ?? "").trim().slice(0, 2000) };
    if (!data.titulo) throw new AppError(400, "Escribe el título del comunicado.");
    if (!data.mensaje) throw new AppError(400, "Escribe el mensaje del comunicado.");
    data.prioridad = cuerpo.prioridad || "Informativa";
    if (!u.PRIORIDADES.includes(data.prioridad)) throw new AppError(400, "La prioridad debe ser Informativa, Importante o Urgente.");
    data.alcance = cuerpo.alcance || "Todos";
    if (!u.ALCANCES.includes(data.alcance)) throw new AppError(400, "El comunicado va a Todos, a una Disciplina o a un Grupo.");
    if (data.alcance === "Disciplina") {
      if (!cuerpo.disciplinaId || !(await repos.disciplinas.buscarPorId(cuerpo.disciplinaId))) throw new AppError(400, "Elige la disciplina.");
      data.disciplinaId = cuerpo.disciplinaId;
    }
    if (data.alcance === "Grupo") {
      if (!cuerpo.grupoId || !(await repos.grupos.buscarPorId(cuerpo.grupoId))) throw new AppError(400, "Elige el grupo.");
      data.grupoId = cuerpo.grupoId;
    }
    if (cuerpo.vigenteHasta) {
      data.vigenteHasta = aFechaUTC(String(cuerpo.vigenteHasta).slice(0, 10), "fecha de vigencia");
      if (data.vigenteHasta < hoyBogota()) throw new AppError(400, "La vigencia no puede ser una fecha pasada.");
    }
    data.autor = autor?.nombre || null;
    data.autorEmail = autor?.emailInstitucional || null;
    return data;
  }
}

module.exports = new AlertaService();
