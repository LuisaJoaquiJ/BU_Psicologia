const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const docentes = require("./DocenteService");
const grupos = require("./GrupoService");
const u = require("../utils");

// Sesiones (clases dictadas) y su asistencia. Cada presente suma las horas de
// la sesion. Solo se registra o corrige mientras dura la clase.
class SesionService {
  async obtener(id) {
    const sesion = await repos.sesiones.buscarPorId(id);
    if (!sesion) throw new AppError(404, "La sesión no existe.");
    return sesion;
  }

  async registrar(grupoId, cuerpo, usuario) {
    const grupo = await grupos.obtenerOFallar(grupoId);
    const data = this.datos(cuerpo);
    if (await repos.sesiones.buscarUno({ grupoId, fecha: data.fecha, inicio: data.inicio })) {
      throw new AppError(409, "Ya se registró la asistencia de esa sesión. Ábrela para corregirla.", "SESION_REPETIDA");
    }
    const sesion = await repos.sesiones.crear({ ...data, grupoId: grupo.id, registradaPor: usuario.emailInstitucional });
    try {
      await this.guardarAsistencias(sesion.id, grupoId, cuerpo.presentes || []);
    } catch (err) {
      await repos.sesiones.eliminar(sesion.id);
      throw err;
    }
    return grupos.detalle(grupoId);
  }

  async actualizar(id, cuerpo) {
    const sesion = await this.obtener(id);
    docentes.exigirVentanaEdicion(sesion);
    const data = {};
    if (cuerpo.tema !== undefined) data.tema = u.texto(cuerpo.tema, 200);
    if (cuerpo.inicio !== undefined || cuerpo.fin !== undefined) {
      data.inicio = u.hora(cuerpo.inicio ?? sesion.inicio, "La hora de inicio");
      data.fin = u.hora(cuerpo.fin ?? sesion.fin, "La hora final");
      data.horas = u.horasEntre(data.inicio, data.fin);
    }
    if (Object.keys(data).length) await repos.sesiones.actualizar(id, data);
    if (cuerpo.presentes !== undefined) await this.guardarAsistencias(id, sesion.grupoId, cuerpo.presentes);
    return grupos.detalle(sesion.grupoId);
  }

  async eliminar(id) {
    const sesion = await this.obtener(id);
    await repos.asistencias.eliminarDeSesion(id);
    await repos.sesiones.eliminar(id);
    return grupos.detalle(sesion.grupoId);
  }

  // Marca presente o ausente a cada inscrito activo del grupo.
  async guardarAsistencias(sesionId, grupoId, presentes) {
    if (!Array.isArray(presentes)) throw new AppError(400, "Envía la lista de estudiantes presentes.");
    const ids = new Set((await repos.inscripciones.activasDeGrupos([grupoId])).map((i) => i.usuarioId));
    if (presentes.some((id) => !ids.has(id))) throw new AppError(400, "Hay estudiantes en la lista que no están inscritos en el grupo.");
    const existentes = await repos.asistencias.listar({ sesionId });
    for (const usuarioId of ids) {
      const presente = presentes.includes(usuarioId);
      const fila = existentes.find((a) => a.usuarioId === usuarioId);
      if (!fila) await repos.asistencias.crear({ sesionId, usuarioId, presente });
      else if (fila.presente !== presente) await repos.asistencias.actualizar(fila.id, { presente });
    }
  }

  // Fecha, horas y tema; solo durante la clase (de la hora de inicio a la final).
  datos(cuerpo = {}) {
    const fecha = aFechaUTC(String(cuerpo.fecha || "").slice(0, 10), "fecha de la sesión");
    if (fecha > hoyBogota()) throw new AppError(400, "No se puede registrar asistencia de una fecha futura.");
    const inicio = u.hora(cuerpo.inicio, "La hora de inicio");
    const fin = u.hora(cuerpo.fin, "La hora final");
    const horas = u.horasEntre(inicio, fin);
    u.exigirQueEmpiece(fecha, inicio);
    u.exigirQueNoTermine(fecha, fin);
    return { fecha, inicio, fin, horas, tema: u.texto(cuerpo.tema, 200) };
  }
}

module.exports = new SesionService();
