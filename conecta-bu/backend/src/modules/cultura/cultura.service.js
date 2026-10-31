const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const { periodoActual, iso } = require("./periodo");
const { tipoValido, nombreTipo, nombreCategoria, CATEGORIAS } = require("./catalogo");

const MAX_GRUPOS = 2;

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

async function leerPerfil(usuarioId) {
  const perfil = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  const tipoSnies = perfil?.tipoSnies || 1;
  return { tipoSnies, tipo: nombreTipo(tipoSnies), tipos: require("./catalogo").TIPOS };
}

async function guardarPerfil(usuarioId, tipoSnies) {
  const tipo = tipoValido(tipoSnies);
  const previo = await prisma.perfilCultural.findFirst({ where: { usuarioId } });
  if (previo) await prisma.perfilCultural.update({ where: { usuarioId }, data: { tipoSnies: tipo } });
  else await prisma.perfilCultural.create({ data: { usuarioId, tipoSnies: tipo } });
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
  const [areas, grupos, inscripciones] = await Promise.all([
    prisma.areaCultural.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    prisma.grupoCultural.findMany({ where: { periodo, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.inscripcionCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  const delPeriodo = new Set(grupos.map((g) => g.id));
  const inscritas = inscripciones.filter((i) => i.usuarioId === usuarioId && delPeriodo.has(i.grupoId)).length;
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
              director: g.director,
              lugar: g.lugar,
              cupo: g.cupo,
              horario: g.horario,
              inscripcionesAbiertas: g.inscripcionesAbiertas,
              cuposDisponibles: Math.max(0, g.cupo - activas.length),
              inscrito: activas.some((i) => i.usuarioId === usuarioId),
            };
          }),
      }))
      .filter((a) => a.grupos.length),
  };
}

async function inscribirGrupo(usuarioId, grupoId, auditoria = {}) {
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo || !grupo.activo || grupo.periodo !== periodoActual()) throw new AppError(404, "Ese grupo no está en la oferta de este periodo.");
  if (!grupo.inscripcionesAbiertas) throw new AppError(400, "Las inscripciones de este grupo están cerradas.");

  const inscripciones = await prisma.inscripcionCultural.findMany({ where: { estado: "Activa" } });
  const propias = inscripciones.filter((i) => i.usuarioId === usuarioId);
  if (propias.some((i) => i.grupoId === grupoId)) throw new AppError(409, "Ya estás inscrito en este grupo.");
  const gruposPeriodo = await prisma.grupoCultural.findMany({ where: { periodo: grupo.periodo, activo: true } });
  const idsPeriodo = new Set(gruposPeriodo.map((g) => g.id));
  const mias = gruposPeriodo.filter((g) => propias.some((i) => i.grupoId === g.id));
  if (mias.length >= MAX_GRUPOS) throw new AppError(400, `Solo puedes estar en ${MAX_GRUPOS} grupos de cultura en el periodo.`);
  if (mias.some((g) => seCruzan(g.horario, grupo.horario))) throw new AppError(409, "Ese horario se cruza con otro grupo de cultura en el que ya estás.");
  if (inscripciones.filter((i) => i.grupoId === grupoId).length >= grupo.cupo) throw new AppError(409, "Este grupo ya no tiene cupos.");

  const marca = sello(await tipoDe(usuarioId, auditoria.tipoSnies), auditoria.ip);
  const previa = await prisma.inscripcionCultural.findFirst({ where: { grupoId, usuarioId } });
  if (previa) {
    await prisma.inscripcionCultural.update({ where: { id: previa.id }, data: { estado: "Activa", fechaRetiro: null, ...marca } });
  } else {
    await prisma.inscripcionCultural.create({ data: { grupoId, usuarioId, estado: "Activa", ...marca } });
  }
  return ofertaGrupos(usuarioId);
}

async function retirarGrupo(usuarioId, grupoId) {
  const previa = await prisma.inscripcionCultural.findFirst({ where: { grupoId, usuarioId, estado: "Activa" } });
  if (!previa) throw new AppError(404, "No estás inscrito en ese grupo.");
  await prisma.inscripcionCultural.update({ where: { id: previa.id }, data: { estado: "Retirada", fechaRetiro: new Date() } });
  return ofertaGrupos(usuarioId);
}

