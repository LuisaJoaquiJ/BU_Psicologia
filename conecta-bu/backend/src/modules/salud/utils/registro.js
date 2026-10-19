const { AppError } = require("../../../common/utils/AppError");
const { aFechaUTC } = require("../../../common/utils/fechas");
const { POBLACIONES, TIPOS_DOCUMENTO, CATEGORIAS, EXAMENES_LABORALES, normalizarPrograma, periodoDeFecha, rangoDePeriodo } = require("./catalogos");
const { limpiarIdentificador, textoOpcional, nombrePropio, fechaISO, enteroOpcional, textoLargo, numeroEnRango, textoCorto } = require("./texto");

// Validacion de personas, actividades y datos clinicos de las atenciones.

function validarPersona(datos, { parcial = false } = {}) {
  const limpio = {};
  if (!parcial || datos.numeroDocumento !== undefined) {
    limpio.numeroDocumento = limpiarIdentificador(datos.numeroDocumento);
    if (limpio.numeroDocumento.length < 4) throw new AppError(400, "Escribe un número de documento válido.");
  }
  if (datos.codigoEstudiantil !== undefined) limpio.codigoEstudiantil = limpiarIdentificador(datos.codigoEstudiantil) || null;
  if (!parcial || datos.tipoDocumento !== undefined) {
    limpio.tipoDocumento = datos.tipoDocumento || "CC";
    if (!TIPOS_DOCUMENTO[limpio.tipoDocumento]) throw new AppError(400, "El tipo de documento no es válido.");
  }
  for (const campo of ["nombres", "apellidos"]) {
    if (!parcial || datos[campo] !== undefined) {
      limpio[campo] = nombrePropio(datos[campo]).slice(0, 120);
      if (!limpio[campo]) throw new AppError(400, `Faltan los ${campo} de la persona.`);
    }
  }
  if (!parcial || datos.poblacion !== undefined) {
    limpio.poblacion = datos.poblacion || "Estudiante";
    if (!POBLACIONES.includes(limpio.poblacion)) throw new AppError(400, "La población indicada no es válida.");
  }
  if (datos.programa !== undefined) limpio.programa = datos.programa ? normalizarPrograma(datos.programa) || textoOpcional(datos.programa, 150) : null;
  const telefono = textoOpcional(datos.telefono, 30);
  if (telefono !== undefined) limpio.telefono = telefono ? telefono.replace(/\.0+$/, "") : null;
  const correo = textoOpcional(datos.correo, 120);
  if (correo !== undefined) {
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new AppError(400, "El correo no es válido.");
    limpio.correo = correo ? correo.toLowerCase() : null;
  }
  if (datos.consentimientoDatos !== undefined) {
    limpio.consentimientoDatos = datos.consentimientoDatos === true;
    if (limpio.consentimientoDatos) limpio.fechaConsentimiento = new Date();
  }
  return limpio;
}

function validarPeriodo(periodo) {
  if (!rangoDePeriodo(periodo)) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return periodo;
}

function validarActividad(datos, { parcial = false } = {}) {
  const limpio = {};
  if (!parcial || datos.nombre !== undefined) {
    limpio.nombre = String(datos.nombre || "").trim().replace(/\s+/g, " ").slice(0, 200);
    if (!limpio.nombre) throw new AppError(400, "La actividad necesita un nombre.");
  }
  if (!parcial || datos.categoria !== undefined) {
    limpio.categoria = datos.categoria || "PromocionPrevencion";
    if (!CATEGORIAS[limpio.categoria]) throw new AppError(400, "La categoría no es válida.");
  }
  if (datos.periodo !== undefined || !parcial) limpio.periodo = validarPeriodo(datos.periodo || periodoDeFecha(new Date()));
  if (datos.fechaInicio !== undefined) limpio.fechaInicio = aFechaUTC(datos.fechaInicio, "fecha de inicio");
  if (datos.fechaFin !== undefined) limpio.fechaFin = aFechaUTC(datos.fechaFin, "fecha final");
  if (datos.tipoSnies !== undefined) limpio.tipoSnies = enteroOpcional(datos.tipoSnies, "tipo SNIES", { min: 1, max: 99 }) ?? 1;
  for (const campo of ["permanente", "clinica", "activa"]) if (datos[campo] !== undefined) limpio[campo] = datos[campo] === true;
  const numeros = [["meta", "meta", { max: 10000 }], ["presupuesto", "presupuesto", {}], ["horasDedicacion", "horas de dedicación", { max: 5000 }]];
  for (const [campo, nombre, rango] of numeros) {
    const n = enteroOpcional(datos[campo], nombre, rango);
    if (n !== undefined) limpio[campo] = n;
  }
  if (datos.responsableDocumento !== undefined) {
    limpio.responsableDocumento = String(datos.responsableDocumento || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 30) || null;
  }
  for (const campo of ["avances", "dificultades", "aprendizajes", "pendientes", "observaciones"]) {
    const t = textoLargo(datos[campo]);
    if (t !== undefined) limpio[campo] = t;
  }
  return limpio;
}

// Indicadores de una actividad: asistentes, personas distintas, jornadas
// (fechas distintas) y cumplimiento de la meta (un servicio permanente
// cumple si se presto).
function indicadores(actividad, atenciones, evidencias = 0) {
  const fechas = new Set(atenciones.map((a) => fechaISO(a.fecha)));
  const jornadas = actividad.permanente ? (atenciones.length ? 1 : 0) : fechas.size;
  const meta = actividad.meta || null;
  return {
    asistentes: atenciones.length,
    personas: new Set(atenciones.map((a) => a.personaId)).size,
    jornadas,
    meta,
    cumplimiento: meta ? Math.round((jornadas / meta) * 1000) / 10 : null,
    ultimaFecha: atenciones.length ? [...fechas].sort().pop() : null,
    evidencias,
  };
}

// Datos clinicos de la atencion de enfermeria (todos opcionales).
function datosClinicos(datos) {
  const tension = textoCorto(datos.tensionArterial, 15);
  if (tension && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(tension)) throw new AppError(400, "La tensión arterial debe escribirse como 120/80.");
  if (datos.examenLaboral && !EXAMENES_LABORALES[datos.examenLaboral]) throw new AppError(400, "El tipo de examen de medicina laboral no es válido.");
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

module.exports = { validarPersona, validarPeriodo, validarActividad, indicadores, datosClinicos };
