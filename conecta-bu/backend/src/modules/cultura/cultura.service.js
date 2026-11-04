const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const { periodoActual, iso } = require("./periodo");
const { tipoValido, nombreTipo, nombreCategoria, CATEGORIAS, CARACTERIZACIONES } = require("./catalogo");
const { urlImagen } = require("./imagen");

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
        representacion: e.representacion,
        categoriaId: e.categoria,
        grupoId: e.grupoId,
        imagenUrl: urlImagen(e),
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
    ...datosSnies(body, previo),
  };
}

// Codigo de la actividad y cedula del responsable, como los pide el SNIES.
function datosSnies(body, previo) {
  const valor = (clave, max, etiqueta) => (body[clave] !== undefined ? (body[clave] ? texto(body[clave], max, etiqueta) : null) : previo?.[clave] ?? null);
  return { codigoSnies: valor("codigoSnies", 30, "el código SNIES"), documentoResponsable: valor("documentoResponsable", 30, "la cédula del responsable") };
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
  return grupos.map((g) => ({
    ...g,
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
    .filter((e) => e.fecha >= desde)
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

// Programas que ya escribio la gente: el filtro de informes los ofrece al escribir.
async function listarProgramas() {
  const perfiles = await prisma.perfilCultural.findMany();
  return [...new Set(perfiles.map((p) => String(p.programa || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
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
  for (const f of filas) filaSnies(f.actividadId, f, f.codigo).personas.add(f.usuarioId);
  const sumarConteos = (id, base, fila) =>
    [fila.conteoEstudiantes, fila.conteoDocentes, fila.conteoAdministrativos, fila.conteoEgresados].forEach((n, i) => {
      if (n) filaSnies(id, base, i + 1).sinCuenta += n;
    });
  for (const s of sesiones) {
    const g = grupoDe.get(s.grupoId);
    if (g && dentroDelRango(s.fecha, desde, hasta)) sumarConteos(g.id, { actividad: g.nombre, categoria: cat(areaDe.get(g.areaId)?.categoria), codigoActividad: g.codigoSnies || "", documento: g.documentoResponsable || "" }, s);
  }
  for (const e of eventos) {
    if (dentroDelRango(e.fecha, desde, hasta)) sumarConteos(e.id, { actividad: e.nombre, categoria: cat(e.categoria), codigoActividad: e.codigoSnies || "", documento: e.documentoResponsable || "" }, e);
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
  listarAreas,
  listarProgramas,
  agendaPublica,
  resumenCultura,
  periodoActual,
  leerPerfil,
  guardarPerfil,
  informeSnies,
};
