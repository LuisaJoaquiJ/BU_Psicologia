const crypto = require("crypto");
const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const { iso } = require("./periodo");
const { nombreTipo } = require("./catalogo");
const { generarListado } = require("./listado-pdf");

// Asistencia con codigo: el personal abre el registro en la sesion, muestra el
// codigo y solo quien esta ahi lo puede escribir. Reemplaza la firma en papel:
// queda la cuenta institucional, la hora y la direccion IP.
const MINUTOS_ABIERTO = 120;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I
const CONTEOS = ["conteoEstudiantes", "conteoDocentes", "conteoAdministrativos", "conteoEgresados"];

const generarCodigo = () => Array.from(crypto.randomBytes(6), (b) => ALFABETO[b % ALFABETO.length]).join("");
const venceEn = () => new Date(Date.now() + MINUTOS_ABIERTO * 60 * 1000);

function datosConteos(body = {}) {
  return Object.fromEntries(
    CONTEOS.map((k) => {
      const n = Number(body[k] ?? 0);
      if (!Number.isInteger(n) || n < 0) throw new AppError(400, "Los conteos deben ser números enteros.");
      return [k, n];
    })
  );
}

async function exigirGrupo(id) {
  const grupo = await prisma.grupoCultural.findUnique({ where: { id } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo.");
  return grupo;
}

async function exigirEvento(id) {
  const evento = await prisma.eventoCultural.findUnique({ where: { id } });
  if (!evento) throw new AppError(404, "No se encontró el evento.");
  return evento;
}

async function sesionDe(grupoId, fecha, registradaPor) {
  return (await prisma.sesionCultural.findFirst({ where: { grupoId, fecha } })) || prisma.sesionCultural.create({ data: { grupoId, fecha, registradaPor } });
}

async function abrirGrupo(grupoId, registradaPor) {
  await exigirGrupo(grupoId);
  const sesion = await sesionDe(grupoId, hoyBogota(), registradaPor);
  const fila = await prisma.sesionCultural.update({ where: { id: sesion.id }, data: { codigo: generarCodigo(), abiertaHasta: venceEn() } });
  return { codigo: fila.codigo, abiertaHasta: fila.abiertaHasta };
}

async function abrirEvento(eventoId) {
  const evento = await exigirEvento(eventoId);
  if (iso(evento.fecha) !== iso(hoyBogota())) throw new AppError(409, "El registro de asistencia se abre el día del evento.");
  const fila = await prisma.eventoCultural.update({ where: { id: eventoId }, data: { codigo: generarCodigo(), abiertaHasta: venceEn() } });
  return { codigo: fila.codigo, abiertaHasta: fila.abiertaHasta };
}

async function cerrarGrupo(grupoId) {
  const sesion = await prisma.sesionCultural.findFirst({ where: { grupoId, fecha: hoyBogota() } });
  if (sesion) await prisma.sesionCultural.update({ where: { id: sesion.id }, data: { abiertaHasta: new Date() } });
  return { abierta: false };
}

async function cerrarEvento(eventoId) {
  await exigirEvento(eventoId);
  await prisma.eventoCultural.update({ where: { id: eventoId }, data: { abiertaHasta: new Date() } });
  return { abierta: false };
}

async function marcarEnGrupo(sesion, usuarioId, ip) {
  const inscripcion = await prisma.inscripcionCultural.findFirst({ where: { grupoId: sesion.grupoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(409, "No estás inscrito en este grupo.");
  if (await prisma.asistenciaCultural.findFirst({ where: { sesionId: sesion.id, usuarioId } })) throw new AppError(409, "Tu asistencia a esta sesión ya estaba registrada.");
  const fila = await prisma.asistenciaCultural.create({
    data: { sesionId: sesion.id, usuarioId, presente: true, tipoSnies: inscripcion.tipoSnies || 1, ip, origen: "Codigo", fechaHora: new Date() },
  });
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: sesion.grupoId } });
  return { actividad: grupo.nombre, fechaHora: fila.fechaHora, ip: fila.ip, tipoSnies: fila.tipoSnies };
}

// A un evento se puede llegar sin inscripcion previa: queda inscrito al marcar.
async function marcarEnEvento(evento, usuarioId, ip) {
  const ahora = new Date();
  const actual = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId: evento.id, usuarioId } });
  if (actual?.asistio) throw new AppError(409, "Tu asistencia a este evento ya estaba registrada.");
  const perfil = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  const datos = { estado: "Activa", asistio: true, ipAsistencia: ip, fechaAsistencia: ahora };
  const fila = actual
    ? await prisma.inscripcionEventoCultural.update({ where: { id: actual.id }, data: datos })
    : await prisma.inscripcionEventoCultural.create({ data: { ...datos, eventoId: evento.id, usuarioId, tipoSnies: perfil?.tipoSnies || 1, ip } });
  return { actividad: evento.nombre, fechaHora: ahora, ip, tipoSnies: fila.tipoSnies };
}

