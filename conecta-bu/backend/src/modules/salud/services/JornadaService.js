const { AppError } = require("../../../common/utils/AppError");
const { hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { CATEGORIAS, TIPOS_DOCUMENTO, PROGRAMAS, normalizarPrograma } = require("../utils/catalogos");
const { limpiarIdentificador, fechaISO, esConflictoUnico } = require("../utils/texto");
const { atencionService } = require("./AtencionService");

// Jornadas y campanas de Salud integral publicadas para los estudiantes: el
// estudiante se inscribe (o cancela) y el personal marca la asistencia, que
// queda registrada como atencion (su participacion).

const OCUPAN_CUPO = "Inscrita";

// "Luisa Jhulieth Joaqui Jimenez" -> nombres "Luisa Jhulieth", apellidos "Joaqui Jimenez".
function partirNombre(completo = "") {
  const partes = String(completo).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombres: partes[0] || "Estudiante", apellidos: "-" };
  const corte = partes.length >= 4 ? 2 : 1;
  return { nombres: partes.slice(0, corte).join(" "), apellidos: partes.slice(corte).join(" ") };
}

class JornadaService {
  constructor(r = repos, atenciones = atencionService) {
    this.repos = r;
    this.atenciones = atenciones;
  }

  publica(actividad, inscritos = 0) {
    return {
      id: actividad.id,
      nombre: actividad.nombre,
      categoria: CATEGORIAS[actividad.categoria] || null,
      descripcion: actividad.descripcion,
      lugar: actividad.lugar,
      fechaInicio: fechaISO(actividad.fechaInicio),
      fechaFin: fechaISO(actividad.fechaFin),
      horaInicio: actividad.horaInicio,
      horaFin: actividad.horaFin,
      cupos: actividad.cupos,
      inscritos,
      cuposDisponibles: actividad.cupos ? Math.max(0, actividad.cupos - inscritos) : null,
    };
  }

  abierta(actividad) {
    return actividad.publicada && actividad.activa && new Date(actividad.fechaFin) >= hoyBogota();
  }

  async conteos(ids) {
    const mapa = new Map();
    for (const i of await this.repos.inscripcionesActividad.activasDe(ids)) mapa.set(i.actividadId, (mapa.get(i.actividadId) || 0) + 1);
    return mapa;
  }

  // ---- Estudiante ----

  async paraEstudiante(usuario) {
    const actividades = await this.repos.actividades.publicadasDesde(hoyBogota());
    const conteos = await this.conteos(actividades.map((a) => a.id));
    const mias = await this.repos.inscripcionesActividad.deUsuario(usuario.id);
    const persona = await this.repos.personas.porCorreo(String(usuario.emailInstitucional || "").toLowerCase());
    return {
      jornadas: actividades.map((a) => {
        const mia = mias.find((m) => m.actividadId === a.id && m.estado === OCUPAN_CUPO);
        return { ...this.publica(a, conteos.get(a.id) || 0), inscrito: Boolean(mia), asistio: Boolean(mia?.asistio) };
      }),
      // Sin datos en Salud (o sin autorizacion) se piden al inscribirse.
      registrado: Boolean(persona?.consentimientoDatos),
      misDatos: persona ? { tipoDocumento: persona.tipoDocumento, documento: persona.numeroDocumento, programa: persona.programa } : null,
      tiposDocumento: TIPOS_DOCUMENTO,
      programas: PROGRAMAS.map((p) => p.nombre),
    };
  }

  async actividadAbierta(id) {
    const actividad = await this.repos.actividades.buscarPorId(id);
    if (!actividad || !actividad.publicada) throw new AppError(404, "La jornada no existe.");
    if (!this.abierta(actividad)) throw new AppError(409, "La inscripción a esta jornada ya cerró.");
    return actividad;
  }

  // Persona de Salud del estudiante: por su correo, o por el documento que
  // escribe (se le asocia el correo). Si no existe se registra con su nombre.
  async personaDe(usuario, datos) {
    const correo = String(usuario.emailInstitucional || "").toLowerCase();
    let persona = await this.repos.personas.porCorreo(correo);
    if (!persona) {
      const documento = limpiarIdentificador(datos.documento);
      if (documento.length < 5) throw new AppError(400, "Escribe tu número de documento.");
      persona = await this.repos.personas.porIdentificador(documento);
      if (persona?.correo && persona.correo !== correo) {
        throw new AppError(409, "Ese documento ya está registrado con otro correo. Acércate a la Unidad de Salud para corregirlo.");
      }
      const programa = datos.programa ? normalizarPrograma(datos.programa) || String(datos.programa).trim().slice(0, 150) : null;
      if (persona) persona = await this.repos.personas.actualizar(persona.id, { correo, ...(programa && !persona.programa ? { programa } : {}) });
      else {
        const tipo = TIPOS_DOCUMENTO[datos.tipoDocumento] ? datos.tipoDocumento : "CC";
        try {
          persona = await this.repos.personas.crear({ ...partirNombre(usuario.nombre), tipoDocumento: tipo, numeroDocumento: documento, correo, programa, poblacion: "Estudiante" });
        } catch (err) {
          if (esConflictoUnico(err)) throw new AppError(409, "Ese documento ya está registrado. Acércate a la Unidad de Salud.");
          throw err;
        }
      }
    }
    // Ley 1581 de 2012: sin autorizacion no se usan sus datos.
    if (!persona.consentimientoDatos) {
      if (datos.consentimiento !== true && datos.consentimiento !== "true") {
        throw new AppError(400, "Debes autorizar el tratamiento de tus datos personales para inscribirte.", "SIN_CONSENTIMIENTO");
      }
      persona = await this.repos.personas.actualizar(persona.id, { consentimientoDatos: true, fechaConsentimiento: new Date() });
    }
    return persona;
  }

