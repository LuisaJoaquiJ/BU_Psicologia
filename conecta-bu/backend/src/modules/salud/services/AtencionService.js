const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../common/utils/fechas");
const repos = require("../repositories");
const { rangoDePeriodo } = require("../utils/catalogos");
const { limpiarIdentificador, fechaISO } = require("../utils/texto");
const { datosClinicos } = require("../utils/registro");
const { personaService } = require("./PersonaService");
const { actividadService } = require("./ActividadService");

// Registro de atenciones y asistencias (reemplaza el formulario de
// enfermeria y el registro general): con el documento o el codigo
// estudiantil se registra a la persona en una actividad.
class AtencionService {
  constructor(r = repos, personas = personaService, actividades = actividadService) {
    this.repos = r;
    this.personas = personas;
    this.actividades = actividades;
  }

  async actividadActiva(id) {
    const actividad = await this.actividades.obtenerOFallar(id);
    if (!actividad.activa) throw new AppError(409, "Esta actividad está inactiva.");
    return actividad;
  }

  // La fecha debe caer en el periodo de la actividad y no ser futura.
  fechaValida(actividad, fechaTexto) {
    const fecha = fechaTexto ? aFechaUTC(fechaTexto) : hoyBogota();
    const rango = rangoDePeriodo(actividad.periodo);
    if (rango && (fecha < rango.desde || fecha > rango.hasta)) throw new AppError(400, `La fecha no corresponde al periodo ${actividad.periodo} de la actividad.`);
    if (fecha > new Date(hoyBogota().getTime() + 24 * 60 * 60 * 1000)) throw new AppError(400, "No se pueden registrar atenciones con fecha futura.");
    return fecha;
  }

  // En jornadas puntuales ajusta el rango de fechas de la actividad (se usa
  // en el reporte SNIES).
  async ajustarRango(actividad, fecha) {
    if (actividad.permanente) return;
    const previas = await this.repos.atenciones.contar({ actividadId: actividad.id });
    const cambios = {};
    if (previas === 0) Object.assign(cambios, { fechaInicio: fecha, fechaFin: fecha });
    else {
      if (fecha < new Date(actividad.fechaInicio)) cambios.fechaInicio = fecha;
      if (fecha > new Date(actividad.fechaFin)) cambios.fechaFin = fecha;
    }
    if (Object.keys(cambios).length) await this.repos.actividades.actualizar(actividad.id, cambios);
  }

  yaRegistrada(personaId, actividadId, fecha) {
    return this.repos.atenciones.buscarUno({ personaId, actividadId, fecha });
  }

  async personaDe(datos) {
    if (datos.personaId) return this.personas.obtenerOFallar(datos.personaId);
    const persona = await this.personas.porIdentificador(datos.identificador);
    if (!persona) throw new AppError(404, "No encontramos a nadie con ese documento o código. Regístralo una sola vez para continuar.", "PERSONA_NO_ENCONTRADA");
    return persona;
  }

  // Ley 1581 de 2012: quien fue importado de los Excel sin autorizacion
  // debe autorizar el tratamiento de datos en su primera atencion.
  async conConsentimiento(persona, datos) {
    if (persona.consentimientoDatos) return persona;
    if (datos.consentimientoDatos !== true) {
      throw new AppError(409, `${persona.nombres} aún no ha autorizado el tratamiento de sus datos personales. Confírmalo para continuar.`, "SIN_CONSENTIMIENTO");
    }
    return this.repos.personas.actualizar(persona.id, { consentimientoDatos: true, fechaConsentimiento: new Date() });
  }

