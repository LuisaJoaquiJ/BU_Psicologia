const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const { modulosDeUsuario } = require("../../common/utils/modulos");
const cat = require("./sst.catalogos");

// Salidas institucionales y reportes SST. Cualquier persona de la Institucion
// reporta (con su cuenta institucional); el personal de Salud integral
// revisa los documentos, reporta a la ARL o gestiona ASIST CARD y cambia el
// estado. Reemplaza el formulario de Google "0 SALUD INTEGRAL".

const DIA_MS = 24 * 60 * 60 * 1000;

// ---- Archivos adjuntos -------------------------------------------------------
const TIPOS_ARCHIVO = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

function carpetaSst() {
  return path.join(config.saludUploadsDir, "sst");
}

const almacenamiento = multer.diskStorage({
  destination(req, file, cb) {
    const carpeta = path.join(carpetaSst(), new Date().toISOString().slice(0, 7));
    fs.mkdir(carpeta, { recursive: true }, (err) => cb(err, carpeta));
  },
  filename(req, file, cb) {
    cb(null, `${crypto.randomUUID()}${TIPOS_ARCHIVO[file.mimetype]}`);
  },
});

// multipart: "datos" (JSON con el formulario) y un archivo por documento,
// cuyo nombre de campo es el tipo de adjunto (Licencia, Soat, Poliza...).
const recibirArchivos = multer({
  storage: almacenamiento,
  limits: { fileSize: config.saludMaxEvidenciaMb * 1024 * 1024, files: 20 },
  fileFilter(req, file, cb) {
    if (!cat.ADJUNTOS[file.fieldname]) return cb(new AppError(400, `El documento "${file.fieldname}" no se reconoce.`));
    if (!TIPOS_ARCHIVO[file.mimetype]) return cb(new AppError(400, "Los documentos deben ser PDF o fotos (JPG, PNG, WEBP)."));
    cb(null, true);
  },
}).any();

function borrarArchivos(archivos = []) {
  for (const a of archivos) fs.promises.unlink(a.path).catch(() => {});
}

function rutaAbsoluta(adjunto) {
  const base = path.resolve(config.saludUploadsDir);
  const absoluta = path.resolve(base, adjunto.ruta);
  if (!absoluta.startsWith(base + path.sep)) throw new AppError(404, "Archivo no disponible.");
  return absoluta;
}

function datosAdjunto(archivo, usuarioId) {
  return {
    tipo: archivo.fieldname,
    nombreArchivo: String(archivo.originalname || "documento").slice(0, 255),
    ruta: path.relative(config.saludUploadsDir, archivo.path).split(path.sep).join("/"),
    tipoMime: archivo.mimetype,
    tamanoBytes: archivo.size,
    subidoPorId: usuarioId || null,
  };
}

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

const INCLUDE = { adjuntos: { orderBy: { fechaSubida: "asc" } } };

function esPersonalSalud(usuario) {
  return modulosDeUsuario(usuario).includes("salud");
}

// ---- Casos de uso ------------------------------------------------------------
async function crearReporte(datos, archivos = [], usuario) {
  try {
    const limpio = validarReporte(datos, usuario);
    if (cat.esSalida(limpio.tipo)) {
      validarTiposPermitidos(limpio.tipo, limpio.medioTransporte, archivos);
      const sinAdjuntar = faltantes(limpio.tipo, limpio.medioTransporte, archivos.map((a) => a.fieldname));
      if (sinAdjuntar.length) {
        throw new AppError(400, `Adjunta: ${sinAdjuntar.map((t) => cat.ADJUNTOS[t].toLowerCase()).join(", ")}.`, "FALTAN_DOCUMENTOS");
      }
    } else {
      validarTiposPermitidos(limpio.tipo, null, archivos);
    }
    const reporte = await prisma.reporteSST.create({
      data: {
        ...limpio,
        acompanantes: limpio.acompanantes || undefined,
        reportadoPorId: usuario.id,
        adjuntos: { create: archivos.map((a) => datosAdjunto(a, usuario.id)) },
      },
      include: INCLUDE,
    });
    return serializar(reporte);
  } catch (err) {
    borrarArchivos(archivos);
    throw err;
  }
}

