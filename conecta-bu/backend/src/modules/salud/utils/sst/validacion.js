const { AppError } = require("../../../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../../../common/utils/fechas");
const cat = require("./index");

// Validacion del formulario de los reportes SST y su presentacion.
const DIA_MS = 24 * 60 * 60 * 1000;

// ---- Validacion del formulario ---------------------------------------------
function texto(valor, max) {
  const limpio = String(valor ?? "").replace(/\s+/g, " ").trim();
  return limpio ? limpio.slice(0, max) : null;
}

function parrafo(valor, max = 4000) {
  const limpio = String(valor ?? "").trim();
  return limpio ? limpio.slice(0, max) : null;
}

function hora(valor, etiqueta) {
  const v = String(valor ?? "").trim();
  if (!v) return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
  if (!m) throw new AppError(400, `${etiqueta}: usa el formato HH:mm.`);
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function documento(valor) {
  const v = String(valor ?? "").replace(/[\s.]/g, "").trim();
  if (!v) return null;
  if (!/^[0-9A-Za-z-]{4,20}$/.test(v)) throw new AppError(400, "El número de documento no es válido.");
  return v;
}

function listaAcompanantes(valor) {
  if (!Array.isArray(valor)) return null;
  const lista = valor
    .map((p) => ({ nombre: texto(p?.nombre, 200), documento: texto(p?.documento, 30) }))
    .filter((p) => p.nombre || p.documento)
    .slice(0, 200);
  for (const p of lista) {
    if (!p.nombre || !p.documento) throw new AppError(400, "Cada persona de la lista necesita nombre y número de documento.");
    p.documento = documento(p.documento);
  }
  return lista.length ? lista : null;
}

const CONVERSORES = {
  texto: (v) => texto(v, 200),
  documento,
  placa: (v) => (texto(v, 15) || "").toUpperCase().replace(/\s/g, "") || null,
  parrafo: (v) => parrafo(v),
  fecha: (v, etiqueta) => (v ? aFechaUTC(String(v).slice(0, 10), etiqueta.toLowerCase()) : null),
  hora: (v, etiqueta) => hora(v, etiqueta),
  numero: (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 5000) throw new AppError(400, "El número de estudiantes no es válido.");
    return n;
  },
  lista: listaAcompanantes,
};

function validarCampo(def, valor) {
  let limpio = CONVERSORES[def.tipo === "opciones" ? "texto" : def.tipo](valor, def.label);
  if (def.tipo === "opciones" && limpio && !def.opciones.includes(limpio)) {
    throw new AppError(400, `${def.label}: la opción elegida no es válida.`);
  }
  if (def.obligatorio !== false && (limpio === null || limpio === undefined)) {
    throw new AppError(400, `Falta: ${def.label.toLowerCase()}.`, "CAMPO_REQUERIDO");
  }
  return limpio;
}

// Dias entre hoy (Colombia) y la fecha de salida.
function diasHasta(fecha) {
  return Math.round((fecha.getTime() - hoyBogota().getTime()) / DIA_MS);
}

function validarReporte(datos = {}, usuario) {
  const tipo = cat.TIPOS[datos.tipo] ? datos.tipo : null;
  if (!tipo) throw new AppError(400, "Elige el tipo de reporte.");
  const def = cat.TIPOS[tipo];

  if (datos.consentimientoDatos !== true) {
    throw new AppError(400, "Debes autorizar el tratamiento de tus datos personales (Ley 1581 de 2012).", "SIN_CONSENTIMIENTO");
  }

  const limpio = {
    tipo,
    correo: usuario.emailInstitucional.toLowerCase(),
    nombreReporta: texto(datos.nombreReporta, 200) || usuario.nombre,
    celular: texto(datos.celular, 30),
    area: texto(datos.area, 120),
    consentimientoDatos: true,
  };
  if (!limpio.celular || !/^[0-9+\s()-]{7,20}$/.test(limpio.celular)) {
    throw new AppError(400, "Escribe un número de celular (WhatsApp) válido.", "CAMPO_REQUERIDO");
  }
  if (!limpio.area || !cat.AREAS.includes(limpio.area)) throw new AppError(400, "Elige el área a la que perteneces.", "CAMPO_REQUERIDO");

  for (const campo of def.campos) limpio[campo.campo] = validarCampo(campo, datos[campo.campo]);

  if (cat.esSalida(tipo)) {
    const medio = datos.medioTransporte;
    if (!def.transportes.includes(medio)) throw new AppError(400, "Elige el medio de transporte.", "CAMPO_REQUERIDO");
    limpio.medioTransporte = medio;
    for (const campo of cat.CAMPOS_TRANSPORTE[medio]) limpio[campo.campo] = validarCampo(campo, datos[campo.campo]);

    if (limpio.fechaRegreso < limpio.fechaSalida) {
      throw new AppError(400, "La fecha de regreso no puede ser anterior a la de salida.");
    }
    if (diasHasta(limpio.fechaRegreso) > 730) throw new AppError(400, "Revisa las fechas: la salida está a más de dos años.");
    limpio.diasAnticipacion = diasHasta(limpio.fechaSalida);
    limpio.fueraDeTiempo = def.anticipacion ? limpio.diasAnticipacion < def.anticipacion : limpio.diasAnticipacion < 0;
  } else {
    if (limpio.fechaEvento > hoyBogota()) throw new AppError(400, "La fecha del evento no puede ser futura.");
    limpio.clasificacion = limpio.clasificacion || null;
  }
  return limpio;
}

function faltantes(tipo, medio, tiposAdjuntos) {
  const tengo = new Set(tiposAdjuntos);
  return cat.adjuntosRequeridos(tipo, medio).filter((t) => !tengo.has(t));
}

function validarTiposPermitidos(tipo, medio, archivos) {
  const permitidos = new Set([...cat.adjuntosRequeridos(tipo, medio), ...cat.adjuntosOpcionales(tipo)]);
  const sobrante = archivos.find((a) => !permitidos.has(a.fieldname));
  if (sobrante) throw new AppError(400, `"${cat.ADJUNTOS[sobrante.fieldname]}" no aplica para este reporte.`);
}

// ---- Presentacion ----------------------------------------------------------
function serializar(reporte) {
  if (!reporte) return null;
  const def = cat.TIPOS[reporte.tipo];
  const adjuntos = reporte.adjuntos || [];
  return {
    ...reporte,
    codigo: `SST-${String(reporte.consecutivo).padStart(4, "0")}`,
    tipoNombre: def?.nombre,
    grupo: def?.grupo,
    gestion: def?.gestion,
    anticipacionMinima: def?.anticipacion ?? null,
    adjuntosFaltantes: cat.esSalida(reporte.tipo) ? faltantes(reporte.tipo, reporte.medioTransporte, adjuntos.map((a) => a.tipo)) : [],
    adjuntos: adjuntos.map(({ ruta, ...a }) => a),
  };
}

module.exports = { DIA_MS, texto, parrafo, validarReporte, faltantes, validarTiposPermitidos, serializar };
