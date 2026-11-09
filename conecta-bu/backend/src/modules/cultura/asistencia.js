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
// Ventana: se abre desde 15 minutos antes de empezar hasta que termina la
// sesion, y el codigo sirve hasta 15 minutos despues del final (para quien
// llega tarde). Fuera de eso, la asistencia se marca a mano en la lista.
const ANTES_MIN = 15;
const DESPUES_MIN = 15;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I
const CONTEOS = ["conteoEstudiantes", "conteoDocentes", "conteoAdministrativos", "conteoEgresados"];

const generarCodigo = () => Array.from(crypto.randomBytes(6), (b) => ALFABETO[b % ALFABETO.length]).join("");
const DIAS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const aMinutos = (h) => {
  const [hh, mm] = String(h || "").split(":").map(Number);
  return Number.isInteger(hh) && Number.isInteger(mm) ? hh * 60 + mm : null;
};
const aHora = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Hoy y la hora actual en Bogota (UTC-5).
function ahoraBogota() {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  return { fecha: d.toISOString().slice(0, 10), dia: ((d.getUTCDay() + 6) % 7) + 1, minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Instante (UTC) de una hora de Bogota en una fecha dada.
const instante = (fecha, minutos) => new Date(Date.parse(`${fecha}T00:00:00.000Z`) + (minutos + 5 * 60) * 60 * 1000);

// Recibe las franjas de hoy ({ inicio, fin } en "HH:mm") y devuelve hasta
// cuando sirve el codigo, o explica por que todavia no o ya no se puede.
function ventanaDeHoy(franjas) {
  const ahora = ahoraBogota();
  const validas = franjas
    .map((f) => ({ inicio: aMinutos(f.inicio), fin: aMinutos(f.fin) }))
    .filter((f) => f.inicio !== null && f.fin !== null && f.fin > f.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  if (!validas.length) throw new AppError(409, "La sesión no tiene hora de inicio y fin. Complétalas para abrir el código.");
  const enCurso = validas.find((f) => ahora.minutos >= f.inicio - ANTES_MIN && ahora.minutos <= f.fin);
  if (enCurso) return instante(ahora.fecha, enCurso.fin + DESPUES_MIN);
  const proxima = validas.find((f) => ahora.minutos < f.inicio - ANTES_MIN);
  if (proxima) throw new AppError(409, `La sesión de hoy empieza a las ${aHora(proxima.inicio)}. Podrás abrir el código desde las ${aHora(proxima.inicio - ANTES_MIN)}.`);
  const ultima = validas[validas.length - 1];
  throw new AppError(409, `La sesión de hoy terminó a las ${aHora(ultima.fin)}. Si alguien asistió, márcalo a mano en la lista.`);
}

function ventanaGrupo(grupo) {
  const hoyFecha = ahoraBogota().fecha;
  if (grupo.fechaInicio && hoyFecha < iso(grupo.fechaInicio)) throw new AppError(409, `${grupo.nombre} empieza el ${iso(grupo.fechaInicio)}.`);
  if (grupo.fechaFin && hoyFecha > iso(grupo.fechaFin)) throw new AppError(409, `${grupo.nombre} terminó el ${iso(grupo.fechaFin)}.`);
  const horario = Array.isArray(grupo.horario) ? grupo.horario : [];
  const hoy = ahoraBogota().dia;
  const deHoy = horario.filter((h) => Number(h.dia) === hoy);
  if (!deHoy.length) {
    const texto = horario.map((h) => `${DIAS[Number(h.dia)] || ""} ${h.inicio}–${h.fin}`).join(", ");
    throw new AppError(409, `${grupo.nombre} no tiene sesión hoy${texto ? `. Su horario: ${texto}` : ""}.`);
  }
  return ventanaDeHoy(deHoy);
}

function ventanaEvento(evento) {
  if (iso(evento.fecha) !== ahoraBogota().fecha) throw new AppError(409, `El registro de asistencia se abre el día del evento (${iso(evento.fecha)}).`);
  return ventanaDeHoy([{ inicio: evento.horaInicio, fin: evento.horaFin }]);
}

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
  const grupo = await exigirGrupo(grupoId);
  const abiertaHasta = ventanaGrupo(grupo);
  const sesion = await sesionDe(grupoId, hoyBogota(), registradaPor);
  const fila = await prisma.sesionCultural.update({ where: { id: sesion.id }, data: { codigo: generarCodigo(), abiertaHasta } });
  return { codigo: fila.codigo, abiertaHasta: fila.abiertaHasta };
}

async function abrirEvento(eventoId) {
  const evento = await exigirEvento(eventoId);
  const abiertaHasta = ventanaEvento(evento);
  const fila = await prisma.eventoCultural.update({ where: { id: eventoId }, data: { codigo: generarCodigo(), abiertaHasta } });
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

async function marcarEnGrupo(sesion, usuarioId, ip, extra = {}) {
  const inscripcion = await prisma.inscripcionCultural.findFirst({ where: { grupoId: sesion.grupoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(409, "No estás inscrito en este grupo.");
  if (await prisma.asistenciaCultural.findFirst({ where: { sesionId: sesion.id, usuarioId } })) throw new AppError(409, "Tu asistencia a esta sesión ya estaba registrada.");
  const fila = await prisma.asistenciaCultural.create({
    data: { sesionId: sesion.id, usuarioId, presente: true, tipoSnies: inscripcion.tipoSnies || 1, ip, origen: extra.origen || "Codigo", distanciaM: extra.distanciaM ?? null, fechaHora: new Date() },
  });
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: sesion.grupoId } });
  return { actividad: grupo.nombre, fechaHora: fila.fechaHora, ip: fila.ip, tipoSnies: fila.tipoSnies };
}

// A un evento se puede llegar sin inscripcion previa: queda inscrito al marcar.
async function marcarEnEvento(evento, usuarioId, ip, extra = {}) {
  const ahora = new Date();
  const actual = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId: evento.id, usuarioId } });
  if (actual?.asistio) throw new AppError(409, "Tu asistencia a este evento ya estaba registrada.");
  const perfil = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  const datos = { estado: "Activa", asistio: true, ipAsistencia: ip, distanciaM: extra.distanciaM ?? null, fechaAsistencia: ahora };
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
  if (!abierta.abiertaHasta || new Date(abierta.abiertaHasta).getTime() < Date.now()) throw new AppError(409, "El registro de asistencia de esta sesión ya se cerró.");
  return sesion ? marcarEnGrupo(sesion, usuarioId, ip) : marcarEnEvento(evento, usuarioId, ip);
}