async function obtenerOFallar(id) {
  const reporte = await prisma.reporteSST.findUnique({ where: { id }, include: INCLUDE });
  if (!reporte) throw new AppError(404, "El reporte no existe.");
  return reporte;
}

async function obtenerReporte(id, usuario) {
  const reporte = await obtenerOFallar(id);
  if (reporte.reportadoPorId !== usuario.id && !esPersonalSalud(usuario)) {
    throw new AppError(404, "El reporte no existe.");
  }
  return serializar(reporte);
}

async function listarMios(usuario) {
  const reportes = await prisma.reporteSST.findMany({
    where: { reportadoPorId: usuario.id },
    include: INCLUDE,
    orderBy: { fechaCreacion: "desc" },
    take: 100,
  });
  return reportes.map(serializar);
}

// Quien reporto puede completar documentos mientras no este verificado.
async function agregarAdjuntos(id, archivos = [], usuario) {
  try {
    const reporte = await obtenerOFallar(id);
    const personal = esPersonalSalud(usuario);
    if (reporte.reportadoPorId !== usuario.id && !personal) throw new AppError(404, "El reporte no existe.");
    if (!personal && !["Recibido", "RequiereAjustes"].includes(reporte.estado)) {
      throw new AppError(409, "Este reporte ya fue revisado; comunícate con la Unidad de Salud.");
    }
    if (!archivos.length) throw new AppError(400, "Adjunta al menos un documento.");
    validarTiposPermitidos(reporte.tipo, reporte.medioTransporte, archivos);
    for (const a of archivos) await prisma.adjuntoReporteSST.create({ data: { reporteId: id, ...datosAdjunto(a, usuario.id) } });
    // Al corregir, vuelve a la bandeja de revision.
    if (!personal && reporte.estado === "RequiereAjustes") {
      await prisma.reporteSST.update({ where: { id }, data: { estado: "Recibido" } });
    }
    return serializar(await obtenerOFallar(id));
  } catch (err) {
    borrarArchivos(archivos);
    throw err;
  }
}

async function obtenerAdjunto(id, usuario) {
  const adjunto = await prisma.adjuntoReporteSST.findUnique({ where: { id }, include: { reporte: true } });
  if (!adjunto || (adjunto.reporte.reportadoPorId !== usuario.id && !esPersonalSalud(usuario))) {
    throw new AppError(404, "El documento no existe.");
  }
  return adjunto;
}

// ---- Personal de Salud -------------------------------------------------------
function filtroReportes({ tipo, grupo, estado, desde, hasta, q, area } = {}) {
  const where = {};
  const and = [];
  if (tipo && cat.TIPOS[tipo]) where.tipo = tipo;
  else if (grupo && cat.GRUPOS[grupo]) where.tipo = { in: Object.keys(cat.TIPOS).filter((t) => cat.TIPOS[t].grupo === grupo) };
  if (estado && cat.ESTADOS[estado]) where.estado = estado;
  if (area) where.area = area;
  // El rango aplica a la fecha de la salida o del evento; sin ellas, a la de creacion.
  if (desde || hasta) {
    const rango = {};
    if (desde) rango.gte = aFechaUTC(desde, "fecha inicial");
    if (hasta) rango.lte = aFechaUTC(hasta, "fecha final");
    and.push({ OR: [{ fechaSalida: rango }, { fechaEvento: rango }] });
  }
  const busqueda = texto(q, 80);
  if (busqueda) {
    and.push({
      OR: ["evento", "destino", "responsableNombre", "responsableDocumento", "nombreReporta", "correo", "lugarEvento", "pais"].map((c) => ({
        [c]: { contains: busqueda, mode: "insensitive" },
      })),
    });
  }
  if (and.length) where.AND = and;
  return where;
}

