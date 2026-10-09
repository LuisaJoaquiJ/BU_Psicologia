const fs = require("fs");
const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC } = require("../../common/utils/fechas");
const { validarPeriodo } = require("./reportes.service");
const { rutaAbsoluta } = require("./evidencias.service");
const { calcularDatos, revisarInforme, ordenPeriodo } = require("./informe.datos");
const { PLANTILLA_SALUD } = require("./informe.plantilla");
const { generarExcel } = require("./informe.excel");
const { generarPdf } = require("./informe.pdf");

// Informe de gestion (INFBI-002): el modulo lo prepara por periodo y lo envia
// al superadministrador. Mientras es borrador las cifras se calculan en vivo;
// al enviarlo se guarda una foto de las cifras (datosEnviados), que es lo que
// descarga el superadministrador aunque despues se sigan registrando datos.

const MODULO = "salud";
const EDITABLES = ["Borrador", "Devuelto"];
const ESTADOS = { Borrador: "Borrador", Enviado: "Enviado", Devuelto: "Devuelto", Aprobado: "Aprobado" };

function texto(v, max = 8000) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

function limpiarObjetivos(lista) {
  if (!Array.isArray(lista)) return null;
  return lista
    .slice(0, 12)
    .map((o) => ({ objetivo: texto(o?.objetivo, 3000), resultado: texto(o?.resultado, 3000), beneficio: texto(o?.beneficio, 3000) }))
    .filter((o) => o.objetivo || o.resultado || o.beneficio);
}

function serializar(informe) {
  if (!informe) return null;
  const { datosEnviados, ...resto } = informe;
  return { ...resto, editable: EDITABLES.includes(informe.estado), tieneCifrasEnviadas: Boolean(datosEnviados) };
}

// Un informe nuevo copia los textos del ultimo informe del modulo (o la
// plantilla del formato vigente si es el primero).
async function borradorNuevo(periodo) {
  const anteriores = await prisma.informeGestion.findMany({ where: { modulo: MODULO } });
  const ultimo = anteriores
    .filter((i) => ordenPeriodo(i.periodo) < ordenPeriodo(periodo))
    .sort((a, b) => ordenPeriodo(b.periodo) - ordenPeriodo(a.periodo))[0];
  const fuente = ultimo || PLANTILLA_SALUD;
  return {
    id: null,
    modulo: MODULO,
    periodo,
    fechaPresentacion: null,
    responsable: ultimo?.responsable || null,
    accionMejora: ultimo ? ultimo.accionMejora : true,
    accionCorrectiva: ultimo ? ultimo.accionCorrectiva : true,
    accionPreventiva: ultimo ? ultimo.accionPreventiva : true,
    descripcion: fuente.descripcion,
    justificacion: fuente.justificacion,
    alineacion: fuente.alineacion,
    objetivos: fuente.objetivos,
    logros: null,
    dificultades: null,
    accionesMejora: null,
    estado: "Borrador",
    version: 0,
    copiadoDe: ultimo ? ultimo.periodo : "plantilla",
  };
}

async function buscar(periodo) {
  return prisma.informeGestion.findUnique({ where: { modulo_periodo: { modulo: MODULO, periodo } } });
}

async function obtenerInforme(periodo) {
  const { periodo: per } = validarPeriodo(periodo);
  const informe = (await buscar(per)) || (await borradorNuevo(per));
  const cifras = informe.datosEnviados && !EDITABLES.includes(informe.estado) ? informe.datosEnviados : await calcularDatos(per);
  return { informe: serializar(informe), cifras, revision: revisarInforme(informe, cifras) };
}

async function listarInformes() {
  const informes = await prisma.informeGestion.findMany({ where: { modulo: MODULO }, orderBy: { periodo: "desc" } });
  return informes.map(serializar);
}

