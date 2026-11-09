const fs = require("fs");
const path = require("path");
const { prisma } = require("../../../config/prisma");
const { config } = require("../../../config/env");
const { AppError } = require("../../../common/utils/AppError");
const { validarPeriodo } = require("../../salud/utils/registro");
const { EDITABLES, serializar, datosEditables, nombreArchivo } = require("../../salud/utils/informe/edicion");
const { ordenPeriodo } = require("../../salud/utils/informe/series");
const notificaciones = require("../../notificaciones/service");
const { PLANTILLA_CULTURA } = require("./plantilla");
const { armarCifras, revisarInforme } = require("./cifras");
const { generarPdf, generarExcel } = require("./archivos");

// Informe de gestion de Arte y Cultura: el area lo prepara por periodo y lo envia al
// superadministrador. Mientras es borrador las cifras se calculan en vivo; al enviarlo se guarda
// una foto de las cifras (datosEnviados), que es lo que descarga el superadministrador.
const MODULO = "cultura";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const buscar = (periodo) => prisma.informeGestion.findUnique({ where: { modulo_periodo: { modulo: MODULO, periodo } } });

// Contenido de una evidencia (foto o PDF) para meterla en el informe, o null.
async function leerEvidencia(e) {
  const fila = await prisma.evidenciaCultural.findUnique({ where: { id: e.id } });
  if (!fila) return null;
  const base = path.resolve(config.saludUploadsDir, "cultura");
  const ruta = path.resolve(base, fila.archivo);
  if (!ruta.startsWith(base + path.sep)) return null;
  return fs.promises.readFile(ruta).catch(() => null);
}

// Un informe nuevo copia los textos del ultimo del area (o la plantilla si es el primero).
async function borradorNuevo(periodo) {
  const anteriores = await prisma.informeGestion.findMany({ where: { modulo: MODULO } });
  const ultimo = anteriores.filter((i) => ordenPeriodo(i.periodo) < ordenPeriodo(periodo)).sort((a, b) => ordenPeriodo(b.periodo) - ordenPeriodo(a.periodo))[0];
  const fuente = ultimo || PLANTILLA_CULTURA;
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

async function obtener(periodoCrudo) {
  const periodo = validarPeriodo(periodoCrudo);
  const informe = (await buscar(periodo)) || (await borradorNuevo(periodo));
  const cifras = informe.datosEnviados && !EDITABLES.includes(informe.estado) ? informe.datosEnviados : await armarCifras(periodo);
  return { informe: serializar(informe), cifras, revision: revisarInforme(informe, cifras) };
}

async function listar() {
  return (await prisma.informeGestion.findMany({ where: { modulo: MODULO } })).sort((a, b) => ordenPeriodo(b.periodo) - ordenPeriodo(a.periodo)).map(serializar);
}

async function guardar(periodoCrudo, cuerpo) {
  const periodo = validarPeriodo(periodoCrudo);
  const existente = await buscar(periodo);
  if (existente && !EDITABLES.includes(existente.estado)) throw new AppError(409, "El informe ya fue enviado al superadministrador y no se puede editar.", "INFORME_ENVIADO");
  const data = datosEditables(cuerpo);
  if (existente) await prisma.informeGestion.update({ where: { id: existente.id }, data });
  else {
    const { id, copiadoDe, ...base } = await borradorNuevo(periodo);
    await prisma.informeGestion.create({ data: { ...base, ...data } });
  }
  return obtener(periodo);
}

async function enviar(periodoCrudo, usuario) {
  const periodo = validarPeriodo(periodoCrudo);
  const informe = await buscar(periodo);
  if (!informe) throw new AppError(400, "Guarda el informe antes de enviarlo.");
  if (!EDITABLES.includes(informe.estado)) throw new AppError(409, "Este informe ya fue enviado.", "INFORME_ENVIADO");
  const cifras = await armarCifras(periodo);
  const revision = revisarInforme(informe, cifras);
  if (!revision.listo) throw new AppError(400, `Completa antes de enviar: ${revision.faltantes.join(", ")}.`, "INFORME_INCOMPLETO");
  await prisma.informeGestion.update({
    where: { id: informe.id },
    data: { estado: "Enviado", version: informe.version + 1, enviadoPor: usuario.emailInstitucional, fechaEnvio: new Date(), datosEnviados: cifras },
  });
  await notificaciones.avisarASuperadministradores({ modulo: "cultura", tipo: "informe", titulo: "Informe de gestión recibido", mensaje: `Arte y Cultura envió su informe de gestión ${periodo} para revisión.`, ruta: "/super/informes" });
  return obtener(periodo);
}

// Archivo del informe (PDF o Excel) con la informacion enviada o, si es borrador, la de hoy.
async function archivoDe(informe, cifras, formato) {
  const datos = serializar(informe);
  if (formato === "pdf") return { buffer: await generarPdf(datos, cifras, leerEvidencia), nombre: nombreArchivo(datos, "pdf"), tipo: "application/pdf" };
  if (formato === "xlsx") return { buffer: await generarExcel(datos, cifras, leerEvidencia), nombre: nombreArchivo(datos, "xlsx"), tipo: XLSX };
  throw new AppError(400, "El formato debe ser pdf o xlsx.");
}

async function descargar(periodoCrudo, formato) {
  const periodo = validarPeriodo(periodoCrudo);
  const { informe, cifras } = await obtener(periodo);
  return archivoDe(informe, cifras, formato);
}

module.exports = { MODULO, obtener, listar, guardar, enviar, descargar, archivoDe };