// --- Asistencia por ubicacion -------------------------------------------------
const MAX_IMPRECISION_M = 150; // una lectura peor que esto no sirve para ubicar a nadie
const RADIOS = [50, 100, 150, 200, 300];

// Distancia en metros entre dos puntos (formula de Haversine).
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const rad = (g) => (g * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

function numeroEnRango(valor, min, max, mensaje) {
  const n = Number(valor);
  if (valor === null || valor === "" || valor === undefined || !Number.isFinite(n) || n < min || n > max) throw new AppError(400, mensaje);
  return n;
}

// El personal marca el sitio de un grupo o evento estando en el lugar.
// latitud/longitud null quita la ubicacion.
async function guardarUbicacion(modelo, id, body = {}) {
  const fila = await prisma[modelo].findUnique({ where: { id } });
  if (!fila) throw new AppError(404, modelo === "grupoCultural" ? "No se encontró el grupo." : "No se encontró el evento.");
  if (body.latitud === null && body.longitud === null) {
    await prisma[modelo].update({ where: { id }, data: { latitud: null, longitud: null } });
    return { latitud: null, longitud: null, radioM: fila.radioM };
  }
  const latitud = numeroEnRango(body.latitud, -90, 90, "La latitud no es válida.");
  const longitud = numeroEnRango(body.longitud, -180, 180, "La longitud no es válida.");
  const radioM = body.radioM === undefined ? fila.radioM : Number(body.radioM);
  if (!RADIOS.includes(radioM)) throw new AppError(400, `El radio puede ser de ${RADIOS.join(", ")} metros.`);
  await prisma[modelo].update({ where: { id }, data: { latitud, longitud, radioM } });
  return { latitud, longitud, radioM };
}

const ubicacionGrupo = (id, body) => guardarUbicacion("grupoCultural", id, body);
const ubicacionEvento = (id, body) => guardarUbicacion("eventoCultural", id, body);

// Sesiones y eventos de hoy en los que la persona puede marcar ahora: los
// grupos donde esta inscrita y los eventos de hoy (a un evento se llega sin
// inscripcion previa), siempre dentro de la ventana de la sesion.
async function abiertosParaMarcar(usuarioId) {
  const fecha = hoyBogota();
  const [inscripciones, eventos] = await Promise.all([
    prisma.inscripcionCultural.findMany({ where: { usuarioId, estado: "Activa" } }),
    prisma.eventoCultural.findMany({ where: { fecha } }),
  ]);
  const grupos = await prisma.grupoCultural.findMany({ where: { id: { in: inscripciones.map((i) => i.grupoId) } } });
  const abiertos = [];
  for (const grupo of grupos) {
    try {
      ventanaGrupo(grupo);
      abiertos.push({ tipo: "grupo", fila: grupo });
    } catch {
      /* hoy no hay sesion abierta de este grupo */
    }
  }
  for (const evento of eventos.filter((e) => e.estado === "Publicado")) {
    try {
      ventanaEvento(evento);
      abiertos.push({ tipo: "evento", fila: evento });
    } catch {
      /* el evento no esta en su ventana */
    }
  }
  return abiertos;
}

async function marcarPorUbicacion(usuarioId, body = {}, ip) {
  const latitud = numeroEnRango(body.latitud, -90, 90, "No pudimos leer tu ubicación. Activa el GPS e inténtalo de nuevo.");
  const longitud = numeroEnRango(body.longitud, -180, 180, "No pudimos leer tu ubicación. Activa el GPS e inténtalo de nuevo.");
  const precision = Number(body.precision);
  if (Number.isFinite(precision) && precision > MAX_IMPRECISION_M) {
    throw new AppError(409, `Tu ubicación es muy imprecisa (±${Math.round(precision)} m). Sal a un lugar abierto o activa el GPS y vuelve a intentarlo.`);
  }
  const margen = Number.isFinite(precision) ? Math.min(Math.max(precision, 0), 50) : 0; // el error del GPS no te deja fuera por un par de metros

  let abiertos = await abiertosParaMarcar(usuarioId);
  // Desde la tarjeta de un evento se marca ese evento, no otra actividad cercana.
  if (body.eventoId) {
    abiertos = abiertos.filter((a) => a.tipo === "evento" && a.fila.id === body.eventoId);
    if (!abiertos.length) throw new AppError(409, "Este evento no está abierto para marcar asistencia ahora. Se abre 15 minutos antes de empezar y cierra 15 minutos después de terminar.");
  }
  if (!abiertos.length) throw new AppError(409, "Ahora no tienes una sesión ni un evento abierto para marcar asistencia.");
  const conSitio = abiertos.filter((a) => a.fila.latitud !== null && a.fila.latitud !== undefined && a.fila.longitud !== null && a.fila.longitud !== undefined);
  if (!conSitio.length) throw new AppError(409, "El área aún no marcó la ubicación de tu sesión. Avísale al docente o registra tu asistencia con él.");

  const medidos = conSitio
    .map((a) => ({ ...a, metros: distanciaMetros(latitud, longitud, a.fila.latitud, a.fila.longitud) }))
    .sort((x, y) => x.metros - y.metros);
  const dentro = medidos.find((m) => m.metros - margen <= m.fila.radioM);
  if (!dentro) {
    const cerca = medidos[0];
    throw new AppError(409, `Estás a ${Math.round(cerca.metros)} m de ${cerca.fila.nombre}. Para marcar debes estar a menos de ${cerca.fila.radioM} m del sitio.`);
  }
  const extra = { origen: "Ubicacion", distanciaM: Math.round(dentro.metros) };
  if (dentro.tipo === "grupo") {
    const sesion = await sesionDe(dentro.fila.id, hoyBogota(), "Ubicación");
    return marcarEnGrupo(sesion, usuarioId, ip, extra);
  }
  return marcarEnEvento(dentro.fila, usuarioId, ip, extra);
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
    filas: asistencias.map((a) => fila(mapas, a.usuarioId, a.tipoSnies, a.origen !== "Personal" ? "Con su cuenta" : "Por el personal", a.fechaHora)),
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

module.exports = { CONTEOS, abrirGrupo, abrirEvento, cerrarGrupo, cerrarEvento, marcarConCodigo, marcarPorUbicacion, ubicacionGrupo, ubicacionEvento, distanciaMetros, conteosGrupo, conteosEvento, listadoGrupo, listadoEvento };