async function listarAgenda(usuarioId) {
  const desde = hoy();
  const [eventos, inscripciones] = await Promise.all([
    prisma.eventoCultural.findMany({ where: { estado: "Publicado" }, orderBy: { fecha: "asc" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  return eventos
    .filter((e) => e.fecha >= desde)
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
        cupo: e.cupo,
        fechaLimite: iso(e.fechaLimite),
        cuposDisponibles: Math.max(0, e.cupo - activas.length),
        inscrito: activas.some((i) => i.usuarioId === usuarioId),
        abierta: e.fechaLimite >= desde,
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
  return listarAgenda(usuarioId);
}

async function cancelarEvento(usuarioId, eventoId) {
  const previa = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId, usuarioId, estado: "Activa" } });
  if (!previa) throw new AppError(404, "No estás inscrito en ese evento.");
  await prisma.inscripcionEventoCultural.update({ where: { id: previa.id }, data: { estado: "Cancelada" } });
  return listarAgenda(usuarioId);
}

async function listarConvocatorias(usuarioId) {
  const desde = hoy();
  const [lista, postulaciones] = await Promise.all([
    prisma.convocatoriaCultural.findMany({ orderBy: { cierra: "asc" } }),
    prisma.postulacionCultural.findMany({ where: { usuarioId } }),
  ]);
  return lista
    .filter((c) => c.estado === "Abierta" && c.cierra >= desde)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      descripcion: c.descripcion,
      cierra: iso(c.cierra),
      cupo: c.cupo,
      postulacion: postulaciones.find((p) => p.convocatoriaId === c.id) || null,
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
  if (convocatoria.cupo) {
    const recibidas = await prisma.postulacionCultural.count({ where: { convocatoriaId, estado: { not: "Rechazada" } } });
    if (recibidas >= convocatoria.cupo) throw new AppError(409, "Esta convocatoria ya completó sus cupos.");
  }
  const marca = sello(await tipoDe(usuarioId, auditoria.tipoSnies), auditoria.ip);
  await prisma.postulacionCultural.create({
    data: { convocatoriaId, usuarioId, motivacion: textoMotivacion, estado: "Recibida", tipoSnies: marca.tipoSnies, ip: marca.ip, fecha: new Date() },
  });
  return listarConvocatorias(usuarioId);
}

function datosGrupo(body, previo) {
  const horario = horarioValido(body.horario ?? previo?.horario);
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
  };
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
  return grupos.map((g) => ({
    ...g,
    horario: g.horario,
    area: porArea.get(g.areaId) || "",
    inscritos: inscripciones
      .filter((i) => i.grupoId === g.id)
      .map((i) => {
        const u = personas.get(i.usuarioId);
        return { usuarioId: i.usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "" };
      }),
  }));
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
  else await prisma.asistenciaCultural.deleteMany({ where: { sesionId: sesion.id } });
  const ahora = new Date();
  const direccion = String(ip || "desconocida").slice(0, 45);
  for (const usuarioId of presentes) {
    await prisma.asistenciaCultural.create({
      data: { sesionId: sesion.id, usuarioId, presente: true, tipoSnies: validos.get(usuarioId).tipoSnies || 1, ip: direccion, fechaHora: ahora },
    });
  }
  return { sesionId: sesion.id, presentes: presentes.length, fechaHora: ahora, ip: direccion };
}

async function marcarPropia(usuarioId, grupoId, ip) {
  const inscripcion = await prisma.inscripcionCultural.findFirst({ where: { grupoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(404, "Inscríbete al grupo antes de registrar la asistencia.");
  const fecha = hoy();
  let sesion = await prisma.sesionCultural.findFirst({ where: { grupoId, fecha } });
  if (!sesion) sesion = await prisma.sesionCultural.create({ data: { grupoId, fecha, registradaPor: "asistencia-en-linea" } });
  const ya = await prisma.asistenciaCultural.findFirst({ where: { sesionId: sesion.id, usuarioId } });
  if (ya) throw new AppError(409, "Ya registraste tu asistencia de hoy en este grupo.");
  const fila = await prisma.asistenciaCultural.create({
    data: {
      sesionId: sesion.id,
      usuarioId,
      presente: true,
      tipoSnies: inscripcion.tipoSnies || 1,
      ip: String(ip || "desconocida").slice(0, 45),
      fechaHora: new Date(),
    },
  });
  return { id: fila.id, fechaHora: fila.fechaHora, ip: fila.ip, tipoSnies: fila.tipoSnies };
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
    estado,
  };
}

async function crearEvento(body) {
  return prisma.eventoCultural.create({ data: datosEvento(body) });
}

async function editarEvento(id, body) {
  const previo = await prisma.eventoCultural.findUnique({ where: { id } });
  if (!previo) throw new AppError(404, "No se encontró el evento.");
  return prisma.eventoCultural.update({ where: { id }, data: datosEvento(body, previo) });
}

async function listarEventosAdmin() {
  const [eventos, inscripciones] = await Promise.all([
    prisma.eventoCultural.findMany({ orderBy: { fecha: "asc" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
  ]);
  return eventos.map((e) => ({
    ...e,
    fecha: iso(e.fecha),
    fechaLimite: iso(e.fechaLimite),
    inscritos: inscripciones.filter((i) => i.eventoId === e.id).length,
  }));
}

async function marcarAsistenciaEvento(eventoId, usuarioId, asistio) {
  const inscripcion = await prisma.inscripcionEventoCultural.findFirst({ where: { eventoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(404, "Esa persona no está inscrita en el evento.");
  return prisma.inscripcionEventoCultural.update({ where: { id: inscripcion.id }, data: { asistio: Boolean(asistio) } });
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
  };
}

async function crearConvocatoria(body) {
  return prisma.convocatoriaCultural.create({ data: datosConvocatoria(body) });
}

async function editarConvocatoria(id, body) {
  const previo = await prisma.convocatoriaCultural.findUnique({ where: { id } });
  if (!previo) throw new AppError(404, "No se encontró la convocatoria.");
  return prisma.convocatoriaCultural.update({ where: { id }, data: datosConvocatoria(body, previo) });
}

async function listarConvocatoriasAdmin() {
  const [lista, postulaciones] = await Promise.all([
    prisma.convocatoriaCultural.findMany({ orderBy: { cierra: "asc" } }),
    prisma.postulacionCultural.findMany(),
  ]);
  const personas = await usuariosPorId(postulaciones.map((p) => p.usuarioId));
  return lista.map((c) => ({
    ...c,
    cierra: iso(c.cierra),
    postulaciones: postulaciones
      .filter((p) => p.convocatoriaId === c.id)
      .map((p) => {
        const u = personas.get(p.usuarioId);
        return { id: p.id, usuarioId: p.usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "", motivacion: p.motivacion, estado: p.estado };
      }),
  }));
}

async function resolverPostulacion(id, estado) {
  if (!["Aceptada", "Rechazada"].includes(estado)) throw new AppError(400, "La postulación se acepta o se rechaza.");
  const previa = await prisma.postulacionCultural.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró la postulación.");
  return prisma.postulacionCultural.update({ where: { id }, data: { estado } });
}

async function listarAreas() {
  return prisma.areaCultural.findMany({ orderBy: { nombre: "asc" } });
}

async function resumenCultura() {
  const [inscripciones, eventos] = await Promise.all([
    prisma.inscripcionCultural.count({ where: { estado: "Activa" } }),
    prisma.eventoCultural.count({ where: { estado: "Publicado" } }),
  ]);
  return { inscripciones, eventos };
}

async function informeSnies() {
  const ExcelJS = require("exceljs");
  const { nombreTipo: tipo, nombreCategoria: cat } = require("./catalogo");
  const [asistencias, sesiones, grupos, areas, usuariosLista] = await Promise.all([
    prisma.asistenciaCultural.findMany(),
    prisma.sesionCultural.findMany(),
    prisma.grupoCultural.findMany(),
    prisma.areaCultural.findMany(),
    prisma.usuario.findMany(),
  ]);
  const sesionDe = new Map(sesiones.map((s) => [s.id, s]));
  const grupoDe = new Map(grupos.map((g) => [g.id, g]));
  const areaDe = new Map(areas.map((a) => [a.id, a]));
  const usuarioDe = new Map(usuariosLista.map((u) => [u.id, u]));
  const filas = asistencias.map((a) => {
    const sesion = sesionDe.get(a.sesionId);
    const grupo = sesion ? grupoDe.get(sesion.grupoId) : null;
    const area = grupo ? areaDe.get(grupo.areaId) : null;
    const usuario = usuarioDe.get(a.usuarioId);
    return {
      actividad: grupo?.nombre || "",
      categoria: cat(area?.categoria),
      codigo: a.tipoSnies || 1,
      tipo: tipo(a.tipoSnies || 1),
      nombre: usuario?.nombre || "",
      correo: usuario?.emailInstitucional || "",
      cuando: a.fechaHora ? new Date(a.fechaHora).toISOString() : "",
      ip: a.ip || "",
      usuarioId: a.usuarioId,
    };
  });
  const libro = new ExcelJS.Workbook();
  const detalle = libro.addWorksheet("ASISTENCIA");
  detalle.addRow(["Codigos de esta ficha de Cultura: 1 Estudiante, 2 Docente, 3 Administrativo, 4 Egresado. La plantilla SNIES que usa Salud numera egresado 2, docente 3 y administrativo 4. Confirmar antes de cargar al Ministerio."]);
  detalle.addRow(["Actividad", "Categoria", "Codigo SNIES", "Tipo de usuario", "Nombre", "Correo", "Fecha y hora", "IP", "ID de usuario"]);
  for (const f of filas) detalle.addRow([f.actividad, f.categoria, f.codigo, f.tipo, f.nombre, f.correo, f.cuando, f.ip, f.usuarioId]);
  const resumen = libro.addWorksheet("RESUMEN");
  resumen.addRow(["Actividad", "Categoria", "Codigo SNIES", "Tipo de usuario", "Asistencias"]);
  const cuentas = new Map();
  for (const f of filas) {
    const clave = `${f.actividad}|${f.codigo}`;
    cuentas.set(clave, { ...f, total: (cuentas.get(clave)?.total || 0) + 1 });
  }
  for (const f of cuentas.values()) resumen.addRow([f.actividad, f.categoria, f.codigo, f.tipo, f.total]);
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
  listarAreas,
  resumenCultura,
  periodoActual,
  leerPerfil,
  guardarPerfil,
  marcarPropia,
  informeSnies,
};
