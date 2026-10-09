const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ExcelJS = require("exceljs");
const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const { PROGRAMAS } = require("./catalogos");

// Salidas de Salud integral: el personal de Salud publica la salida (visita
// tecnica, practica de campo...), los estudiantes se inscriben con sus datos,
// su EPS y, si se pide, el comprobante de pago; el personal revisa cada
// inscripcion y descarga el listado para la ARL o el seguro.

const ESTADOS_SALIDA = ["Borrador", "Publicada", "Cerrada", "Cancelada"];
const ESTADOS_INSCRIPCION = ["Pendiente", "Aprobada", "Rechazada", "Cancelada"];
const OCUPAN_CUPO = ["Pendiente", "Aprobada"];
const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PA"];

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const texto = (v, max) => {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
};
const hora = (v, etiqueta) => {
  const t = texto(v, 5);
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new AppError(400, `${etiqueta} debe tener el formato HH:MM.`);
  return t;
};

// ---- Archivos (comprobantes) ------------------------------------------------
const TIPOS_COMPROBANTE = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX_MB = 10;
const carpeta = () => path.join(config.saludUploadsDir, "salidas");

const subir = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      fs.mkdir(carpeta(), { recursive: true }, (err) => cb(err, carpeta()));
    },
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}${TIPOS_COMPROBANTE[file.mimetype]}`);
    },
  }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!TIPOS_COMPROBANTE[file.mimetype]) return cb(new AppError(400, "El comprobante debe ser PDF o una foto (JPG, PNG, WEBP)."));
    cb(null, true);
  },
}).single("comprobante");

function recibirComprobante(req, res, next) {
  subir(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, `El comprobante no puede pesar más de ${MAX_MB} MB.`));
    next(err instanceof AppError ? err : new AppError(400, "No fue posible recibir el comprobante."));
  });
}

function rutaComprobante(nombre) {
  if (!nombre || !/^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(nombre)) return null;
  return path.join(carpeta(), nombre);
}
const borrarArchivo = (nombre) => {
  const ruta = rutaComprobante(nombre);
  return ruta ? fs.promises.unlink(ruta).catch(() => {}) : Promise.resolve();
};

// ---- Salidas (personal de Salud) -----------------------------------------------
function datosSalida(cuerpo = {}, actual = {}) {
  const v = (k) => (cuerpo[k] !== undefined ? cuerpo[k] : actual[k]);
  const nombre = texto(v("nombre"), 200);
  const destino = texto(v("destino"), 200);
  if (!nombre) throw new AppError(400, "Escribe el nombre de la salida.");
  if (!destino) throw new AppError(400, "Escribe el destino de la salida.");
  const fecha = (k, etiqueta) => {
    const valor = cuerpo[k] !== undefined ? cuerpo[k] : actual[k] ? iso(actual[k]) : null;
    if (!valor) throw new AppError(400, `Indica ${etiqueta}.`);
    return aFechaUTC(String(valor).slice(0, 10), etiqueta);
  };
  const fechaSalida = fecha("fechaSalida", "la fecha de salida");
  const fechaRegreso = fecha("fechaRegreso", "la fecha de regreso");
  const fechaLimiteInscripcion = fecha("fechaLimiteInscripcion", "la fecha límite de inscripción");
  if (fechaRegreso < fechaSalida) throw new AppError(400, "La fecha de regreso no puede ser anterior a la de salida.");
  if (fechaLimiteInscripcion > fechaSalida) throw new AppError(400, "Las inscripciones deben cerrar antes o el mismo día de la salida.");
  const cupos = Number(v("cupos"));
  if (!Number.isInteger(cupos) || cupos < 1) throw new AppError(400, "Los cupos deben ser un número entero mayor que 0.");
  const costoCrudo = v("costo");
  const costo = costoCrudo === null || costoCrudo === undefined || costoCrudo === "" ? null : Number(costoCrudo);
  if (costo !== null && (!Number.isInteger(costo) || costo < 0)) throw new AppError(400, "El costo debe ser un número entero en pesos.");
  return {
    nombre,
    destino,
    descripcion: texto(v("descripcion"), 4000),
    programa: texto(v("programa"), 150),
    responsable: texto(v("responsable"), 200),
    lugarEncuentro: texto(v("lugarEncuentro"), 200),
    fechaSalida,
    fechaRegreso,
    horaSalida: hora(v("horaSalida"), "La hora de salida"),
    horaRegreso: hora(v("horaRegreso"), "La hora de regreso"),
    cupos,
    costo,
    infoPago: texto(v("infoPago"), 4000),
    pideComprobante: Boolean(v("pideComprobante") === true || v("pideComprobante") === "true"),
    fechaLimiteInscripcion,
  };
}

async function salidaOFallar(id) {
  const salida = await prisma.salidaConvocatoria.findUnique({ where: { id } });
  if (!salida) throw new AppError(404, "La salida no existe.");
  return salida;
}

// Conteo de inscripciones por estado, por salida.
async function conteos(salidaIds) {
  const lista = salidaIds.length ? await prisma.inscripcionSalida.findMany({ where: { salidaId: { in: salidaIds } } }) : [];
  const mapa = new Map();
  for (const i of lista) {
    const c = mapa.get(i.salidaId) || { Pendiente: 0, Aprobada: 0, Rechazada: 0, Cancelada: 0 };
    c[i.estado] = (c[i.estado] || 0) + 1;
    mapa.set(i.salidaId, c);
  }
  return mapa;
}

function serializar(salida, c = {}) {
  const ocupados = (c.Pendiente || 0) + (c.Aprobada || 0);
  return {
    ...salida,
    fechaSalida: iso(salida.fechaSalida),
    fechaRegreso: iso(salida.fechaRegreso),
    fechaLimiteInscripcion: iso(salida.fechaLimiteInscripcion),
    inscritos: { pendientes: c.Pendiente || 0, aprobados: c.Aprobada || 0, rechazados: c.Rechazada || 0, total: ocupados },
    cuposDisponibles: Math.max(0, salida.cupos - ocupados),
    inscripcionAbierta: salida.estado === "Publicada" && salida.fechaLimiteInscripcion >= hoyBogota() && ocupados < salida.cupos,
  };
}

async function listarSalidas() {
  const salidas = await prisma.salidaConvocatoria.findMany({ orderBy: [{ fechaSalida: "asc" }] });
  const mapa = await conteos(salidas.map((s) => s.id));
  return salidas.map((s) => serializar(s, mapa.get(s.id)));
}

async function obtenerSalida(id) {
  const salida = await salidaOFallar(id);
  return serializar(salida, (await conteos([id])).get(id));
}

async function crearSalida(cuerpo, usuario) {
  const estado = cuerpo.estado === "Publicada" ? "Publicada" : "Borrador";
  const salida = await prisma.salidaConvocatoria.create({ data: { ...datosSalida(cuerpo), estado, creadaPor: usuario?.emailInstitucional || null } });
  return serializar(salida);
}

async function actualizarSalida(id, cuerpo) {
  const actual = await salidaOFallar(id);
  if (actual.estado === "Cancelada") throw new AppError(409, "La salida está cancelada y ya no se puede editar.");
  const datos = datosSalida(cuerpo, actual);
  const c = (await conteos([id])).get(id) || {};
  const ocupados = (c.Pendiente || 0) + (c.Aprobada || 0);
  if (datos.cupos < ocupados) throw new AppError(409, `Ya hay ${ocupados} estudiantes inscritos: los cupos no pueden ser menos.`);
  const salida = await prisma.salidaConvocatoria.update({ where: { id }, data: datos });
  return serializar(salida, c);
}

async function cambiarEstadoSalida(id, estado) {
  if (!ESTADOS_SALIDA.includes(estado)) throw new AppError(400, `Estado no válido. Usa uno de: ${ESTADOS_SALIDA.join(", ")}.`);
  const actual = await salidaOFallar(id);
  if (actual.estado === "Cancelada") throw new AppError(409, "La salida está cancelada.");
  const salida = await prisma.salidaConvocatoria.update({ where: { id }, data: { estado } });
  return serializar(salida, (await conteos([id])).get(id));
}

async function eliminarSalida(id) {
  await salidaOFallar(id);
  const inscripciones = await prisma.inscripcionSalida.count({ where: { salidaId: id } });
  if (inscripciones) throw new AppError(409, "La salida ya tiene inscripciones: cancélala en lugar de eliminarla.");
  await prisma.salidaConvocatoria.delete({ where: { id } });
  return { id, eliminada: true };
}

// ---- Inscripciones (vista del personal) ------------------------------------------
const publicaInscripcion = (i) => ({ ...i, tieneComprobante: Boolean(i.comprobante), comprobante: undefined });

async function listarInscripciones(salidaId) {
  await salidaOFallar(salidaId);
  const lista = await prisma.inscripcionSalida.findMany({ where: { salidaId }, orderBy: [{ fechaInscripcion: "asc" }] });
  return lista.map(publicaInscripcion);
}

async function revisarInscripcion(salidaId, inscripcionId, { estado, observacion } = {}, usuario) {
  if (!["Aprobada", "Rechazada", "Pendiente"].includes(estado)) throw new AppError(400, "Elige si apruebas o rechazas la inscripción.");
  const ins = await prisma.inscripcionSalida.findUnique({ where: { id: inscripcionId } });
  if (!ins || ins.salidaId !== salidaId) throw new AppError(404, "La inscripción no existe.");
  if (ins.estado === "Cancelada") throw new AppError(409, "El estudiante canceló esta inscripción.");
  const obs = texto(observacion, 1000);
  if (estado === "Rechazada" && !obs) throw new AppError(400, "Escribe el motivo del rechazo para que el estudiante sepa qué corregir.");
  const actualizada = await prisma.inscripcionSalida.update({
    where: { id: inscripcionId },
    data: { estado, observacion: obs, revisadoPor: usuario?.emailInstitucional || null, fechaRevision: new Date() },
  });
  return publicaInscripcion(actualizada);
}

async function comprobanteDe(salidaId, inscripcionId) {
  const ins = await prisma.inscripcionSalida.findUnique({ where: { id: inscripcionId } });
  if (!ins || ins.salidaId !== salidaId) throw new AppError(404, "La inscripción no existe.");
  const ruta = rutaComprobante(ins.comprobante);
  if (!ruta || !fs.existsSync(ruta)) throw new AppError(404, "La inscripción no tiene comprobante.");
  return { ruta, nombre: ins.comprobanteNombre || path.basename(ruta) };
}

// Listado en Excel para la ARL o el seguro (por defecto, solo aprobados).
async function listadoExcel(salidaId, { todos } = {}) {
  const salida = await salidaOFallar(salidaId);
  const lista = (await prisma.inscripcionSalida.findMany({ where: { salidaId }, orderBy: [{ nombre: "asc" }] })).filter((i) =>
    todos ? i.estado !== "Cancelada" : i.estado === "Aprobada"
  );
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Listado");
  hoja.addRow(["Universidad Autónoma del Cauca · Bienestar Institucional · Salud Integral"]).font = { bold: true, size: 13 };
  hoja.addRow([`Salida: ${salida.nombre}`]).font = { bold: true };
  hoja.addRow([`Destino: ${salida.destino}`]);
  hoja.addRow([`Fechas: ${iso(salida.fechaSalida)}${salida.horaSalida ? ` ${salida.horaSalida}` : ""} a ${iso(salida.fechaRegreso)}${salida.horaRegreso ? ` ${salida.horaRegreso}` : ""}`]);
  if (salida.responsable) hoja.addRow([`Responsable: ${salida.responsable}`]);
  hoja.addRow([todos ? "Inscritos (todos los estados, sin cancelados)" : "Estudiantes aprobados"]);
  hoja.addRow([]);
  const columnas = ["N°", "Nombre completo", "Tipo doc.", "Documento", "Programa", "Celular", "Correo", "EPS", "Contacto de emergencia", "Teléfono emergencia", "Estado"];
  const encabezado = hoja.addRow(columnas);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF19407B" } };
  });
  lista.forEach((i, n) =>
    hoja.addRow([n + 1, i.nombre, i.tipoDocumento, i.documento, i.programa, i.celular, i.correo, i.eps, i.contactoEmergencia || "", i.telefonoEmergencia || "", i.estado])
  );
  [5, 34, 9, 16, 34, 14, 34, 22, 28, 18, 12].forEach((w, k) => {
    hoja.getColumn(k + 1).width = w;
  });
  const nombre = `salida-${salida.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}.xlsx`;
  return { buffer: await libro.xlsx.writeBuffer(), nombre };
}

// ---- Estudiante ---------------------------------------------------------------
async function salidasParaEstudiante(usuario) {
  const salidas = await prisma.salidaConvocatoria.findMany({ where: { estado: { in: ["Publicada", "Cerrada"] } }, orderBy: [{ fechaSalida: "asc" }] });
  const hoy = hoyBogota();
  const vigentes = salidas.filter((s) => s.fechaRegreso >= hoy);
  const mapa = await conteos(vigentes.map((s) => s.id));
  const mias = await prisma.inscripcionSalida.findMany({ where: { usuarioId: usuario.id } });
  const miaDe = (id) => mias.find((m) => m.salidaId === id);
  const todasSalidas = await prisma.salidaConvocatoria.findMany({ where: { id: { in: mias.map((m) => m.salidaId) } } });
  return {
    programas: PROGRAMAS.map((p) => p.nombre),
    salidas: vigentes.map((s) => ({ ...serializar(s, mapa.get(s.id)), miInscripcion: miaDe(s.id) ? publicaInscripcion(miaDe(s.id)) : null })),
    misInscripciones: mias
      .map((m) => {
        const s = todasSalidas.find((x) => x.id === m.salidaId);
        return { ...publicaInscripcion(m), salida: s ? { id: s.id, nombre: s.nombre, destino: s.destino, fechaSalida: iso(s.fechaSalida), estado: s.estado } : null };
      })
      .sort((a, b) => String(b.salida?.fechaSalida).localeCompare(String(a.salida?.fechaSalida))),
  };
}

async function inscribirse(usuario, salidaId, cuerpo = {}, archivo) {
  const limpiar = () => archivo && borrarArchivo(path.basename(archivo.path));
  try {
    const salida = await salidaOFallar(salidaId);
    if (salida.estado !== "Publicada") throw new AppError(409, "Esta salida no tiene inscripciones abiertas.");
    if (salida.fechaLimiteInscripcion < hoyBogota()) throw new AppError(409, "Las inscripciones para esta salida ya cerraron.");
    const datos = {
      tipoDocumento: TIPOS_DOCUMENTO.includes(cuerpo.tipoDocumento) ? cuerpo.tipoDocumento : "CC",
      documento: texto(cuerpo.documento, 30),
      programa: texto(cuerpo.programa, 150),
      celular: texto(cuerpo.celular, 30),
      eps: texto(cuerpo.eps, 120),
      contactoEmergencia: texto(cuerpo.contactoEmergencia, 200),
      telefonoEmergencia: texto(cuerpo.telefonoEmergencia, 30),
    };
    const faltan = [
      ["documento", "tu número de identificación"],
      ["programa", "tu programa"],
      ["celular", "tu número de celular"],
      ["eps", "tu EPS"],
    ].filter(([k]) => !datos[k]);
    if (faltan.length) throw new AppError(400, `Falta ${faltan.map(([, t]) => t).join(", ")}.`);
    if (!/^[0-9A-Za-z-]{5,20}$/.test(datos.documento)) throw new AppError(400, "Revisa el número de identificación.");
    if (!(cuerpo.consentimiento === true || cuerpo.consentimiento === "true")) {
      throw new AppError(400, "Debes autorizar el tratamiento de tus datos para inscribirte.");
    }
    if (salida.pideComprobante && !archivo) throw new AppError(400, "Esta salida pide subir el comprobante de pago.");

    const existente = await prisma.inscripcionSalida.findFirst({ where: { salidaId, usuarioId: usuario.id } });
    if (existente && OCUPAN_CUPO.includes(existente.estado)) throw new AppError(409, "Ya estás inscrito en esta salida.");
    const ocupados = await prisma.inscripcionSalida.count({ where: { salidaId, estado: { in: OCUPAN_CUPO } } });
    if (ocupados >= salida.cupos) throw new AppError(409, "Ya no quedan cupos para esta salida.");

    const comun = {
      ...datos,
      nombre: usuario.nombre,
      correo: usuario.emailInstitucional,
      consentimiento: true,
      estado: "Pendiente",
      observacion: null,
      revisadoPor: null,
      fechaRevision: null,
      ...(archivo ? { comprobante: path.basename(archivo.path), comprobanteNombre: texto(archivo.originalname, 200) } : {}),
    };
    let ins;
    if (existente) {
      // Se vuelve a inscribir despues de cancelar o de un rechazo.
      if (archivo && existente.comprobante) await borrarArchivo(existente.comprobante);
      ins = await prisma.inscripcionSalida.update({ where: { id: existente.id }, data: { ...comun, fechaInscripcion: new Date() } });
    } else {
      ins = await prisma.inscripcionSalida.create({ data: { ...comun, salidaId, usuarioId: usuario.id } });
    }
    return publicaInscripcion(ins);
  } catch (err) {
    await limpiar();
    throw err;
  }
}

async function cancelarInscripcion(usuario, salidaId) {
  const salida = await salidaOFallar(salidaId);
  const ins = await prisma.inscripcionSalida.findFirst({ where: { salidaId, usuarioId: usuario.id } });
  if (!ins || ins.estado === "Cancelada") throw new AppError(404, "No tienes una inscripción activa en esta salida.");
  if (salida.fechaSalida <= hoyBogota()) throw new AppError(409, "La salida ya empezó: comunícate con la Unidad de Salud.");
  const actualizada = await prisma.inscripcionSalida.update({ where: { id: ins.id }, data: { estado: "Cancelada" } });
  return publicaInscripcion(actualizada);
}

module.exports = {
  ESTADOS_SALIDA,
  ESTADOS_INSCRIPCION,
  recibirComprobante,
  listarSalidas,
  obtenerSalida,
  crearSalida,
  actualizarSalida,
  cambiarEstadoSalida,
  eliminarSalida,
  listarInscripciones,
  revisarInscripcion,
  comprobanteDe,
  listadoExcel,
  salidasParaEstudiante,
  inscribirse,
  cancelarInscripcion,
};
