const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const { periodoActual, iso } = require("./periodo");
const { tipoValido, nombreTipo, nombreCategoria, CATEGORIAS, CARACTERIZACIONES } = require("./catalogo");
const { urlImagen, convocatorias: fotoConvocatoria, grupos: fotoGrupo } = require("./imagen");

const notificaciones = require("../notificaciones/service");

const MAX_GRUPOS = 2;

const fechaTexto = (d) => (d ? new Date(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");

function texto(valor, max, etiqueta) {
  const t = String(valor || "").trim();
  if (!t) throw new AppError(400, `Indica ${etiqueta}.`);
  if (t.length > max) throw new AppError(400, `${etiqueta} no puede superar ${max} caracteres.`);
  return t;
}

function fechaDia(valor, etiqueta) {
  const s = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError(400, `${etiqueta} debe tener la forma AAAA-MM-DD.`);
  return new Date(`${s}T00:00:00.000Z`);
}

function hoy() {
  const d = hoyBogota();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minutos(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ""));
  if (!m) throw new AppError(400, "La hora debe tener la forma HH:mm.");
  return Number(m[1]) * 60 + Number(m[2]);
}

function horarioValido(horario) {
  if (!Array.isArray(horario) || horario.length === 0) throw new AppError(400, "Indica al menos un día y un horario.");
  return horario.map((h) => {
    const dia = Number(h.dia);
    if (![1, 2, 3, 4, 5, 6, 7].includes(dia)) throw new AppError(400, "El día va de lunes (1) a domingo (7).");
    if (minutos(h.fin) <= minutos(h.inicio)) throw new AppError(400, "La hora de fin debe ser posterior a la de inicio.");
    return { dia, inicio: h.inicio, fin: h.fin };
  });
}

function seCruzan(a, b) {
  return a.some((x) => b.some((y) => x.dia === y.dia && minutos(x.inicio) < minutos(y.fin) && minutos(y.inicio) < minutos(x.fin)));
}

function cupoEntero(valor, etiqueta = "El cupo") {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 300) throw new AppError(400, `${etiqueta} debe ser un número entre 1 y 300.`);
  return n;
}

function sello(tipoSnies, ip) {
  return { tipoSnies: tipoValido(tipoSnies), ip: String(ip || "desconocida").slice(0, 45), fechaInscripcion: new Date() };
}

function documentoValido(valor) {
  const n = String(valor || "").replace(/\D/g, "");
  if (n.length < 5 || n.length > 20) throw new AppError(400, "La cédula debe tener entre 5 y 20 dígitos.");
  return n;
}

function caracterizacionValida(valor) {
  const nombre = String(valor || "").trim();
  if (!CARACTERIZACIONES.includes(nombre)) throw new AppError(400, "La caracterización no está en el listado del área.");
  return nombre;
}

async function leerPerfil(usuarioId) {
  const perfil = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  const tipoSnies = perfil?.tipoSnies || 1;
  return {
    tipoSnies,
    tipo: nombreTipo(tipoSnies),
    tipos: require("./catalogo").TIPOS,
    documento: perfil?.documento || "",
    programa: perfil?.programa || "",
    caracterizacion: perfil?.caracterizacion || "No registra",
    caracterizaciones: CARACTERIZACIONES,
  };
}

async function guardarPerfil(usuarioId, body = {}) {
  const previo = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  const tipo = body.tipoSnies !== undefined && body.tipoSnies !== "" ? tipoValido(body.tipoSnies) : previo?.tipoSnies || 1;
  const documento = body.documento !== undefined ? (body.documento ? documentoValido(body.documento) : null) : previo?.documento || null;
  const programa = body.programa !== undefined ? (body.programa ? texto(body.programa, 150, "el programa") : null) : previo?.programa || null;
  const caracterizacion = body.caracterizacion !== undefined ? caracterizacionValida(body.caracterizacion || "No registra") : previo?.caracterizacion || "No registra";
  const data = { tipoSnies: tipo, documento, programa, caracterizacion };
  if (previo) await prisma.perfilCultural.update({ where: { usuarioId }, data });
  else await prisma.perfilCultural.create({ data: { usuarioId, ...data } });
  return leerPerfil(usuarioId);
}

async function tipoDe(usuarioId, indicado) {
  if (indicado !== undefined && indicado !== null && indicado !== "") return tipoValido(indicado);
  const perfil = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  return perfil?.tipoSnies || 1;
}

async function usuariosPorId(ids) {
  if (!ids.length) return new Map();
  const lista = await prisma.usuario.findMany({ where: { id: { in: ids } } });
  return new Map(lista.map((u) => [u.id, u]));
}