  async inscribirse(actividadId, usuario, datos = {}) {
    const actividad = await this.actividadAbierta(actividadId);
    const previa = await this.repos.inscripcionesActividad.deUsuarioEn(actividadId, usuario.id);
    if (previa?.estado === OCUPAN_CUPO) throw new AppError(409, "Ya estás inscrito(a) en esta jornada.");
    if (actividad.cupos && ((await this.conteos([actividadId])).get(actividadId) || 0) >= actividad.cupos) {
      throw new AppError(409, "Ya no hay cupos en esta jornada.");
    }
    const persona = await this.personaDe(usuario, datos);
    const inscripcion = previa
      ? await this.repos.inscripcionesActividad.actualizar(previa.id, { estado: OCUPAN_CUPO, personaId: persona.id, fechaInscripcion: new Date() })
      : await this.repos.inscripcionesActividad.crear({ actividadId, usuarioId: usuario.id, personaId: persona.id });
    return { inscripcion };
  }

  async cancelar(actividadId, usuario) {
    const ins = await this.repos.inscripcionesActividad.deUsuarioEn(actividadId, usuario.id);
    if (!ins || ins.estado !== OCUPAN_CUPO) throw new AppError(404, "No estás inscrito(a) en esta jornada.");
    if (ins.asistio) throw new AppError(409, "Tu asistencia ya quedó registrada.");
    return { inscripcion: await this.repos.inscripcionesActividad.actualizar(ins.id, { estado: "Cancelada" }) };
  }

  // ---- Personal de Salud ----

  async inscritos(actividadId) {
    const lista = await this.repos.inscripcionesActividad.deActividad(actividadId);
    const personas = new Map((await this.repos.personas.porIds([...new Set(lista.map((i) => i.personaId))])).map((p) => [p.id, p]));
    return lista
      .filter((i) => i.estado === OCUPAN_CUPO)
      .map((i) => {
        const p = personas.get(i.personaId);
        return {
          id: i.id,
          asistio: i.asistio,
          fechaInscripcion: i.fechaInscripcion,
          persona: p ? { id: p.id, nombres: p.nombres, apellidos: p.apellidos, tipoDocumento: p.tipoDocumento, numeroDocumento: p.numeroDocumento, programa: p.programa, correo: p.correo } : null,
        };
      });
  }

  // Marca (o quita) la asistencia: crea o borra la atencion de esa persona.
  async marcarAsistencia(actividadId, inscripcionId, asistio, usuario) {
    const ins = await this.repos.inscripcionesActividad.buscarPorId(inscripcionId);
    if (!ins || ins.actividadId !== actividadId || ins.estado !== OCUPAN_CUPO) throw new AppError(404, "La inscripción no existe.");
    if (asistio === ins.asistio) return { asistio };
    if (asistio) {
      const actividad = await this.repos.actividades.buscarPorId(actividadId);
      const hoy = hoyBogota();
      const fecha = hoy < new Date(actividad.fechaInicio) ? null : hoy > new Date(actividad.fechaFin) ? fechaISO(actividad.fechaFin) : fechaISO(hoy);
      if (!fecha) throw new AppError(409, "La jornada aún no empieza: marca la asistencia el día de la jornada.");
      const previa = await this.atenciones.yaRegistrada(ins.personaId, actividadId, new Date(`${fecha}T00:00:00Z`));
      const atencion = previa || (await this.atenciones.registrar({ actividadId, personaId: ins.personaId, fecha }, usuario?.id));
      await this.repos.inscripcionesActividad.actualizar(ins.id, { asistio: true, atencionId: atencion.id });
    } else {
      if (ins.atencionId) await this.repos.atenciones.eliminar(ins.atencionId).catch(() => {});
      await this.repos.inscripcionesActividad.actualizar(ins.id, { asistio: false, atencionId: null });
    }
    return { asistio };
  }
}

module.exports = { JornadaService, jornadaService: new JornadaService(), partirNombre };