async function marcarConCodigo(usuarioId, codigoCrudo, ip) {
  const codigo = String(codigoCrudo || "").trim().toUpperCase();
  if (!codigo) throw new AppError(400, "Escribe el código de la sesión.");
  const fecha = hoyBogota();
  const sesion = await prisma.sesionCultural.findFirst({ where: { codigo, fecha } });
  const evento = sesion ? null : await prisma.eventoCultural.findFirst({ where: { codigo, fecha } });
  const abierta = sesion || evento;
  if (!abierta) throw new AppError(404, "Ese código no corresponde a ninguna sesión de hoy.");
  if (!abierta.abiertaHasta || new Date(abierta.abiertaHasta) < new Date()) throw new AppError(409, "El registro de asistencia de esta sesión ya se cerró.");
  return sesion ? marcarEnGrupo(sesion, usuarioId, ip) : marcarEnEvento(evento, usuarioId, ip);
}

async function conteosGrupo(grupoId, body, registradaPor) {
  await exigirGrupo(grupoId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body?.fecha || ""))) throw new AppError(400, "Indica la fecha.");
  const sesion = await sesionDe(grupoId, new Date(`${body.fecha}T00:00:00.000Z`), registradaPor);
  return prisma.sesionCultural.update({ where: { id: sesion.id }, data: datosConteos(body) });
}

async function conteosEvento(eventoId, body) {
  await exigirEvento(eventoId);
  return prisma.eventoCultural.update({ where: { id: eventoId }, data: datosConteos(body) });
}

const sinCuenta = (fila) => CONTEOS.reduce((n, k) => n + (fila?.[k] || 0), 0);

async function personas(ids) {
  const [usuarios, perfiles] = await Promise.all([prisma.usuario.findMany({ where: { id: { in: ids } } }), prisma.perfilCultural.findMany({ where: { usuarioId: { in: ids } } })]);
  return { usuario: new Map(usuarios.map((u) => [u.id, u])), perfil: new Map(perfiles.map((p) => [p.usuarioId, p])) };
}

function fila(mapas, usuarioId, tipoSnies, registro, fecha) {
  const u = mapas.usuario.get(usuarioId);
  return { nombre: u?.nombre || "", correo: u?.emailInstitucional || "", programa: mapas.perfil.get(usuarioId)?.programa || "-", tipo: nombreTipo(tipoSnies || 1), registro, fecha };
}

async function listadoGrupo(grupoId, fechaTexto) {
  const grupo = await exigirGrupo(grupoId);
  const dia = String(fechaTexto || iso(hoyBogota())).slice(0, 10);
  const sesion = await prisma.sesionCultural.findFirst({ where: { grupoId, fecha: new Date(`${dia}T00:00:00.000Z`) } });
  const asistencias = sesion ? await prisma.asistenciaCultural.findMany({ where: { sesionId: sesion.id } }) : [];
  const mapas = await personas(asistencias.map((a) => a.usuarioId));
  return generarListado({
    titulo: grupo.nombre,
    detalle: [dia, grupo.lugar, grupo.director].filter(Boolean).join("   "),
    filas: asistencias.map((a) => fila(mapas, a.usuarioId, a.tipoSnies, a.origen === "Codigo" ? "Con su cuenta" : "Por el personal", a.fechaHora)),
    sinCuenta: sinCuenta(sesion),
  });
}

async function listadoEvento(eventoId) {
  const evento = await exigirEvento(eventoId);
  const asistentes = await prisma.inscripcionEventoCultural.findMany({ where: { eventoId, asistio: true } });
  const mapas = await personas(asistentes.map((a) => a.usuarioId));
  return generarListado({
    titulo: evento.nombre,
    detalle: [iso(evento.fecha), `${evento.horaInicio} a ${evento.horaFin}`, evento.lugar].filter(Boolean).join("   "),
    filas: asistentes.map((a) => fila(mapas, a.usuarioId, a.tipoSnies, a.ipAsistencia ? "Con su cuenta" : "Por el personal", a.fechaAsistencia)),
    sinCuenta: sinCuenta(evento),
  });
}

module.exports = { CONTEOS, abrirGrupo, abrirEvento, cerrarGrupo, cerrarEvento, marcarConCodigo, conteosGrupo, conteosEvento, listadoGrupo, listadoEvento };