async function ofertaGrupos(usuarioId) {
  const periodo = periodoActual();
  const [areas, grupos, inscripciones, convocatorias] = await Promise.all([
    prisma.areaCultural.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    prisma.grupoCultural.findMany({ where: { periodo, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.inscripcionCultural.findMany({ where: { estado: "Activa" } }),
    prisma.convocatoriaCultural.findMany({ where: { estado: "Abierta" } }),
  ]);
  const categoriaDe = new Map(areas.map((a) => [a.id, a.categoria]));
  // El limite del periodo cuenta los talleres; a los representativos se entra por audicion.
  const talleres = new Set(grupos.filter((g) => categoriaDe.get(g.areaId) !== "representativo").map((g) => g.id));
  const inscritas = inscripciones.filter((i) => i.usuarioId === usuarioId && talleres.has(i.grupoId)).length;
  const audicionDe = (grupoId) => {
    const c = convocatorias.filter((x) => x.grupoId === grupoId && x.cierra >= hoy()).sort((a, b) => a.cierra - b.cierra)[0];
    return c ? { id: c.id, titulo: c.titulo, cierra: iso(c.cierra) } : null;
  };
  return {
    periodo,
    maxGrupos: MAX_GRUPOS,
    inscritas,
    areas: areas
      .map((area) => ({
        id: area.id,
        nombre: area.nombre,
        descripcion: area.descripcion,
        categoria: nombreCategoria(area.categoria),
        grupos: grupos
          .filter((g) => g.areaId === area.id)
          .map((g) => {
            const activas = inscripciones.filter((i) => i.grupoId === g.id);
            return {
              id: g.id,
              nombre: g.nombre,
              ingreso: area.categoria === "representativo" ? "audicion" : "libre",
              audicion: area.categoria === "representativo" ? audicionDe(g.id) : null,
              director: g.director,
              lugar: g.lugar,
              cupo: g.cupo,
              horario: g.horario,
              imagenUrl: fotoGrupo.urlImagen(g),
              fechaInicio: iso(g.fechaInicio),
              fechaFin: iso(g.fechaFin),
              inscripcionesAbiertas: g.inscripcionesAbiertas && !(g.fechaFin && g.fechaFin < hoy()),
              cuposDisponibles: Math.max(0, g.cupo - activas.length),
              inscrito: activas.some((i) => i.usuarioId === usuarioId),
            };
          }),
      }))
      .filter((a) => a.grupos.length),
  };
}

// Avisa al equipo de Cultura de una accion del estudiante (inscribirse, retirarse...). No bloquea ni falla.
async function avisarAccion(usuarioId, { grupo, evento }, titulo, verbo, objeto, ruta) {
  try {
    const persona = (await usuariosPorId([usuarioId])).get(usuarioId);
    await require("./ampliacion").avisarAlEquipo({ grupo, evento }, { titulo, mensaje: `${persona?.nombre || "Una persona"} ${verbo} ${objeto}.`, ruta });
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar la accion: ${err.message}`);
  }
}

async function inscribirGrupo(usuarioId, grupoId, auditoria = {}) {
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo || !grupo.activo || grupo.periodo !== periodoActual()) throw new AppError(404, "Ese grupo no está en la oferta de este periodo.");
  if (!grupo.inscripcionesAbiertas) throw new AppError(400, "Las inscripciones de este grupo están cerradas.");
  if (grupo.fechaFin && grupo.fechaFin < hoy()) throw new AppError(400, "Este taller ya terminó.");
  const areaGrupo = await prisma.areaCultural.findUnique({ where: { id: grupo.areaId } });
  if (areaGrupo?.categoria === "representativo") throw new AppError(400, `A ${grupo.nombre} se entra por audición: postúlate en su convocatoria.`);

  const inscripciones = await prisma.inscripcionCultural.findMany({ where: { estado: "Activa" } });
  const propias = inscripciones.filter((i) => i.usuarioId === usuarioId);
  if (propias.some((i) => i.grupoId === grupoId)) throw new AppError(409, "Ya estás inscrito en este grupo.");
  const gruposPeriodo = await prisma.grupoCultural.findMany({ where: { periodo: grupo.periodo, activo: true } });
  const idsPeriodo = new Set(gruposPeriodo.map((g) => g.id));
  const mias = gruposPeriodo.filter((g) => propias.some((i) => i.grupoId === g.id));
  const representativas = new Set((await prisma.areaCultural.findMany({ where: { categoria: "representativo" } })).map((a) => a.id));
  if (mias.filter((g) => !representativas.has(g.areaId)).length >= MAX_GRUPOS) throw new AppError(400, `Solo puedes estar en ${MAX_GRUPOS} grupos de cultura en el periodo.`);
  if (mias.some((g) => seCruzan(g.horario, grupo.horario))) throw new AppError(409, "Ese horario se cruza con otro grupo de cultura en el que ya estás.");
  if (inscripciones.filter((i) => i.grupoId === grupoId).length >= grupo.cupo) throw new AppError(409, "Este grupo ya no tiene cupos.");

  const marca = sello(await tipoDe(usuarioId, auditoria.tipoSnies), auditoria.ip);
  const previa = await prisma.inscripcionCultural.findFirst({ where: { grupoId, usuarioId } });
  if (previa) {
    await prisma.inscripcionCultural.update({ where: { id: previa.id }, data: { estado: "Activa", fechaRetiro: null, ...marca } });
  } else {
    await prisma.inscripcionCultural.create({ data: { grupoId, usuarioId, estado: "Activa", ...marca } });
  }
  await avisarAccion(usuarioId, { grupo }, "Nueva inscripción", "se inscribió en", grupo.nombre, "/cultura/grupos");
  return ofertaGrupos(usuarioId);
}

async function retirarGrupo(usuarioId, grupoId) {
  const previa = await prisma.inscripcionCultural.findFirst({ where: { grupoId, usuarioId, estado: "Activa" } });
  if (!previa) throw new AppError(404, "No estás inscrito en ese grupo.");
  await prisma.inscripcionCultural.update({ where: { id: previa.id }, data: { estado: "Retirada", fechaRetiro: new Date() } });
  const grupoRetirado = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  await avisarAccion(usuarioId, { grupo: grupoRetirado }, "Una inscripción se retiró", "se retiró de", grupoRetirado?.nombre || "un grupo", "/cultura/grupos");
  return ofertaGrupos(usuarioId);
}

// Un evento de hoy que ya terminó sale de la agenda (con 15 minutos de margen para marcar la asistencia).
function yaTermino(evento) {
  const ahora = new Date(Date.now() - 5 * 3600 * 1000);
  if (iso(evento.fecha) !== ahora.toISOString().slice(0, 10)) return false;
  const [h, m] = String(evento.horaFin || "").split(":").map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return false;
  return ahora.getUTCHours() * 60 + ahora.getUTCMinutes() > h * 60 + m + 15;
}

async function listarAgenda(usuarioId) {
  const desde = hoy();
  const [eventos, inscripciones] = await Promise.all([
    prisma.eventoCultural.findMany({ where: { estado: "Publicado" }, orderBy: { fecha: "asc" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  // Lo que viene, y de lo que ya se realizo, solo lo que la persona vivio (su historial): los eventos
  // en los que se inscribio, de los mas recientes a los mas antiguos (hasta 60).
  const paso = (e) => e.fecha < desde || yaTermino(e);
  const suyo = (e) => inscripciones.some((i) => i.eventoId === e.id && i.usuarioId === usuarioId);
  const historial = eventos.filter((e) => paso(e) && suyo(e)).sort((a, b) => (iso(b.fecha) + b.horaInicio).localeCompare(iso(a.fecha) + a.horaInicio)).slice(0, 60);
  return [...eventos.filter((e) => !paso(e)), ...historial]
    .map((e) => {
      const activas = inscripciones.filter((i) => i.eventoId === e.id);
      return {
        id: e.id,
        nombre: e.nombre,
        categoria: nombreCategoria(e.categoria),
        descripcion: e.descripcion,
        fecha: iso(e.fecha),
        horaInicio: e.horaInicio,
        horaFin: e.horaFin,
        lugar: e.lugar,
        representacion: e.representacion,
        categoriaId: e.categoria,
        grupoId: e.grupoId,
        imagenUrl: urlImagen(e),
        cupo: e.cupo,
        fechaLimite: iso(e.fechaLimite),
        cuposDisponibles: Math.max(0, e.cupo - activas.length),
        inscrito: activas.some((i) => i.usuarioId === usuarioId),
        asistio: activas.some((i) => i.usuarioId === usuarioId && i.asistio),
        abierta: e.fechaLimite >= desde,
        terminado: paso(e),
      };
    });
}

async function inscribirEvento(usuarioId, eventoId, auditoria = {}) {
  const evento = await prisma.eventoCultural.findUnique({ where: { id: eventoId } });
  if (!evento || evento.estado !== "Publicado") throw new AppError(404, "Ese evento no está publicado.");
  if (evento.fechaLimite < hoy()) throw new AppError(400, "Ya pasó la fecha límite de inscripción.");
  const activas = await prisma.inscripcionEventoCultural.findMany({ where: { eventoId, estado: "Activa" } });
  if (activas.some((i) => i.usuarioId === usuarioId)) throw new AppError(409, "Ya estás inscrito en este evento.");
  if (activas.length >= evento.cupo) throw new AppError(409, "Este evento ya no tiene cupos.");
  const marca = sello(await tipoDe(usuarioId, auditoria.tipoSnies), auditoria.ip);
  const previa = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId, usuarioId } });
  if (previa) await prisma.inscripcionEventoCultural.update({ where: { id: previa.id }, data: { estado: "Activa", ...marca } });
  else await prisma.inscripcionEventoCultural.create({ data: { eventoId, usuarioId, estado: "Activa", ...marca } });
  await avisarAccion(usuarioId, { evento }, "Nueva inscripción a un evento", "se inscribió en", evento.nombre, "/cultura/agenda");
  return listarAgenda(usuarioId);
}

async function cancelarEvento(usuarioId, eventoId) {
  const previa = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId, usuarioId, estado: "Activa" } });
  if (!previa) throw new AppError(404, "No estás inscrito en ese evento.");
  await prisma.inscripcionEventoCultural.update({ where: { id: previa.id }, data: { estado: "Cancelada" } });
  const eventoCancelado = await prisma.eventoCultural.findUnique({ where: { id: eventoId } });
  await avisarAccion(usuarioId, { evento: eventoCancelado }, "Una inscripción a un evento se canceló", "canceló su inscripción en", eventoCancelado?.nombre || "un evento", "/cultura/agenda");
  return listarAgenda(usuarioId);
}

async function listarConvocatorias(usuarioId) {
  const desde = hoy();
  const [lista, postulaciones, grupos, mias] = await Promise.all([
    prisma.convocatoriaCultural.findMany({ orderBy: { cierra: "asc" } }),
    prisma.postulacionCultural.findMany({ where: { usuarioId } }),
    prisma.grupoCultural.findMany(),
    prisma.inscripcionCultural.findMany({ where: { usuarioId, estado: "Activa" } }),
  ]);
  const grupoDe = new Map(grupos.map((g) => [g.id, g.nombre]));
  return lista
    .filter((c) => c.estado === "Abierta" && c.cierra >= desde)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      grupoId: c.grupoId,
      grupo: grupoDe.get(c.grupoId) || null,
      esMiembro: Boolean(c.grupoId && mias.some((i) => i.grupoId === c.grupoId)),
      descripcion: c.descripcion,
      cierra: iso(c.cierra),
      cupo: c.cupo,
      imagenUrl: fotoConvocatoria.urlImagen(c),
      postulacion: postulacionPublica(postulaciones.find((p) => p.convocatoriaId === c.id)),
    }));
}

async function postular(usuarioId, convocatoriaId, motivacion, auditoria = {}) {
  const textoMotivacion = texto(motivacion, 500, "la motivación");
  if (textoMotivacion.length < 10) throw new AppError(400, "Cuéntanos un poco más: la motivación debe tener al menos 10 caracteres.");
  const convocatoria = await prisma.convocatoriaCultural.findUnique({ where: { id: convocatoriaId } });
  if (!convocatoria || convocatoria.estado !== "Abierta" || convocatoria.cierra < hoy()) {
    throw new AppError(404, "Esa convocatoria no está abierta.");
  }
  const ya = await prisma.postulacionCultural.findFirst({ where: { convocatoriaId, usuarioId } });
  if (ya) throw new AppError(409, "Ya enviaste tu postulación a esta convocatoria.");
  if (convocatoria.grupoId && (await prisma.inscripcionCultural.findFirst({ where: { grupoId: convocatoria.grupoId, usuarioId, estado: "Activa" } }))) {
    throw new AppError(409, "Ya eres parte de este grupo.");
  }
  if (convocatoria.cupo) {
    const recibidas = await prisma.postulacionCultural.count({ where: { convocatoriaId, estado: { not: "Rechazada" } } });
    if (recibidas >= convocatoria.cupo) throw new AppError(409, "Esta convocatoria ya completó sus cupos.");
  }
  const marca = sello(await tipoDe(usuarioId, auditoria.tipoSnies), auditoria.ip);
  await prisma.postulacionCultural.create({
    data: { convocatoriaId, usuarioId, motivacion: textoMotivacion, estado: "Recibida", tipoSnies: marca.tipoSnies, ip: marca.ip, fecha: new Date() },
  });
  await avisarNuevaPostulacion(convocatoria, usuarioId);
  return listarConvocatorias(usuarioId);
}

function datosGrupo(body, previo) {
  const horario = horarioValido(body.horario ?? previo?.horario);
  const fechas = fechasTaller(body, previo);
  if (fechas.fechaInicio && fechas.fechaFin && !diaDelHorarioEnRango(horario, fechas.fechaInicio, fechas.fechaFin)) {
    throw new AppError(400, "Entre esas fechas no cae ningún día del horario. Revisa las fechas o los días.");
  }
  return {
    areaId: texto(body.areaId ?? previo?.areaId, 80, "el área"),
    periodo: validarPeriodo(body.periodo || previo?.periodo || periodoActual()),
    nombre: texto(body.nombre ?? previo?.nombre, 80, "el nombre del grupo"),
    director: body.director ? texto(body.director, 150, "el director") : previo?.director || null,
    lugar: body.lugar ? texto(body.lugar, 150, "el lugar") : previo?.lugar || null,
    cupo: body.cupo !== undefined ? cupoEntero(body.cupo) : previo?.cupo || 20,
    horario,
    inscripcionesAbiertas: body.inscripcionesAbiertas !== undefined ? Boolean(body.inscripcionesAbiertas) : previo?.inscripcionesAbiertas ?? true,
    activo: body.activo !== undefined ? Boolean(body.activo) : previo?.activo ?? true,
    ...fechas,
    ...datosSnies(body, previo),
  };
}

// Algun dia del horario (1 = lunes ... 7 = domingo) cae entre las dos fechas.
function diaDelHorarioEnRango(horario, desde, hasta) {
  const dias = new Set(horario.map((h) => h.dia));
  for (let t = desde.getTime(), n = 0; t <= hasta.getTime() && n < 7; t += 864e5, n++) {
    if (dias.has(((new Date(t).getUTCDay() + 6) % 7) + 1)) return true;
  }
  return false;
}

// Fechas opcionales del taller (si no dura todo el periodo). Vacias = todo el periodo.
function fechasTaller(body, previo) {
  const fecha = (clave, etiqueta) => {
    if (body[clave] === undefined) return previo?.[clave] ?? null;
    return body[clave] ? fechaDia(body[clave], etiqueta) : null;
  };
  const fechaInicio = fecha("fechaInicio", "La fecha de inicio");
  const fechaFin = fecha("fechaFin", "La fecha de fin");
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) throw new AppError(400, "La fecha de fin del taller no puede ser anterior a la de inicio.");
  return { fechaInicio, fechaFin };
}

// Codigo de la actividad y cedula del responsable, como los pide el SNIES.
function datosSnies(body, previo) {
  const valor = (clave, max, etiqueta) => (body[clave] !== undefined ? (body[clave] ? texto(body[clave], max, etiqueta) : null) : previo?.[clave] ?? null);
  // reportaSnies = false: actividad interna; no sale en la hoja SNIES pero si en gestion e historico.
  const reportaSnies = body.reportaSnies !== undefined ? body.reportaSnies !== false && body.reportaSnies !== "false" : previo?.reportaSnies ?? true;
  return { codigoSnies: valor("codigoSnies", 30, "el código SNIES"), documentoResponsable: valor("documentoResponsable", 30, "la cédula del responsable"), reportaSnies };
}

// Conteos de asistentes sin cuenta: para eventos de otros anos cargados desde el papel.
function conteosDe(body, previo) {
  const datos = {};
  for (const clave of ["conteoEstudiantes", "conteoDocentes", "conteoAdministrativos", "conteoEgresados"]) {
    if (body[clave] !== undefined && body[clave] !== "") {
      const n = Number(body[clave]);
      if (!Number.isInteger(n) || n < 0) throw new AppError(400, "Los conteos deben ser números enteros.");
      datos[clave] = n;
    } else if (previo) datos[clave] = previo[clave] ?? 0;
  }
  return datos;
}

function validarPeriodo(periodo) {
  const p = String(periodo || "").trim();
  if (!/^\d{4}-[12]$/.test(p)) throw new AppError(400, "El periodo debe tener la forma AAAA-1 o AAAA-2.");
  return p;
}

async function exigirArea(areaId) {
  const area = await prisma.areaCultural.findUnique({ where: { id: areaId } });
  if (!area || !area.activa) throw new AppError(400, "El área artística no existe.");
  return area;
}

async function crearGrupo(body) {
  const datos = datosGrupo(body);
  await exigirArea(datos.areaId);
  return prisma.grupoCultural.create({ data: datos });
}

async function editarGrupo(id, body) {
  const previo = await prisma.grupoCultural.findUnique({ where: { id } });
  if (!previo) throw new AppError(404, "No se encontró el grupo.");
  const datos = datosGrupo({ ...previo, horario: previo.horario, ...body }, previo);
  if (datos.areaId !== previo.areaId) await exigirArea(datos.areaId);
  return prisma.grupoCultural.update({ where: { id }, data: datos });
}

async function listarGruposAdmin(periodo) {
  const grupos = await prisma.grupoCultural.findMany({
    where: periodo ? { periodo } : {},
    orderBy: { nombre: "asc" },
  });
  const [areas, inscripciones] = await Promise.all([
    prisma.areaCultural.findMany(),
    prisma.inscripcionCultural.findMany({ where: { estado: "Activa", grupoId: { in: grupos.map((g) => g.id) } } }),
  ]);
  const personas = await usuariosPorId(inscripciones.map((i) => i.usuarioId));
  const porArea = new Map(areas.map((a) => [a.id, a.nombre]));
  return grupos.map(({ imagen, ...g }) => ({
    ...g,
    imagenUrl: fotoGrupo.urlImagen({ ...g, imagen }),
    horario: g.horario,
    area: porArea.get(g.areaId) || "",
    inscritos: inscripciones
      .filter((i) => i.grupoId === g.id)
      .map((i) => {
        const u = personas.get(i.usuarioId);
        return { usuarioId: i.usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "", tipoSnies: i.tipoSnies || 1, tipo: nombreTipo(i.tipoSnies || 1) };
      }),
    porTipo: contarPorTipo(inscripciones.filter((i) => i.grupoId === g.id)),
  }));
}

function contarPorTipo(inscripciones) {
  const cuenta = {};
  for (const i of inscripciones) {
    const nombre = nombreTipo(i.tipoSnies || 1);
    cuenta[nombre] = (cuenta[nombre] || 0) + 1;
  }
  return cuenta;
}

async function registrarAsistencia(grupoId, body, registradaPor, ip) {
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo.");
  const fecha = fechaDia(body.fecha, "La fecha");
  const presentes = Array.isArray(body.presentes) ? [...new Set(body.presentes)] : [];
  const inscritas = await prisma.inscripcionCultural.findMany({ where: { grupoId, estado: "Activa" } });
  const validos = new Map(inscritas.map((i) => [i.usuarioId, i]));
  if (presentes.some((id) => !validos.has(id))) throw new AppError(400, "Solo se marca la asistencia de quienes están inscritos.");
  let sesion = await prisma.sesionCultural.findFirst({ where: { grupoId, fecha } });
  if (!sesion) sesion = await prisma.sesionCultural.create({ data: { grupoId, fecha, registradaPor } });
  // Quien marco con su codigo no se pierde al guardar la lista del personal.
  else await prisma.asistenciaCultural.deleteMany({ where: { sesionId: sesion.id, origen: "Personal" } });
  const ahora = new Date();
  const direccion = String(ip || "desconocida").slice(0, 45);
  const conCodigo = new Set((await prisma.asistenciaCultural.findMany({ where: { sesionId: sesion.id } })).map((a) => a.usuarioId));
  for (const usuarioId of presentes.filter((id) => !conCodigo.has(id))) {
    await prisma.asistenciaCultural.create({
      data: { sesionId: sesion.id, usuarioId, presente: true, tipoSnies: validos.get(usuarioId).tipoSnies || 1, ip: direccion, origen: "Personal", fechaHora: ahora },
    });
  }
  return { sesionId: sesion.id, presentes: new Set([...presentes, ...conCodigo]).size, fechaHora: ahora, ip: direccion };
}

// Sitio donde se toma la asistencia (opcional): latitud, longitud y radio en metros.
function datosUbicacion(body) {
  if (body.latitud === undefined && body.longitud === undefined && body.radioM === undefined) return {};
  const radioM = body.radioM === undefined ? undefined : Number(body.radioM);
  if (radioM !== undefined && ![50, 100, 150, 200, 300].includes(radioM)) throw new AppError(400, "El radio puede ser de 50, 100, 150, 200 o 300 metros.");
  const vacio = (v) => v === null || v === "" || v === undefined;
  if (vacio(body.latitud) && vacio(body.longitud)) return { latitud: null, longitud: null, ...(radioM ? { radioM } : {}) };
  const latitud = Number(body.latitud);
  const longitud = Number(body.longitud);
  if (!Number.isFinite(latitud) || Math.abs(latitud) > 90 || !Number.isFinite(longitud) || Math.abs(longitud) > 180) throw new AppError(400, "La ubicación del sitio no es válida.");
  return { latitud, longitud, ...(radioM ? { radioM } : {}) };
}

function datosEvento(body, previo) {
  const horaInicio = body.horaInicio ?? previo?.horaInicio;
  const horaFin = body.horaFin ?? previo?.horaFin;
  minutos(horaInicio);
  if (minutos(horaFin) <= minutos(horaInicio)) throw new AppError(400, "La hora de fin debe ser posterior a la de inicio.");
  const estado = body.estado ?? previo?.estado ?? "Borrador";
  if (!["Borrador", "Publicado"].includes(estado)) throw new AppError(400, "El estado del evento debe ser Borrador o Publicado.");
  const categoria = body.categoria ?? previo?.categoria ?? "especial";
  if (!CATEGORIAS.some((c) => c.id === categoria)) throw new AppError(400, "La categoría de la actividad no es válida.");
  return {
    nombre: texto(body.nombre ?? previo?.nombre, 150, "el nombre"),
    descripcion: body.descripcion ? texto(body.descripcion, 1000, "la descripción") : previo?.descripcion || null,
    fecha: fechaDia(iso(body.fecha ?? previo?.fecha), "La fecha"),
    horaInicio,
    horaFin,
    lugar: body.lugar ? texto(body.lugar, 150, "el lugar") : previo?.lugar || null,
    cupo: body.cupo !== undefined ? cupoEntero(body.cupo) : previo?.cupo,
    fechaLimite: fechaDia(iso(body.fechaLimite ?? previo?.fechaLimite), "La fecha límite"),
    categoria,
    representacion: body.representacion ? texto(body.representacion, 300, "la representación artística") : previo?.representacion || null,
    grupoId: body.grupoId === "" ? null : body.grupoId ?? previo?.grupoId ?? null,
    estado,
    ...datosUbicacion(body),
    ...datosSnies(body, previo),
    ...conteosDe(body, previo),
  };
}

async function grupoExistente(grupoId) {
  if (!grupoId) return null;
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo de la representación artística.");
  return grupo.id;
}

async function crearEvento(body) {
  const datos = datosEvento(body);
  datos.grupoId = await grupoExistente(datos.grupoId);
  return prisma.eventoCultural.create({ data: datos });
}

async function editarEvento(id, body) {
  const previo = await prisma.eventoCultural.findUnique({ where: { id } });
  if (!previo) throw new AppError(404, "No se encontró el evento.");
  const datos = datosEvento(body, previo);
  datos.grupoId = await grupoExistente(datos.grupoId);
  return prisma.eventoCultural.update({ where: { id }, data: datos });
}

async function listarEventosAdmin() {
  const [eventos, inscripciones] = await Promise.all([
    prisma.eventoCultural.findMany({ orderBy: { fecha: "asc" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  return eventos.map(({ imagen, ...e }) => ({
    ...e,
    imagenUrl: urlImagen({ ...e, imagen }),
    fecha: iso(e.fecha),
    fechaLimite: iso(e.fechaLimite),
    inscritos: inscripciones.filter((i) => i.eventoId === e.id).length,
    porTipo: contarPorTipo(inscripciones.filter((i) => i.eventoId === e.id)),
    asistentes: inscripciones.filter((i) => i.eventoId === e.id && i.asistio).length,
  }));
}

// Agenda abierta al publico: el portal la muestra sin iniciar sesion.
async function agendaPublica() {
  const desde = hoy();
  const [eventos, inscripciones] = await Promise.all([
    prisma.eventoCultural.findMany({ where: { estado: "Publicado" }, orderBy: { fecha: "asc" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  return eventos
    .filter((e) => e.fecha >= desde && !yaTermino(e))
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      nombre: e.nombre,
      fecha: iso(e.fecha),
      horaInicio: e.horaInicio,
      lugar: e.lugar,
      categoria: nombreCategoria(e.categoria),
      imagenUrl: urlImagen(e),
      cuposDisponibles: Math.max(0, e.cupo - inscripciones.filter((i) => i.eventoId === e.id).length),
    }));
}

async function marcarAsistenciaEvento(eventoId, usuarioId, asistio) {
  const inscripcion = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(404, "Esa persona no está inscrita en el evento.");
  return prisma.inscripcionEventoCultural.update({ where: { id: inscripcion.id }, data: { asistio: Boolean(asistio), fechaAsistencia: asistio ? new Date() : null } });
}

function datosConvocatoria(body, previo) {
  const estado = body.estado ?? previo?.estado ?? "Abierta";
  if (!["Abierta", "Cerrada"].includes(estado)) throw new AppError(400, "El estado debe ser Abierta o Cerrada.");
  return {
    titulo: texto(body.titulo ?? previo?.titulo, 150, "el título"),
    descripcion: body.descripcion ? texto(body.descripcion, 1000, "la descripción") : previo?.descripcion || null,
    cierra: fechaDia(iso(body.cierra ?? previo?.cierra), "La fecha de cierre"),
    cupo: body.cupo === "" || body.cupo === null ? null : body.cupo !== undefined ? cupoEntero(body.cupo, "El cupo") : previo?.cupo ?? null,
    estado,
    grupoId: body.grupoId !== undefined ? body.grupoId || null : previo?.grupoId ?? null,
  };
}

async function grupoDeConvocatoria(grupoId) {
  if (!grupoId) return null;
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo de la convocatoria.");
  return grupo.id;
}

async function crearConvocatoria(body) {
  const datos = datosConvocatoria(body);
  datos.grupoId = await grupoDeConvocatoria(datos.grupoId);
  return prisma.convocatoriaCultural.create({ data: datos });
}

async function editarConvocatoria(id, body) {
  const previo = await prisma.convocatoriaCultural.findUnique({ where: { id } });
  if (!previo) throw new AppError(404, "No se encontró la convocatoria.");
  const datos = datosConvocatoria(body, previo);
  datos.grupoId = await grupoDeConvocatoria(datos.grupoId);
  return prisma.convocatoriaCultural.update({ where: { id }, data: datos });
}

// Audicion o entrevista agendada de una postulacion (null si aun no hay).
const audicionDe = (p) => (p.audicionFecha ? { fecha: iso(p.audicionFecha), hora: p.audicionHora, lugar: p.audicionLugar } : null);
const postulacionPublica = (p) => (p ? { id: p.id, estado: p.estado, fecha: iso(p.fecha), audicion: audicionDe(p), observacion: p.observacion || null } : null);

async function listarConvocatoriasAdmin() {
  const [lista, postulaciones, grupos] = await Promise.all([
    prisma.convocatoriaCultural.findMany({ orderBy: { cierra: "asc" } }),
    prisma.postulacionCultural.findMany(),
    prisma.grupoCultural.findMany(),
  ]);
  const personas = await usuariosPorId(postulaciones.map((p) => p.usuarioId));
  const grupoDe = new Map(grupos.map((g) => [g.id, g.nombre]));
  return lista.map(({ imagen, ...c }) => ({
    ...c,
    grupo: grupoDe.get(c.grupoId) || null,
    imagenUrl: fotoConvocatoria.urlImagen({ ...c, imagen }),
    cierra: iso(c.cierra),
    postulaciones: postulaciones
      .filter((p) => p.convocatoriaId === c.id)
      .map((p) => {
        const u = personas.get(p.usuarioId);
        return { id: p.id, usuarioId: p.usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "", motivacion: p.motivacion, estado: p.estado, audicion: audicionDe(p), observacion: p.observacion || null };
      }),
  }));
}

// Avisa a quien dirige el grupo de la audicion (o, sin grupo, a la coordinacion) que llego una postulacion.
async function avisarNuevaPostulacion(convocatoria, usuarioId) {
  try {
    const persona = (await usuariosPorId([usuarioId])).get(usuarioId);
    const grupo = convocatoria.grupoId ? await prisma.grupoCultural.findUnique({ where: { id: convocatoria.grupoId } }) : null;
    const destinos = grupo?.docenteEmail ? [grupo.docenteEmail] : await require("./ampliacion").correosDeAdministradores();
    for (const email of destinos) {
      await notificaciones.crearPorCorreo(email, { modulo: "cultura", tipo: "postulacion", titulo: "Nueva postulación", mensaje: `${persona?.nombre || "Una persona"} se postuló a ${convocatoria.titulo}.`, ruta: "/cultura/convocatorias" });
    }
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar la postulacion: ${err.message}`);
  }
}

// Avance de la postulacion: Recibida -> Citada (audicion agendada) -> Aceptada / Rechazada.
async function citarPostulacion(id, body = {}) {
  const previa = await prisma.postulacionCultural.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró la postulación.");
  if (!["Recibida", "Citada"].includes(previa.estado)) throw new AppError(409, "Esta postulación ya tiene una decisión.");
  const fecha = fechaDia(body.fecha, "La fecha de la audición");
  if (fecha < hoy()) throw new AppError(400, "La fecha de la audición no puede ser pasada.");
  minutos(body.hora);
  const lugar = texto(body.lugar, 120, "el lugar de la audición");
  const citada = await prisma.postulacionCultural.update({ where: { id }, data: { estado: "Citada", audicionFecha: fecha, audicionHora: body.hora, audicionLugar: lugar } });
  const convocatoria = await prisma.convocatoriaCultural.findUnique({ where: { id: previa.convocatoriaId } });
  await notificaciones.crear(previa.usuarioId, {
    modulo: "cultura",
    tipo: "audicion",
    titulo: "Te citaron a una audición",
    mensaje: `${convocatoria?.titulo || "Audición"}: ${fechaTexto(fecha)} a las ${body.hora} en ${lugar}.`,
    ruta: "/mi-cultura/convocatorias",
  });
  return citada;
}

async function resolverPostulacion(id, estado, observacion) {
  if (!["Aceptada", "Rechazada"].includes(estado)) throw new AppError(400, "La postulación se acepta o se rechaza.");
  const previa = await prisma.postulacionCultural.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró la postulación.");
  const nota = String(observacion || "").trim().slice(0, 300) || null;
  // En una audición de grupo, solo se acepta a quien ya fue citado y ya llegó el día de la audición.
  if (estado === "Aceptada") {
    const convocatoria = await prisma.convocatoriaCultural.findUnique({ where: { id: previa.convocatoriaId } });
    if (convocatoria?.grupoId) {
      if (previa.estado !== "Citada" || !previa.audicionFecha) throw new AppError(409, "Primero cita a la persona a una audición.");
      if (previa.audicionFecha > hoy()) throw new AppError(409, "Podrás aceptarla a partir del día de su audición.");
    }
  }
  const actualizada = await prisma.postulacionCultural.update({ where: { id }, data: { estado, observacion: nota } });
  if (estado === "Aceptada") {
    const convocatoria = await prisma.convocatoriaCultural.findUnique({ where: { id: previa.convocatoriaId } });
    if (convocatoria?.grupoId) {
      // La coordinacion ya decidio: entra al grupo aunque tenga talleres o el cupo este justo.
      const datos = { estado: "Activa", fechaRetiro: null, tipoSnies: previa.tipoSnies || 1, ip: previa.ip || "audicion", fechaInscripcion: new Date() };
      const existente = await prisma.inscripcionCultural.findFirst({ where: { grupoId: convocatoria.grupoId, usuarioId: previa.usuarioId } });
      if (existente) await prisma.inscripcionCultural.update({ where: { id: existente.id }, data: datos });
      else await prisma.inscripcionCultural.create({ data: { grupoId: convocatoria.grupoId, usuarioId: previa.usuarioId, ...datos } });
    }
  }
  const convocatoriaDecidida = await prisma.convocatoriaCultural.findUnique({ where: { id: previa.convocatoriaId } });
  const grupoDecidido = convocatoriaDecidida?.grupoId ? await prisma.grupoCultural.findUnique({ where: { id: convocatoriaDecidida.grupoId } }) : null;
  await notificaciones.crear(previa.usuarioId, {
    modulo: "cultura",
    tipo: "audicion",
    titulo: estado === "Aceptada" ? "¡Te aceptaron!" : "Resultado de tu postulación",
    mensaje:
      estado === "Aceptada"
        ? `Quedaste dentro de ${grupoDecidido?.nombre || convocatoriaDecidida?.titulo || "el grupo"}. ¡Bienvenido/a!${nota ? ` Comentario: ${nota}` : ""}`
        : `En esta ocasión no fuiste seleccionado/a en ${convocatoriaDecidida?.titulo || "la convocatoria"}.${nota ? ` Comentario: ${nota}` : ""}`,
    ruta: "/mi-cultura/convocatorias",
  });
  return actualizada;
}

// Programas que ya escribio la gente: el filtro de informes los ofrece al escribir.
async function listarProgramas() {
  const perfiles = await prisma.perfilCultural.findMany();
  return [...new Set(perfiles.map((p) => String(p.programa || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

// Solo las areas activas: las desactivadas (del primer catalogo) no admiten grupos nuevos.
async function listarAreas() {
  return prisma.areaCultural.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } });
}

async function resumenCultura() {
  const [inscripciones, eventos] = await Promise.all([
    prisma.inscripcionCultural.count({ where: { estado: "Activa" } }),
    prisma.eventoCultural.count({ where: { estado: "Publicado" } }),
  ]);
  return { inscripciones, eventos };
}

function dentroDelRango(valor, desde, hasta) {
  if (!desde && !hasta) return true;
  if (!valor) return false;
  const t = new Date(valor).getTime();
  if (desde && t < desde.getTime()) return false;
  if (hasta && t >= hasta.getTime() + 86400000) return false;
  return true;
}

async function informeSnies(filtro = {}) {
  const ExcelJS = require("exceljs");
  const { nombreTipo: tipo, nombreCategoria: cat } = require("./catalogo");
  const desde = filtro.desde ? fechaDia(filtro.desde, "La fecha inicial") : null;
  const hasta = filtro.hasta ? fechaDia(filtro.hasta, "La fecha final") : null;
  const [asistencias, sesiones, grupos, areas, usuariosLista, perfiles, eventos, asistentesEvento, pausas, representaciones, participantesRed] = await Promise.all([
    prisma.asistenciaCultural.findMany(),
    prisma.sesionCultural.findMany(),
    prisma.grupoCultural.findMany(),
    prisma.areaCultural.findMany(),
    prisma.usuario.findMany(),
    prisma.perfilCultural.findMany(),
    prisma.eventoCultural.findMany(),
    prisma.inscripcionEventoCultural.findMany({ where: { asistio: true } }),
    prisma.pausaCreativa.findMany(),
    prisma.representacionRed.findMany(),
    prisma.participanteRed.findMany(),
  ]);
  const sesionDe = new Map(sesiones.map((s) => [s.id, s]));
  const grupoDe = new Map(grupos.map((g) => [g.id, g]));
  const areaDe = new Map(areas.map((a) => [a.id, a]));
  const usuarioDe = new Map(usuariosLista.map((u) => [u.id, u]));
  const perfilDe = new Map(perfiles.map((p) => [p.usuarioId, p]));
  const filas = asistencias.filter((a) => dentroDelRango(a.fechaHora, desde, hasta)).map((a) => {
    const sesion = sesionDe.get(a.sesionId);
    const grupo = sesion ? grupoDe.get(sesion.grupoId) : null;
    const area = grupo ? areaDe.get(grupo.areaId) : null;
    const usuario = usuarioDe.get(a.usuarioId);
    const perfil = perfilDe.get(a.usuarioId);
    return {
      reporta: grupo?.reportaSnies !== false,
      actividadId: grupo?.id || "",
      codigoActividad: grupo?.codigoSnies || "",
      documento: grupo?.documentoResponsable || "",
      actividad: grupo?.nombre || "",
      categoria: cat(area?.categoria),
      codigo: a.tipoSnies || 1,
      tipo: tipo(a.tipoSnies || 1),
      nombre: usuario?.nombre || "",
      correo: usuario?.emailInstitucional || "",
      programa: perfil?.programa || "Sin programa",
      caracterizacion: perfil?.caracterizacion || "No registra",
      cuando: a.fechaHora ? new Date(a.fechaHora).toISOString() : "",
      ip: a.ip || "",
      usuarioId: a.usuarioId,
    };
  });
  // Los eventos cuentan igual que las sesiones de los grupos.
  const eventoDe = new Map(eventos.map((e) => [e.id, e]));
  for (const a of asistentesEvento) {
    const evento = eventoDe.get(a.eventoId);
    const cuando = a.fechaAsistencia || evento?.fecha;
    if (!evento || !dentroDelRango(cuando, desde, hasta)) continue;
    const usuario = usuarioDe.get(a.usuarioId);
    const perfil = perfilDe.get(a.usuarioId);
    filas.push({
      reporta: evento.reportaSnies !== false,
      actividadId: evento.id,
      codigoActividad: evento.codigoSnies || "",
      documento: evento.documentoResponsable || "",
      actividad: evento.nombre,
      categoria: cat(evento.categoria),
      codigo: a.tipoSnies || 1,
      tipo: tipo(a.tipoSnies || 1),
      nombre: usuario?.nombre || "",
      correo: usuario?.emailInstitucional || "",
      programa: perfil?.programa || "Sin programa",
      caracterizacion: perfil?.caracterizacion || "No registra",
      cuando: new Date(cuando).toISOString(),
      ip: a.ipAsistencia || "",
      usuarioId: a.usuarioId,
    });
  }
  // Delegaciones a las redes: quienes representaron a la Universidad.
  const representacionDe = new Map(representaciones.map((r) => [r.id, r]));
  for (const p of participantesRed) {
    const r = representacionDe.get(p.representacionId);
    if (!r || !dentroDelRango(r.fecha, desde, hasta)) continue;
    const usuario = usuarioDe.get(p.usuarioId);
    const perfil = perfilDe.get(p.usuarioId);
    const codigo = perfil?.tipoSnies || 1;
    filas.push({
      reporta: true,
      actividadId: r.id,
      codigoActividad: "",
      documento: "",
      actividad: `${r.red}: ${r.nombre}`,
      categoria: cat("representativo"),
      codigo,
      tipo: tipo(codigo),
      nombre: usuario?.nombre || "",
      correo: usuario?.emailInstitucional || "",
      programa: perfil?.programa || "Sin programa",
      caracterizacion: perfil?.caracterizacion || "No registra",
      cuando: new Date(r.fecha).toISOString(),
      ip: "",
      usuarioId: p.usuarioId,
    });
  }

  // Hoja SNIES: una fila por actividad y tipo de persona, con las personas sin
  // repetir en el periodo (si alguien vino a diez sesiones, cuenta una vez).
  const snies = new Map();
  const filaSnies = (id, base, codigo) => {
    const clave = `${id}|${codigo}`;
    if (!snies.has(clave)) snies.set(clave, { ...base, codigo, tipo: tipo(codigo), personas: new Set(), sinCuenta: 0 });
    return snies.get(clave);
  };
  for (const f of filas) if (f.reporta) filaSnies(f.actividadId, f, f.codigo).personas.add(f.usuarioId);
  const sumarConteos = (id, base, fila) =>
    [fila.conteoEstudiantes, fila.conteoDocentes, fila.conteoAdministrativos, fila.conteoEgresados].forEach((n, i) => {
      if (n) filaSnies(id, base, i + 1).sinCuenta += n;
    });
  for (const s of sesiones) {
    const g = grupoDe.get(s.grupoId);
    if (g && g.reportaSnies !== false && dentroDelRango(s.fecha, desde, hasta)) sumarConteos(g.id, { actividad: g.nombre, categoria: cat(areaDe.get(g.areaId)?.categoria), codigoActividad: g.codigoSnies || "", documento: g.documentoResponsable || "" }, s);
  }
  for (const e of eventos) {
    if (e.reportaSnies !== false && dentroDelRango(e.fecha, desde, hasta)) sumarConteos(e.id, { actividad: e.nombre, categoria: cat(e.categoria), codigoActividad: e.codigoSnies || "", documento: e.documentoResponsable || "" }, e);
  }
  for (const p of pausas) {
    if (dentroDelRango(p.fecha, desde, hasta) && p.impactoEstimado) filaSnies(p.id, { actividad: `Pausa creativa: ${p.tecnica}`, categoria: cat("itinerante"), codigoActividad: "", documento: "" }, 1).sinCuenta += p.impactoEstimado;
  }

  const libro = new ExcelJS.Workbook();
  const hojaSnies = libro.addWorksheet("SNIES");
  hojaSnies.addRow(["Cédula del responsable", "Código de la actividad", "Actividad", "Categoría", "Código del tipo", "Tipo de persona", "Cantidad"]);
  for (const f of snies.values()) hojaSnies.addRow([f.documento, f.codigoActividad, f.actividad, f.categoria, f.codigo, f.tipo, f.personas.size + f.sinCuenta]);
  hojaSnies.getRow(1).font = { bold: true };
  const detalle = libro.addWorksheet("ASISTENCIA");
  detalle.addRow(["Codigos de esta ficha de Cultura: 1 Estudiante, 2 Docente, 3 Administrativo, 4 Egresado. La plantilla SNIES que usa Salud numera egresado 2, docente 3 y administrativo 4. Confirmar antes de cargar al Ministerio."]);
  detalle.addRow(["Actividad", "Categoria", "Codigo SNIES", "Tipo de usuario", "Nombre", "Correo", "Programa", "Caracterizacion", "Fecha y hora", "IP", "ID de usuario"]);
  for (const f of filas) detalle.addRow([f.actividad, f.categoria, f.codigo, f.tipo, f.nombre, f.correo, f.programa, f.caracterizacion, f.cuando, f.ip, f.usuarioId]);
  const resumen = libro.addWorksheet("RESUMEN");
  resumen.addRow(["Actividad", "Categoria", "Codigo SNIES", "Tipo de usuario", "Asistencias"]);
  const cuentas = new Map();
  for (const f of filas) {
    const clave = `${f.actividad}|${f.codigo}`;
    cuentas.set(clave, { ...f, total: (cuentas.get(clave)?.total || 0) + 1 });
  }
  // Asistentes sin cuenta: solo como totales, porque no se sabe quienes son.
  const sumarSinCuenta = (actividad, categoria, fila) => {
    [fila.conteoEstudiantes, fila.conteoDocentes, fila.conteoAdministrativos, fila.conteoEgresados].forEach((n, i) => {
      if (!n) return;
      const clave = `${actividad}|${i + 1}`;
      const base = cuentas.get(clave) || { actividad, categoria, codigo: i + 1, tipo: tipo(i + 1), total: 0 };
      cuentas.set(clave, { ...base, total: base.total + n });
    });
  };
  for (const s of sesiones) {
    const grupo = grupoDe.get(s.grupoId);
    if (grupo && dentroDelRango(s.fecha, desde, hasta)) sumarSinCuenta(grupo.nombre, cat(areaDe.get(grupo.areaId)?.categoria), s);
  }
  for (const e of eventos) if (dentroDelRango(e.fecha, desde, hasta)) sumarSinCuenta(e.nombre, cat(e.categoria), e);
  for (const f of cuentas.values()) resumen.addRow([f.actividad, f.categoria, f.codigo, f.tipo, f.total]);
  const porPrograma = libro.addWorksheet("PROGRAMA");
  porPrograma.addRow(["Programa", "Estudiante", "Correo", "Asistencias confirmadas"]);
  const personas = new Map();
  for (const f of filas) {
    const clave = `${f.programa}|${f.usuarioId}`;
    personas.set(clave, { ...f, total: (personas.get(clave)?.total || 0) + 1 });
  }
  for (const f of personas.values()) porPrograma.addRow([f.programa, f.nombre, f.correo, f.total]);
  const inclusion = libro.addWorksheet("INCLUSION");
  inclusion.addRow(["Caracterizacion", "Personas con asistencia"]);
  const porCaracter = new Map();
  for (const f of personas.values()) porCaracter.set(f.caracterizacion, (porCaracter.get(f.caracterizacion) || 0) + 1);
  for (const [nombre, total] of porCaracter) inclusion.addRow([nombre, total]);
  if (filtro.formato === "csv") {
    const encabezado = ["Actividad", "Categoria", "Codigo SNIES", "Tipo", "Nombre", "Correo", "Programa", "Caracterizacion", "Fecha y hora", "IP", "ID"];
    const lineas = [encabezado, ...filas.map((f) => [f.actividad, f.categoria, f.codigo, f.tipo, f.nombre, f.correo, f.programa, f.caracterizacion, f.cuando, f.ip, f.usuarioId])];
    return lineas.map((linea) => linea.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  }
  return libro.xlsx.writeBuffer();
}

module.exports = {
  ofertaGrupos,
  inscribirGrupo,
  retirarGrupo,
  listarAgenda,
  inscribirEvento,
  cancelarEvento,
  listarConvocatorias,
  postular,
  crearGrupo,
  editarGrupo,
  listarGruposAdmin,
  registrarAsistencia,
  crearEvento,
  editarEvento,
  listarEventosAdmin,
  marcarAsistenciaEvento,
  crearConvocatoria,
  editarConvocatoria,
  listarConvocatoriasAdmin,
  resolverPostulacion,
  citarPostulacion,
  listarAreas,
  listarProgramas,
  agendaPublica,
  resumenCultura,
  periodoActual,
  leerPerfil,
  guardarPerfil,
  informeSnies,
};
