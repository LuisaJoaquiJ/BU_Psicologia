const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const { EXAMENES_LABORALES, rangoDePeriodo } = require("./catalogos");
const { buscarPorIdentificador, obtenerPersonaOFallar, limpiarIdentificador } = require("./personas.service");
const { obtenerActividadOFallar, fechaISO } = require("./actividades.service");

// Registro de atenciones y asistencias (reemplaza el formulario de
// enfermeria y el registro general): con el documento o el codigo
// estudiantil se registra a la persona en una actividad.

const INCLUDE_ATENCION = {
  persona: true,
  actividad: true,
  registradoPor: { select: { nombre: true } },
};

function numeroEnRango(valor, campo, min, max, { decimal = false } = {}) {
  if (valor === undefined || valor === null || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max || (!decimal && !Number.isInteger(n))) {
    throw new AppError(400, `Revisa el valor de ${campo} (entre ${min} y ${max}).`);
  }
  return decimal ? Math.round(n * 10) / 10 : n;
}

function textoCorto(valor, max) {
  const t = String(valor ?? "").trim();
  if (!t || /^(na|n\/a|no aplica|ninguno|none)$/i.test(t)) return null;
  return t.slice(0, max);
}

// Datos clinicos de la atencion de enfermeria (todos opcionales).
function datosClinicos(datos) {
  const tension = textoCorto(datos.tensionArterial, 15);
  if (tension && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(tension)) {
    throw new AppError(400, "La tensión arterial debe escribirse como 120/80.");
  }
  if (datos.examenLaboral && !EXAMENES_LABORALES[datos.examenLaboral]) {
    throw new AppError(400, "El tipo de examen de medicina laboral no es válido.");
  }
  return {
    tensionArterial: tension ? tension.replace(/\s/g, "") : null,
    frecuenciaCardiaca: numeroEnRango(datos.frecuenciaCardiaca, "la frecuencia cardiaca", 20, 250),
    frecuenciaRespiratoria: numeroEnRango(datos.frecuenciaRespiratoria, "la frecuencia respiratoria", 4, 80),
    pesoKg: numeroEnRango(datos.pesoKg, "el peso (kg)", 2, 400, { decimal: true }),
    tallaCm: numeroEnRango(datos.tallaCm, "la talla (cm)", 30, 250),
    glucometria: textoCorto(datos.glucometria, 20),
    insumo: textoCorto(datos.insumo, 200),
    descripcion: textoCorto(datos.descripcion, 4000),
    examenLaboral: datos.examenLaboral || null,
    remitido: datos.remitido === true,
  };
}

// Valida la fecha frente al periodo de la actividad y, en jornadas puntuales,
// ajusta el rango de fechas de la actividad (se usa en el reporte SNIES).
async function prepararFecha(actividad, fechaTexto) {
  const fecha = fechaTexto ? aFechaUTC(fechaTexto) : hoyBogota();
  const rango = rangoDePeriodo(actividad.periodo);
  if (rango && (fecha < rango.desde || fecha > rango.hasta)) {
    throw new AppError(400, `La fecha no corresponde al periodo ${actividad.periodo} de la actividad.`);
  }
  if (fecha > new Date(hoyBogota().getTime() + 24 * 60 * 60 * 1000)) {
    throw new AppError(400, "No se pueden registrar atenciones con fecha futura.");
  }
  return fecha;
}

async function ajustarRangoActividad(actividad, fecha) {
  if (actividad.permanente) return;
  const previas = await prisma.atencionSalud.count({ where: { actividadId: actividad.id } });
  const inicio = new Date(actividad.fechaInicio);
  const fin = new Date(actividad.fechaFin);
  const cambios = {};
  if (previas === 0) {
    cambios.fechaInicio = fecha;
    cambios.fechaFin = fecha;
  } else {
    if (fecha < inicio) cambios.fechaInicio = fecha;
    if (fecha > fin) cambios.fechaFin = fecha;
  }
  if (Object.keys(cambios).length) await prisma.actividadSalud.update({ where: { id: actividad.id }, data: cambios });
}

async function yaRegistrada(personaId, actividadId, fecha) {
  return prisma.atencionSalud.findFirst({ where: { personaId, actividadId, fecha } });
}