  async registrar(datos, usuarioId) {
    if (!datos.actividadId) throw new AppError(400, "Elige la actividad o el tipo de atención.");
    const actividad = await this.actividadActiva(datos.actividadId);
    const persona = await this.conConsentimiento(await this.personaDe(datos), datos);
    const fecha = this.fechaValida(actividad, datos.fecha);
    // En jornadas una persona cuenta una vez por dia; en enfermeria puede
    // volver el mismo dia (se pide confirmar).
    if ((await this.yaRegistrada(persona.id, actividad.id, fecha)) && !datos.permitirRepetida) {
      throw new AppError(409, `${persona.nombres} ya está registrado(a) en ${actividad.nombre} el ${fechaISO(fecha)}.`, "YA_REGISTRADA");
    }
    const clinicos = datosClinicos(datos);
    await this.ajustarRango(actividad, fecha);
    return this.repos.atenciones.crearCompleta({
      personaId: persona.id,
      actividadId: actividad.id,
      fecha,
      poblacion: persona.poblacion,
      programa: persona.programa,
      ...clinicos,
      remitido: clinicos.remitido || /remisi/i.test(actividad.nombre),
      registradoPorId: usuarioId || null,
    });
  }

  // Jornadas: una lista de documentos o codigos pegada o escaneada. Dice
  // cuales quedaron, cuales no existen y cuales ya estaban.
  async registrarLote({ actividadId, fecha: fechaTexto, identificadores }, usuarioId) {
    if (!actividadId) throw new AppError(400, "Elige la actividad.");
    const lista = (Array.isArray(identificadores) ? identificadores : String(identificadores || "").split(/[\s,;]+/)).map(limpiarIdentificador).filter(Boolean);
    const unicos = [...new Set(lista)];
    if (!unicos.length) throw new AppError(400, "Escribe al menos un documento o código.");
    if (unicos.length > 500) throw new AppError(400, "Registra máximo 500 personas por lote.");
    const actividad = await this.actividadActiva(actividadId);
    const fecha = this.fechaValida(actividad, fechaTexto);

    const resultado = { registrados: [], noEncontrados: [], yaRegistrados: [], sinConsentimiento: [] };
    for (const identificador of unicos) {
      const persona = await this.personas.porIdentificador(identificador);
      if (!persona) {
        resultado.noEncontrados.push(identificador);
        continue;
      }
      const fila = { identificador, nombre: `${persona.nombres} ${persona.apellidos}` };
      if (await this.yaRegistrada(persona.id, actividad.id, fecha)) {
        resultado.yaRegistrados.push(fila);
        continue;
      }
      if (!resultado.registrados.length) await this.ajustarRango(actividad, fecha);
      await this.repos.atenciones.crear({ personaId: persona.id, actividadId: actividad.id, fecha, poblacion: persona.poblacion, programa: persona.programa, registradoPorId: usuarioId || null });
      resultado.registrados.push(fila);
      if (!persona.consentimientoDatos) resultado.sinConsentimiento.push(fila);
    }
    return resultado;
  }

  listar({ desde, hasta, actividadId, personaId, limite = 100 } = {}) {
    const where = {};
    if (actividadId) where.actividadId = actividadId;
    if (personaId) where.personaId = personaId;
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = aFechaUTC(desde, "fecha desde");
      if (hasta) where.fecha.lte = aFechaUTC(hasta, "fecha hasta");
    }
    return this.repos.atenciones.buscar(where, Math.min(Number(limite) || 100, 500));
  }

  async obtenerOFallar(id) {
    const atencion = await this.repos.atenciones.buscarPorId(id);
    if (!atencion) throw new AppError(404, "La atención no existe.");
    return atencion;
  }

  async actualizar(id, datos) {
    const atencion = await this.obtenerOFallar(id);
    return this.repos.atenciones.actualizarCompleta(id, datosClinicos({ ...atencion, ...datos }));
  }

  // Corrige un registro hecho por error (persona o actividad equivocada).
  async eliminar(id) {
    await this.obtenerOFallar(id);
    await this.repos.atenciones.eliminar(id);
    return { eliminada: id };
  }
}

module.exports = { AtencionService, atencionService: new AtencionService() };