function datosEditables(cuerpo = {}) {
  const data = {};
  for (const campo of ["responsable"]) if (cuerpo[campo] !== undefined) data[campo] = texto(cuerpo[campo], 200);
  for (const campo of ["descripcion", "justificacion", "alineacion", "logros", "dificultades", "accionesMejora"]) {
    if (cuerpo[campo] !== undefined) data[campo] = texto(cuerpo[campo]);
  }
  for (const campo of ["accionMejora", "accionCorrectiva", "accionPreventiva"]) {
    if (cuerpo[campo] !== undefined) data[campo] = cuerpo[campo] === true;
  }
  if (cuerpo.fechaPresentacion !== undefined) {
    data.fechaPresentacion = cuerpo.fechaPresentacion ? aFechaUTC(String(cuerpo.fechaPresentacion).slice(0, 10), "fecha de presentación") : null;
  }
  if (cuerpo.objetivos !== undefined) data.objetivos = limpiarObjetivos(cuerpo.objetivos);
  return data;
}

async function guardarInforme(periodo, cuerpo) {
  const { periodo: per } = validarPeriodo(periodo);
  const existente = await buscar(per);
  if (existente && !EDITABLES.includes(existente.estado)) {
    throw new AppError(409, "El informe ya fue enviado al superadministrador y no se puede editar.", "INFORME_ENVIADO");
  }
  const data = datosEditables(cuerpo);
  if (existente) {
    await prisma.informeGestion.update({ where: { id: existente.id }, data });
  } else {
    const nuevo = await borradorNuevo(per);
    const { id, copiadoDe, ...base } = nuevo;
    await prisma.informeGestion.create({ data: { ...base, ...data } });
  }
  return obtenerInforme(per);
}

async function enviarInforme(periodo, usuario) {
  const { periodo: per } = validarPeriodo(periodo);
  const informe = await buscar(per);
  if (!informe) throw new AppError(400, "Guarda el informe antes de enviarlo.");
  if (!EDITABLES.includes(informe.estado)) throw new AppError(409, "Este informe ya fue enviado.", "INFORME_ENVIADO");
  const cifras = await calcularDatos(per);
  const revision = revisarInforme(informe, cifras);
  if (!revision.listo) {
    throw new AppError(400, `Completa antes de enviar: ${revision.faltantes.join(", ")}.`, "INFORME_INCOMPLETO");
  }
  await prisma.informeGestion.update({
    where: { id: informe.id },
    data: {
      estado: "Enviado",
      version: informe.version + 1,
      enviadoPor: usuario.emailInstitucional,
      fechaEnvio: new Date(),
      datosEnviados: cifras,
    },
  });
  return obtenerInforme(per);
}

// ---- Superadministrador ------------------------------------------------------
async function listarRecibidos({ estado } = {}) {
  const where = { estado: { in: ["Enviado", "Devuelto", "Aprobado"] } };
  if (estado && ESTADOS[estado] && estado !== "Borrador") where.estado = estado;
  const informes = await prisma.informeGestion.findMany({ where, orderBy: { fechaEnvio: "desc" } });
  return informes.map((i) => ({
    ...serializar(i),
    resumen: i.datosEnviados
      ? {
          atenciones: i.datosEnviados.kpis?.atenciones,
          personas: i.datosEnviados.kpis?.personas,
          actividades: i.datosEnviados.kpis?.actividades,
          cumplimientoPromedio: i.datosEnviados.kpis?.cumplimientoPromedio,
        }
      : null,
  }));
}

async function obtenerPorId(id) {
  const informe = await prisma.informeGestion.findUnique({ where: { id } });
  if (!informe || informe.estado === "Borrador") throw new AppError(404, "El informe no existe o aún no fue enviado.");
  return informe;
}