async function listarReportes(filtros = {}) {
  const where = filtroReportes(filtros);
  const reportes = await prisma.reporteSST.findMany({ where, include: INCLUDE, orderBy: { fechaCreacion: "desc" }, take: 500 });
  const conteos = {};
  for (const estado of Object.keys(cat.ESTADOS)) {
    conteos[estado] = await prisma.reporteSST.count({ where: { ...filtroReportes({ ...filtros, estado: undefined }), estado } });
  }
  return { reportes: reportes.map(serializar), conteos };
}

const TRANSICIONES = {
  Recibido: ["Verificado", "RequiereAjustes", "Cerrado"],
  RequiereAjustes: ["Recibido", "Verificado", "Cerrado"],
  Verificado: ["Cerrado", "RequiereAjustes"],
  Cerrado: ["Recibido"],
};

async function revisarReporte(id, { estado, observacion, gestionExterna } = {}, usuario) {
  const reporte = await obtenerOFallar(id);
  const data = {};
  if (estado !== undefined && estado !== reporte.estado) {
    if (!cat.ESTADOS[estado]) throw new AppError(400, "El estado no es válido.");
    if (!TRANSICIONES[reporte.estado].includes(estado)) {
      throw new AppError(409, `Un reporte "${cat.ESTADOS[reporte.estado]}" no puede pasar a "${cat.ESTADOS[estado]}".`);
    }
    if (estado === "RequiereAjustes" && !parrafo(observacion)) {
      throw new AppError(400, "Escribe qué debe corregir o adjuntar la persona.");
    }
    if (estado === "Verificado" && cat.esSalida(reporte.tipo)) {
      const sinAdjuntar = faltantes(reporte.tipo, reporte.medioTransporte, reporte.adjuntos.map((a) => a.tipo));
      if (sinAdjuntar.length) {
        throw new AppError(409, `No se puede verificar: falta ${sinAdjuntar.map((t) => cat.ADJUNTOS[t].toLowerCase()).join(", ")}.`, "FALTAN_DOCUMENTOS");
      }
    }
    data.estado = estado;
  }
  if (observacion !== undefined) data.observacionRevision = parrafo(observacion, 2000);
  if (gestionExterna !== undefined) data.gestionExterna = gestionExterna === true;
  if (!Object.keys(data).length) return serializar(reporte);
  data.revisadoPor = usuario.emailInstitucional;
  data.fechaRevision = new Date();
  await prisma.reporteSST.update({ where: { id }, data });
  return serializar(await obtenerOFallar(id));
}

// Para el inicio de Salud: pendientes y proximas salidas.
async function resumen() {
  const hoy = hoyBogota();
  const en15 = new Date(hoy.getTime() + 15 * DIA_MS);
  const [pendientes, ajustes, proximas, riesgosAbiertos] = await Promise.all([
    prisma.reporteSST.count({ where: { estado: "Recibido" } }),
    prisma.reporteSST.count({ where: { estado: "RequiereAjustes" } }),
    prisma.reporteSST.findMany({
      where: { fechaSalida: { gte: hoy, lte: en15 }, estado: { in: ["Recibido", "Verificado", "RequiereAjustes"] } },
      include: INCLUDE,
      orderBy: { fechaSalida: "asc" },
      take: 8,
    }),
    prisma.reporteSST.count({ where: { tipo: "CondicionInsegura", estado: { in: ["Recibido", "Verificado", "RequiereAjustes"] } } }),
  ]);
  return { pendientes, ajustes, riesgosAbiertos, proximas: proximas.map(serializar) };
}

module.exports = {
  recibirArchivos,
  rutaAbsoluta,
  carpetaSst,
  validarReporte,
  crearReporte,
  obtenerReporte,
  listarMios,
  agregarAdjuntos,
  obtenerAdjunto,
  listarReportes,
  filtroReportes,
  revisarReporte,
  resumen,
  serializar,
  esPersonalSalud,
};