async function registrarAtencion(datos, usuarioId) {
  if (!datos.actividadId) throw new AppError(400, "Elige la actividad o el tipo de atención.");
  const actividad = await obtenerActividadOFallar(datos.actividadId);
  if (!actividad.activa) throw new AppError(409, "Esta actividad está inactiva.");

  let persona;
  if (datos.personaId) {
    persona = await obtenerPersonaOFallar(datos.personaId);
  } else {
    persona = await buscarPorIdentificador(datos.identificador);
    if (!persona) {
      throw new AppError(
        404,
        "No encontramos a nadie con ese documento o código. Regístralo una sola vez para continuar.",
        "PERSONA_NO_ENCONTRADA"
      );
    }
  }

  // Ley 1581 de 2012: quien fue importado de los Excel sin autorizacion
  // debe autorizar el tratamiento de datos en su primera atencion.
  if (!persona.consentimientoDatos) {
    if (datos.consentimientoDatos !== true) {
      throw new AppError(
        409,
        `${persona.nombres} aún no ha autorizado el tratamiento de sus datos personales. Confírmalo para continuar.`,
        "SIN_CONSENTIMIENTO"
      );
    }
    persona = await prisma.personaSalud.update({
      where: { id: persona.id },
      data: { consentimientoDatos: true, fechaConsentimiento: new Date() },
    });
  }

  const fecha = await prepararFecha(actividad, datos.fecha);
  // En jornadas y talleres una persona cuenta una vez por dia; en atencion
  // de enfermeria puede volver el mismo dia (se pide confirmar).
  const previa = await yaRegistrada(persona.id, actividad.id, fecha);
  if (previa && !datos.permitirRepetida) {
    throw new AppError(
      409,
      `${persona.nombres} ya está registrado(a) en ${actividad.nombre} el ${fechaISO(fecha)}.`,
      "YA_REGISTRADA"
    );
  }

  const clinicos = datosClinicos(datos);
  await ajustarRangoActividad(actividad, fecha);
  return prisma.atencionSalud.create({
    data: {
      personaId: persona.id,
      actividadId: actividad.id,
      fecha,
      poblacion: persona.poblacion,
      programa: persona.programa,
      ...clinicos,
      remitido: clinicos.remitido || /remisi/i.test(actividad.nombre),
      registradoPorId: usuarioId || null,
    },
    include: INCLUDE_ATENCION,
  });
}

// Registro en lote para jornadas: una lista de documentos/codigos pegada o
// escaneada. Devuelve cuales quedaron, cuales no existen y cuales ya estaban.
async function registrarLote({ actividadId, fecha: fechaTexto, identificadores }, usuarioId) {
  if (!actividadId) throw new AppError(400, "Elige la actividad.");
  const lista = (Array.isArray(identificadores) ? identificadores : String(identificadores || "").split(/[\s,;]+/))
    .map(limpiarIdentificador)
    .filter(Boolean);
  const unicos = [...new Set(lista)];
  if (!unicos.length) throw new AppError(400, "Escribe al menos un documento o código.");
  if (unicos.length > 500) throw new AppError(400, "Registra máximo 500 personas por lote.");

  const actividad = await obtenerActividadOFallar(actividadId);
  if (!actividad.activa) throw new AppError(409, "Esta actividad está inactiva.");
  const fecha = await prepararFecha(actividad, fechaTexto);

  const resultado = { registrados: [], noEncontrados: [], yaRegistrados: [], sinConsentimiento: [] };
  for (const identificador of unicos) {
    const persona = await buscarPorIdentificador(identificador);
    if (!persona) {
      resultado.noEncontrados.push(identificador);
      continue;
    }
    if (await yaRegistrada(persona.id, actividad.id, fecha)) {
      resultado.yaRegistrados.push({ identificador, nombre: `${persona.nombres} ${persona.apellidos}` });
      continue;
    }
    if (!resultado.registrados.length) await ajustarRangoActividad(actividad, fecha);
    await prisma.atencionSalud.create({
      data: {
        personaId: persona.id,
        actividadId: actividad.id,
        fecha,
        poblacion: persona.poblacion,
        programa: persona.programa,
        registradoPorId: usuarioId || null,
      },
    });
    resultado.registrados.push({ identificador, nombre: `${persona.nombres} ${persona.apellidos}` });
    if (!persona.consentimientoDatos) resultado.sinConsentimiento.push({ identificador, nombre: `${persona.nombres} ${persona.apellidos}` });
  }
  return resultado;
}

async function listarAtenciones({ desde, hasta, actividadId, personaId, limite = 100 } = {}) {
  const where = {};
  if (actividadId) where.actividadId = actividadId;
  if (personaId) where.personaId = personaId;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = aFechaUTC(desde, "fecha desde");
    if (hasta) where.fecha.lte = aFechaUTC(hasta, "fecha hasta");
  }
  return prisma.atencionSalud.findMany({
    where,
    include: INCLUDE_ATENCION,
    orderBy: [{ fecha: "desc" }, { fechaRegistro: "desc" }],
    take: Math.min(Number(limite) || 100, 500),
  });
}

async function actualizarAtencion(id, datos) {
  const atencion = await prisma.atencionSalud.findUnique({ where: { id } });
  if (!atencion) throw new AppError(404, "La atención no existe.");
  const clinicos = datosClinicos({ ...atencion, ...datos });
  return prisma.atencionSalud.update({ where: { id }, data: clinicos, include: INCLUDE_ATENCION });
}

// Corrige un registro hecho por error (p. ej. persona o actividad equivocada).
async function eliminarAtencion(id) {
  const atencion = await prisma.atencionSalud.findUnique({ where: { id } });
  if (!atencion) throw new AppError(404, "La atención no existe.");
  await prisma.atencionSalud.delete({ where: { id } });
  return { eliminada: id };
}

module.exports = {
  registrarAtencion,
  registrarLote,
  listarAtenciones,
  actualizarAtencion,
  eliminarAtencion,
  datosClinicos,
};