async function revisarComoSuper(id, { estado, observacion } = {}, usuario) {
  const informe = await obtenerPorId(id);
  if (!["Aprobado", "Devuelto"].includes(estado)) throw new AppError(400, "Elige aprobar o devolver el informe.");
  if (informe.estado !== "Enviado") throw new AppError(409, "Solo se revisan informes en estado Enviado.");
  if (estado === "Devuelto" && !texto(observacion)) throw new AppError(400, "Escribe qué debe corregir el módulo.");
  await prisma.informeGestion.update({
    where: { id },
    data: { estado, observacionRevision: texto(observacion, 3000), revisadoPor: usuario.emailInstitucional, fechaRevision: new Date() },
  });
  return serializar(await prisma.informeGestion.findUnique({ where: { id } }));
}

// ---- Archivos ----------------------------------------------------------------
async function leerEvidencia(e) {
  const evidencia = await prisma.evidenciaSalud.findUnique({ where: { id: e.id } });
  if (!evidencia) return null;
  return fs.promises.readFile(rutaAbsoluta(evidencia));
}

function nombreArchivo(informe, extension) {
  return `informe-gestion-${informe.modulo}-${informe.periodo}${informe.estado === "Borrador" ? "-borrador" : ""}.${extension}`;
}

async function archivo(informe, cifras, formato) {
  if (formato === "pdf") return { buffer: await generarPdf(informe, cifras, leerEvidencia), nombre: nombreArchivo(informe, "pdf"), tipo: "application/pdf" };
  if (formato === "xlsx") {
    return {
      buffer: await generarExcel(informe, cifras, leerEvidencia),
      nombre: nombreArchivo(informe, "xlsx"),
      tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
  throw new AppError(400, "El formato debe ser pdf o xlsx.");
}

// Descarga del modulo: borrador con cifras en vivo, o lo enviado.
async function descargarDelModulo(periodo, formato) {
  const { informe, cifras } = await obtenerInforme(periodo);
  return archivo(informe, cifras, formato);
}

// Descarga del superadministrador: siempre lo que se envio.
async function descargarRecibido(id, formato) {
  const informe = await obtenerPorId(id);
  const cifras = informe.datosEnviados || (await calcularDatos(informe.periodo));
  return archivo(serializar(informe), cifras, formato);
}

// ---- Cifras historicas --------------------------------------------------------
async function listarHistoricos() {
  const filas = await prisma.historicoSalud.findMany();
  return filas.sort((a, b) => ordenPeriodo(a.periodo) - ordenPeriodo(b.periodo));
}

function entero(v, campo, opcional) {
  if (v === "" || v === null || v === undefined) {
    if (opcional) return null;
    return 0;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new AppError(400, `El valor de ${campo} no es válido.`);
  return n;
}

async function guardarHistoricos(filas) {
  if (!Array.isArray(filas)) throw new AppError(400, "Envía la lista de periodos.");
  const limpias = filas.map((f) => {
    const periodo = String(f.periodo || "").trim();
    if (!/^\d{4}(-[12])?$/.test(periodo)) throw new AppError(400, `El periodo "${periodo}" no es válido (usa AAAA o AAAA-1).`);
    return {
      periodo,
      estudiantes: entero(f.estudiantes, "estudiantes"),
      docentes: entero(f.docentes, "docentes"),
      administrativos: entero(f.administrativos, "administrativos"),
      externos: entero(f.externos, "externos"),
      egresados: entero(f.egresados, "egresados"),
      enfermeria: entero(f.enfermeria, "enfermería", true),
      poblacionGeneral: entero(f.poblacionGeneral, "población general", true),
    };
  });
  const repetido = limpias.find((f, i) => limpias.findIndex((x) => x.periodo === f.periodo) !== i);
  if (repetido) throw new AppError(400, `El periodo ${repetido.periodo} está repetido.`);
  await prisma.$transaction(async (tx) => {
    await tx.historicoSalud.deleteMany({});
    for (const f of limpias) await tx.historicoSalud.create({ data: f });
  });
  return listarHistoricos();
}

module.exports = {
  obtenerInforme,
  listarInformes,
  guardarInforme,
  enviarInforme,
  listarRecibidos,
  revisarComoSuper,
  descargarDelModulo,
  descargarRecibido,
  listarHistoricos,
  guardarHistoricos,
};
