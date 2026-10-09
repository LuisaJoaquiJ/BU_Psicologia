const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { aFechaUTC, hoyBogota } = require("../../common/utils/fechas");
const u = require("./deporte.util");

// Modulo Deporte: oferta de disciplinas por grupos, inscripciones, asistencia
// por sesion y control de las horas que cada estudiante debe completar.

const fechaISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const texto = (v, max) => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

// ---- Configuracion -----------------------------------------------------------
async function obtenerConfig() {
  const config = await prisma.configDeporte.findUnique({ where: { id: 1 } });
  return config || { id: 1, horasRequeridas: 40, maxGruposPorPeriodo: 2 };
}

async function guardarConfig({ horasRequeridas, maxGruposPorPeriodo } = {}) {
  const data = {};
  if (horasRequeridas !== undefined) {
    const n = Number(horasRequeridas);
    if (!Number.isInteger(n) || n < 1 || n > 500) throw new AppError(400, "Las horas requeridas deben estar entre 1 y 500.");
    data.horasRequeridas = n;
  }
  if (maxGruposPorPeriodo !== undefined) {
    const n = Number(maxGruposPorPeriodo);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new AppError(400, "El máximo de grupos por periodo debe estar entre 1 y 10.");
    data.maxGruposPorPeriodo = n;
  }
  const actual = await prisma.configDeporte.findUnique({ where: { id: 1 } });
  if (actual) await prisma.configDeporte.update({ where: { id: 1 }, data });
  else await prisma.configDeporte.create({ data: { id: 1, horasRequeridas: 40, maxGruposPorPeriodo: 2, ...data } });
  return obtenerConfig();
}

// ---- Disciplinas -------------------------------------------------------------
async function listarDisciplinas({ incluirInactivas } = {}) {
  const lista = await prisma.disciplinaDeportiva.findMany({ where: incluirInactivas ? {} : { activa: true }, orderBy: { nombre: "asc" } });
  return lista;
}

function datosDisciplina(cuerpo = {}, parcial = false) {
  const data = {};
  if (!parcial || cuerpo.nombre !== undefined) {
    data.nombre = texto(cuerpo.nombre, 80);
    if (!data.nombre) throw new AppError(400, "Escribe el nombre de la disciplina.");
  }
  if (cuerpo.descripcion !== undefined) data.descripcion = texto(cuerpo.descripcion, 600);
  if (!parcial || cuerpo.tipo !== undefined) {
    data.tipo = cuerpo.tipo || "Individual";
    if (!u.TIPOS.includes(data.tipo)) throw new AppError(400, "El tipo debe ser Individual, Colectivo o Mental.");
  }
  if (cuerpo.activa !== undefined) data.activa = cuerpo.activa === true;
  return data;
}

async function crearDisciplina(cuerpo) {
  const data = datosDisciplina(cuerpo);
  const existe = (await prisma.disciplinaDeportiva.findMany()).find((d) => d.nombre.toLowerCase() === data.nombre.toLowerCase());
  if (existe) throw new AppError(409, `Ya existe la disciplina ${existe.nombre}.`);
  return prisma.disciplinaDeportiva.create({ data });
}

async function actualizarDisciplina(id, cuerpo) {
  const disciplina = await prisma.disciplinaDeportiva.findUnique({ where: { id } });
  if (!disciplina) throw new AppError(404, "La disciplina no existe.");
  const data = datosDisciplina(cuerpo, true);
  if (data.nombre) {
    const existe = (await prisma.disciplinaDeportiva.findMany()).find((d) => d.id !== id && d.nombre.toLowerCase() === data.nombre.toLowerCase());
    if (existe) throw new AppError(409, `Ya existe la disciplina ${existe.nombre}.`);
  }
  return prisma.disciplinaDeportiva.update({ where: { id }, data });
}

// ---- Horas -------------------------------------------------------------------
// Totales de horas de todos los estudiantes (o de los indicados).
async function horasDe(usuarioIds) {
  const filtro = usuarioIds ? { usuarioId: { in: usuarioIds } } : {};
  const [asistencias, manuales] = await Promise.all([
    prisma.asistenciaDeporte.findMany({ where: { ...filtro, presente: true } }),
    prisma.horaDeporteManual.findMany({ where: filtro }),
  ]);
  const sesionIds = [...new Set(asistencias.map((a) => a.sesionId))];
  const sesiones = sesionIds.length ? await prisma.sesionDeporte.findMany({ where: { id: { in: sesionIds } } }) : [];
  const grupoIds = [...new Set(sesiones.map((s) => s.grupoId))];
  const [grupos, disciplinas] = await Promise.all([
    grupoIds.length ? prisma.grupoDeporte.findMany({ where: { id: { in: grupoIds } } }) : [],
    prisma.disciplinaDeportiva.findMany(),
  ]);
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]));
  const disciplinaPorId = new Map(disciplinas.map((d) => [d.id, d]));

  const porUsuario = new Map();
  const de = (id) => {
    if (!porUsuario.has(id)) porUsuario.set(id, { total: 0, porPeriodo: {}, porDisciplina: {}, historial: [] });
    return porUsuario.get(id);
  };
  for (const a of asistencias) {
    const s = sesionPorId.get(a.sesionId);
    if (!s) continue;
    const g = grupoPorId.get(s.grupoId);
    const disciplina = disciplinaPorId.get(g?.disciplinaId)?.nombre || "—";
    const r = de(a.usuarioId);
    const periodo = u.periodoDeFecha(s.fecha);
    r.total += s.horas;
    r.porPeriodo[periodo] = (r.porPeriodo[periodo] || 0) + s.horas;
    r.porDisciplina[disciplina] = (r.porDisciplina[disciplina] || 0) + s.horas;
    r.historial.push({ tipo: "asistencia", id: s.id, fecha: fechaISO(s.fecha), horas: s.horas, disciplina, grupo: g?.nombre, detalle: s.tema || `${s.inicio} a ${s.fin}`, periodo });
  }
  for (const m of manuales) {
    const disciplina = disciplinaPorId.get(m.disciplinaId)?.nombre || "Reconocimiento";
    const r = de(m.usuarioId);
    const periodo = u.periodoDeFecha(m.fecha);
    r.total += m.horas;
    r.porPeriodo[periodo] = (r.porPeriodo[periodo] || 0) + m.horas;
    r.porDisciplina[disciplina] = (r.porDisciplina[disciplina] || 0) + m.horas;
    r.historial.push({ tipo: "reconocida", id: m.id, fecha: fechaISO(m.fecha), horas: m.horas, disciplina, grupo: null, detalle: m.motivo, periodo, registradoPor: m.registradoPor });
  }
  for (const r of porUsuario.values()) {
    r.total = u.redondear(r.total);
    for (const k of Object.keys(r.porPeriodo)) r.porPeriodo[k] = u.redondear(r.porPeriodo[k]);
    for (const k of Object.keys(r.porDisciplina)) r.porDisciplina[k] = u.redondear(r.porDisciplina[k]);
    r.historial.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }
  return porUsuario;
}

const VACIO = () => ({ total: 0, porPeriodo: {}, porDisciplina: {}, historial: [] });

async function progresoDe(usuarioId) {
  const [mapa, config] = await Promise.all([horasDe([usuarioId]), obtenerConfig()]);
  const h = mapa.get(usuarioId) || VACIO();
  const periodo = u.periodoActual();
  return {
    requeridas: config.horasRequeridas,
    total: h.total,
    faltan: u.redondear(Math.max(0, config.horasRequeridas - h.total)),
    porcentaje: Math.min(100, Math.round((h.total / config.horasRequeridas) * 1000) / 10),
    cumplido: h.total >= config.horasRequeridas,
    periodo,
    horasPeriodo: h.porPeriodo[periodo] || 0,
    porDisciplina: Object.entries(h.porDisciplina)
      .map(([nombre, horas]) => ({ nombre, horas }))
      .sort((a, b) => b.horas - a.horas),
    porPeriodo: Object.entries(h.porPeriodo)
      .map(([p, horas]) => ({ periodo: p, horas }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    historial: h.historial,
  };
}

// ---- Grupos e inscripciones ----------------------------------------------------
async function conteoInscritos(grupoIds) {
  const activas = grupoIds.length ? await prisma.inscripcionDeporte.findMany({ where: { grupoId: { in: grupoIds }, estado: "Activa" } }) : [];
  const mapa = new Map();
  for (const i of activas) mapa.set(i.grupoId, (mapa.get(i.grupoId) || 0) + 1);
  return mapa;
}

function serializarGrupo(g, disciplina, inscritos = 0) {
  return {
    ...g,
    disciplina: disciplina ? { id: disciplina.id, nombre: disciplina.nombre, tipo: disciplina.tipo } : null,
    horarioTexto: u.textoHorario(g.horario),
    horasSemana: u.redondear((g.horario || []).reduce((s, h) => s + u.horasEntre(h.inicio, h.fin), 0)),
    inscritos,
    cuposDisponibles: Math.max(0, g.cupo - inscritos),
  };
}

// Oferta del periodo para el estudiante, con su estado en cada grupo.
async function oferta(usuario) {
  const periodo = u.periodoActual();
  const [disciplinas, grupos, mias, config] = await Promise.all([
    prisma.disciplinaDeportiva.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
    prisma.grupoDeporte.findMany({ where: { periodo, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.inscripcionDeporte.findMany({ where: { usuarioId: usuario.id, estado: "Activa" } }),
    obtenerConfig(),
  ]);
  const inscritos = await conteoInscritos(grupos.map((g) => g.id));
  const misGrupos = new Set(mias.map((i) => i.grupoId));
  const misDelPeriodo = grupos.filter((g) => misGrupos.has(g.id));
  return {
    periodo,
    maxGruposPorPeriodo: config.maxGruposPorPeriodo,
    inscritoEn: misDelPeriodo.length,
    disciplinas: disciplinas.map((d) => ({
      ...d,
      grupos: grupos
        .filter((g) => g.disciplinaId === d.id)
        .map((g) => {
          const s = serializarGrupo(g, d, inscritos.get(g.id) || 0);
          const cruce = misGrupos.has(g.id) ? null : misDelPeriodo.find((m) => u.cruceEntre(m.horario, g.horario));
          return { ...s, inscrito: misGrupos.has(g.id), cruceCon: cruce ? cruce.nombre : null };
        }),
    })),
  };
}

async function obtenerGrupoOFallar(id) {
  const grupo = await prisma.grupoDeporte.findUnique({ where: { id } });
  if (!grupo) throw new AppError(404, "El grupo no existe.");
  return grupo;
}

async function inscribir(grupoId, usuarioId, { porPersonal = false } = {}) {
  const grupo = await obtenerGrupoOFallar(grupoId);
  if (!grupo.activo) throw new AppError(409, "Este grupo no está activo.");
  if (!porPersonal) {
    if (grupo.periodo !== u.periodoActual()) throw new AppError(409, "Solo puedes inscribirte a grupos del periodo actual.");
    if (!grupo.inscripcionesAbiertas) throw new AppError(409, "Las inscripciones de este grupo están cerradas.", "INSCRIPCIONES_CERRADAS");
  }
  const existente = await prisma.inscripcionDeporte.findFirst({ where: { grupoId, usuarioId } });
  if (existente?.estado === "Activa") throw new AppError(409, "Ya estás inscrito en este grupo.", "YA_INSCRITO");

  const inscritos = (await conteoInscritos([grupoId])).get(grupoId) || 0;
  if (inscritos >= grupo.cupo) throw new AppError(409, "El grupo no tiene cupos disponibles.", "SIN_CUPO");

  const activas = await prisma.inscripcionDeporte.findMany({ where: { usuarioId, estado: "Activa" } });
  const otros = activas.length
    ? (await prisma.grupoDeporte.findMany({ where: { id: { in: activas.map((a) => a.grupoId) } } })).filter((g) => g.periodo === grupo.periodo && g.id !== grupoId)
    : [];
  if (!porPersonal) {
    const config = await obtenerConfig();
    if (otros.length >= config.maxGruposPorPeriodo) {
      throw new AppError(409, `Puedes inscribirte máximo en ${config.maxGruposPorPeriodo} grupo(s) por periodo.`, "MAXIMO_GRUPOS");
    }
  }
  const cruce = otros.find((g) => u.cruceEntre(g.horario, grupo.horario));
  if (cruce) throw new AppError(409, `El horario se cruza con tu grupo ${cruce.nombre}.`, "CRUCE_HORARIO");

  if (existente) {
    return prisma.inscripcionDeporte.update({ where: { id: existente.id }, data: { estado: "Activa", fechaRetiro: null, fechaInscripcion: new Date() } });
  }
  return prisma.inscripcionDeporte.create({ data: { grupoId, usuarioId } });
}

async function retirar(grupoId, usuarioId) {
  const inscripcion = await prisma.inscripcionDeporte.findFirst({ where: { grupoId, usuarioId, estado: "Activa" } });
  if (!inscripcion) throw new AppError(404, "No hay una inscripción activa en este grupo.");
  await prisma.inscripcionDeporte.update({ where: { id: inscripcion.id }, data: { estado: "Retirada", fechaRetiro: new Date() } });
  return { retirado: true };
}

// Grupos del estudiante (para su inicio).
async function misGrupos(usuarioId) {
  const activas = await prisma.inscripcionDeporte.findMany({ where: { usuarioId, estado: "Activa" } });
  if (!activas.length) return [];
  const grupos = await prisma.grupoDeporte.findMany({ where: { id: { in: activas.map((a) => a.grupoId) } } });
  const disciplinas = await prisma.disciplinaDeportiva.findMany();
  const periodo = u.periodoActual();
  return grupos
    .filter((g) => g.periodo === periodo)
    .map((g) => serializarGrupo(g, disciplinas.find((d) => d.id === g.disciplinaId)));
}

// ---- Administracion de grupos ------------------------------------------------
function datosGrupo(cuerpo = {}, parcial = false) {
  const data = {};
  if (!parcial || cuerpo.disciplinaId !== undefined) {
    if (!cuerpo.disciplinaId) throw new AppError(400, "Elige la disciplina.");
    data.disciplinaId = cuerpo.disciplinaId;
  }
  if (!parcial || cuerpo.periodo !== undefined) data.periodo = u.validarPeriodo(cuerpo.periodo || u.periodoActual());
  if (!parcial || cuerpo.nombre !== undefined) {
    data.nombre = texto(cuerpo.nombre, 80);
    if (!data.nombre) throw new AppError(400, "Escribe el nombre del grupo (por ejemplo, Natación · Grupo 1).");
  }
  if (cuerpo.instructor !== undefined) data.instructor = texto(cuerpo.instructor, 150);
  if (cuerpo.lugar !== undefined) data.lugar = texto(cuerpo.lugar, 150);
  if (!parcial || cuerpo.cupo !== undefined) {
    const cupo = Number(cuerpo.cupo ?? 25);
    if (!Number.isInteger(cupo) || cupo < 1 || cupo > 500) throw new AppError(400, "El cupo debe estar entre 1 y 500.");
    data.cupo = cupo;
  }
  if (!parcial || cuerpo.horario !== undefined) data.horario = u.validarHorario(cuerpo.horario);
  if (cuerpo.inscripcionesAbiertas !== undefined) data.inscripcionesAbiertas = cuerpo.inscripcionesAbiertas === true;
  if (cuerpo.activo !== undefined) data.activo = cuerpo.activo === true;
  return data;
}

async function listarGrupos({ periodo } = {}) {
  const per = periodo ? u.validarPeriodo(periodo) : u.periodoActual();
  const [grupos, disciplinas] = await Promise.all([
    prisma.grupoDeporte.findMany({ where: { periodo: per }, orderBy: { nombre: "asc" } }),
    prisma.disciplinaDeportiva.findMany(),
  ]);
  const ids = grupos.map((g) => g.id);
  const [inscritos, sesiones] = await Promise.all([
    conteoInscritos(ids),
    ids.length ? prisma.sesionDeporte.findMany({ where: { grupoId: { in: ids } } }) : [],
  ]);
  return {
    periodo: per,
    grupos: grupos.map((g) => {
      const delGrupo = sesiones.filter((s) => s.grupoId === g.id);
      return {
        ...serializarGrupo(g, disciplinas.find((d) => d.id === g.disciplinaId), inscritos.get(g.id) || 0),
        sesiones: delGrupo.length,
        horasDictadas: u.redondear(delGrupo.reduce((s, x) => s + x.horas, 0)),
      };
    }),
  };
}

async function crearGrupo(cuerpo) {
  const data = datosGrupo(cuerpo);
  const disciplina = await prisma.disciplinaDeportiva.findUnique({ where: { id: data.disciplinaId } });
  if (!disciplina) throw new AppError(400, "La disciplina no existe.");
  const grupo = await prisma.grupoDeporte.create({ data });
  return serializarGrupo(grupo, disciplina);
}

async function actualizarGrupo(id, cuerpo) {
  const grupo = await obtenerGrupoOFallar(id);
  const data = datosGrupo(cuerpo, true);
  if (data.cupo !== undefined) {
    const inscritos = (await conteoInscritos([id])).get(id) || 0;
    if (data.cupo < inscritos) throw new AppError(409, `El grupo ya tiene ${inscritos} inscritos; el cupo no puede ser menor.`);
  }
  if (data.disciplinaId && !(await prisma.disciplinaDeportiva.findUnique({ where: { id: data.disciplinaId } }))) {
    throw new AppError(400, "La disciplina no existe.");
  }
  const actualizado = await prisma.grupoDeporte.update({ where: { id: grupo.id }, data });
  return detalleGrupo(actualizado.id);
}

async function detalleGrupo(id) {
  const grupo = await obtenerGrupoOFallar(id);
  const [disciplina, inscripciones, sesiones] = await Promise.all([
    prisma.disciplinaDeportiva.findUnique({ where: { id: grupo.disciplinaId } }),
    prisma.inscripcionDeporte.findMany({ where: { grupoId: id } }),
    prisma.sesionDeporte.findMany({ where: { grupoId: id }, orderBy: { fecha: "desc" } }),
  ]);
  const usuarios = inscripciones.length
    ? await prisma.usuario.findMany({ where: { id: { in: inscripciones.map((i) => i.usuarioId) } } })
    : [];
  const asistencias = sesiones.length ? await prisma.asistenciaDeporte.findMany({ where: { sesionId: { in: sesiones.map((s) => s.id) } } }) : [];
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const activas = inscripciones.filter((i) => i.estado === "Activa");
  const hoy = hoyBogota();
  const franjaHoy = (grupo.horario || []).find((h) => h.dia === u.diaSemana(hoy));
  return {
    ...serializarGrupo(grupo, disciplina, activas.length),
    inscritos: inscripciones
      .map((i) => {
        const usuario = usuarios.find((x) => x.id === i.usuarioId);
        const propias = asistencias.filter((a) => a.usuarioId === i.usuarioId);
        const presentes = propias.filter((a) => a.presente);
        return {
          usuarioId: i.usuarioId,
          nombre: usuario?.nombre || "—",
          email: usuario?.emailInstitucional || "",
          estado: i.estado,
          fechaInscripcion: i.fechaInscripcion,
          asistencias: presentes.length,
          sesionesRegistradas: propias.length,
          horas: u.redondear(presentes.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0)),
        };
      })
      .sort((a, b) => (a.estado === b.estado ? a.nombre.localeCompare(b.nombre) : a.estado === "Activa" ? -1 : 1)),
    totalInscritos: activas.length,
    sesiones: sesiones.map((s) => {
      const delaSesion = asistencias.filter((a) => a.sesionId === s.id);
      return {
        ...s,
        fecha: fechaISO(s.fecha),
        presentes: delaSesion.filter((a) => a.presente).map((a) => a.usuarioId),
        registrados: delaSesion.length,
      };
    }),
    sugerenciaSesion: { fecha: fechaISO(hoy), inicio: franjaHoy?.inicio || grupo.horario?.[0]?.inicio || "", fin: franjaHoy?.fin || grupo.horario?.[0]?.fin || "", hoyTieneClase: Boolean(franjaHoy) },
  };
}

async function buscarUsuarioPorCorreo(email) {
  const correo = String(email || "").trim().toLowerCase();
  if (!correo) throw new AppError(400, "Escribe el correo institucional del estudiante.");
  const usuario = (await prisma.usuario.findMany({ where: { emailInstitucional: { equals: correo, mode: "insensitive" } } }))[0];
  if (!usuario) throw new AppError(404, "Ese correo aún no ha ingresado a Conecta BU. El estudiante debe iniciar sesión una vez.", "USUARIO_NO_ENCONTRADO");
  return usuario;
}

async function inscribirPorCorreo(grupoId, email) {
  const usuario = await buscarUsuarioPorCorreo(email);
  await inscribir(grupoId, usuario.id, { porPersonal: true });
  return detalleGrupo(grupoId);
}

// ---- Sesiones y asistencia -------------------------------------------------------
function datosSesion(cuerpo = {}) {
  const fecha = aFechaUTC(String(cuerpo.fecha || "").slice(0, 10), "fecha de la sesión");
  if (fecha > hoyBogota()) throw new AppError(400, "No se puede registrar asistencia de una fecha futura.");
  const inicio = u.hora(cuerpo.inicio, "La hora de inicio");
  const fin = u.hora(cuerpo.fin, "La hora final");
  return { fecha, inicio, fin, horas: u.horasEntre(inicio, fin), tema: texto(cuerpo.tema, 200) };
}

async function guardarAsistencias(sesionId, grupoId, presentes) {
  if (!Array.isArray(presentes)) throw new AppError(400, "Envía la lista de estudiantes presentes.");
  const activas = await prisma.inscripcionDeporte.findMany({ where: { grupoId, estado: "Activa" } });
  const ids = new Set(activas.map((i) => i.usuarioId));
  const ajeno = presentes.find((id) => !ids.has(id));
  if (ajeno) throw new AppError(400, "Hay estudiantes en la lista que no están inscritos en el grupo.");
  const existentes = await prisma.asistenciaDeporte.findMany({ where: { sesionId } });
  for (const usuarioId of ids) {
    const presente = presentes.includes(usuarioId);
    const fila = existentes.find((a) => a.usuarioId === usuarioId);
    if (fila) {
      if (fila.presente !== presente) await prisma.asistenciaDeporte.update({ where: { id: fila.id }, data: { presente } });
    } else {
      await prisma.asistenciaDeporte.create({ data: { sesionId, usuarioId, presente } });
    }
  }
}

async function registrarSesion(grupoId, cuerpo, usuario) {
  const grupo = await obtenerGrupoOFallar(grupoId);
  const data = datosSesion(cuerpo);
  const repetida = await prisma.sesionDeporte.findFirst({ where: { grupoId, fecha: data.fecha, inicio: data.inicio } });
  if (repetida) throw new AppError(409, "Ya se registró la asistencia de esa sesión. Ábrela para corregirla.", "SESION_REPETIDA");
  const sesion = await prisma.sesionDeporte.create({ data: { ...data, grupoId: grupo.id, registradaPor: usuario.emailInstitucional } });
  try {
    await guardarAsistencias(sesion.id, grupoId, cuerpo.presentes || []);
  } catch (err) {
    await prisma.sesionDeporte.delete({ where: { id: sesion.id } });
    throw err;
  }
  return detalleGrupo(grupoId);
}

async function actualizarSesion(id, cuerpo) {
  const sesion = await prisma.sesionDeporte.findUnique({ where: { id } });
  if (!sesion) throw new AppError(404, "La sesión no existe.");
  const data = {};
  if (cuerpo.tema !== undefined) data.tema = texto(cuerpo.tema, 200);
  if (cuerpo.inicio !== undefined || cuerpo.fin !== undefined) {
    data.inicio = u.hora(cuerpo.inicio ?? sesion.inicio, "La hora de inicio");
    data.fin = u.hora(cuerpo.fin ?? sesion.fin, "La hora final");
    data.horas = u.horasEntre(data.inicio, data.fin);
  }
  if (Object.keys(data).length) await prisma.sesionDeporte.update({ where: { id }, data });
  if (cuerpo.presentes !== undefined) await guardarAsistencias(id, sesion.grupoId, cuerpo.presentes);
  return detalleGrupo(sesion.grupoId);
}

async function eliminarSesion(id) {
  const sesion = await prisma.sesionDeporte.findUnique({ where: { id } });
  if (!sesion) throw new AppError(404, "La sesión no existe.");
  await prisma.asistenciaDeporte.deleteMany({ where: { sesionId: id } });
  await prisma.sesionDeporte.delete({ where: { id } });
  return detalleGrupo(sesion.grupoId);
}

// ---- Estudiantes y horas reconocidas ---------------------------------------------
async function listarEstudiantes({ q, estado } = {}) {
  const [inscripciones, manuales, config] = await Promise.all([
    prisma.inscripcionDeporte.findMany(),
    prisma.horaDeporteManual.findMany(),
    obtenerConfig(),
  ]);
  const ids = new Set([...inscripciones.map((i) => i.usuarioId), ...manuales.map((m) => m.usuarioId)]);
  const busqueda = texto(q, 80);
  let usuarios = [];
  if (busqueda) {
    usuarios = await prisma.usuario.findMany({
      where: { OR: [{ nombre: { contains: busqueda, mode: "insensitive" } }, { emailInstitucional: { contains: busqueda, mode: "insensitive" } }] },
      include: { rol: true },
    });
    usuarios = usuarios.filter((x) => x.rol?.nombre === "Estudiante" || ids.has(x.id)).slice(0, 100);
  } else if (ids.size) {
    usuarios = await prisma.usuario.findMany({ where: { id: { in: [...ids] } } });
  }
  const horas = await horasDe(usuarios.map((x) => x.id));
  const grupos = await prisma.grupoDeporte.findMany({ where: { periodo: u.periodoActual() } });
  const periodo = u.periodoActual();
  const lista = usuarios.map((x) => {
    const h = horas.get(x.id) || VACIO();
    const activos = inscripciones.filter((i) => i.usuarioId === x.id && i.estado === "Activa").map((i) => grupos.find((g) => g.id === i.grupoId)?.nombre).filter(Boolean);
    return {
      id: x.id,
      nombre: x.nombre,
      email: x.emailInstitucional,
      total: h.total,
      horasPeriodo: h.porPeriodo[periodo] || 0,
      cumplido: h.total >= config.horasRequeridas,
      porcentaje: Math.min(100, Math.round((h.total / config.horasRequeridas) * 1000) / 10),
      gruposActivos: activos,
    };
  });
  const filtrada = estado === "cumplieron" ? lista.filter((x) => x.cumplido) : estado === "pendientes" ? lista.filter((x) => !x.cumplido) : lista;
  return { requeridas: config.horasRequeridas, estudiantes: filtrada.sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre)) };
}

async function detalleEstudiante(usuarioId) {
  const usuario = (await prisma.usuario.findMany({ where: { id: { in: [usuarioId] } } }))[0];
  if (!usuario) throw new AppError(404, "El estudiante no existe.");
  const [progreso, grupos, inscripciones] = await Promise.all([progresoDe(usuarioId), prisma.grupoDeporte.findMany(), prisma.inscripcionDeporte.findMany({ where: { usuarioId } })]);
  const disciplinas = await prisma.disciplinaDeportiva.findMany();
  return {
    estudiante: { id: usuario.id, nombre: usuario.nombre, email: usuario.emailInstitucional },
    ...progreso,
    inscripciones: inscripciones
      .map((i) => {
        const g = grupos.find((x) => x.id === i.grupoId);
        return {
          grupoId: i.grupoId,
          grupo: g?.nombre,
          disciplina: disciplinas.find((d) => d.id === g?.disciplinaId)?.nombre,
          periodo: g?.periodo,
          estado: i.estado,
          fechaInscripcion: i.fechaInscripcion,
        };
      })
      .sort((a, b) => String(b.periodo).localeCompare(String(a.periodo))),
  };
}

async function reconocerHoras(usuarioId, cuerpo = {}, registradoPor) {
  const usuario = (await prisma.usuario.findMany({ where: { id: { in: [usuarioId] } } }))[0];
  if (!usuario) throw new AppError(404, "El estudiante no existe.");
  const horas = Number(cuerpo.horas);
  if (!Number.isFinite(horas) || horas < 0.5 || horas > 40) throw new AppError(400, "Las horas deben estar entre 0,5 y 40.");
  const motivo = texto(cuerpo.motivo, 200);
  if (!motivo) throw new AppError(400, "Escribe el motivo (torneo, evento, representación…).");
  const fecha = cuerpo.fecha ? aFechaUTC(String(cuerpo.fecha).slice(0, 10), "fecha") : hoyBogota();
  if (fecha > hoyBogota()) throw new AppError(400, "La fecha no puede ser futura.");
  let disciplinaId = null;
  if (cuerpo.disciplinaId) {
    if (!(await prisma.disciplinaDeportiva.findUnique({ where: { id: cuerpo.disciplinaId } }))) throw new AppError(400, "La disciplina no existe.");
    disciplinaId = cuerpo.disciplinaId;
  }
  await prisma.horaDeporteManual.create({ data: { usuarioId, horas: u.redondear(horas), motivo, fecha, disciplinaId, registradoPor } });
  return detalleEstudiante(usuarioId);
}

async function eliminarHoras(id) {
  const fila = await prisma.horaDeporteManual.findUnique({ where: { id } });
  if (!fila) throw new AppError(404, "El registro no existe.");
  await prisma.horaDeporteManual.delete({ where: { id } });
  return detalleEstudiante(fila.usuarioId);
}

// ---- Inicio del personal -----------------------------------------------------------
async function resumen() {
  const periodo = u.periodoActual();
  const hoy = hoyBogota();
  const [{ grupos }, config, sesionesHoy] = await Promise.all([
    listarGrupos({ periodo }),
    obtenerConfig(),
    prisma.sesionDeporte.findMany({ where: { fecha: hoy } }),
  ]);
  const ids = grupos.map((g) => g.id);
  const [inscripciones, sesiones] = await Promise.all([
    ids.length ? prisma.inscripcionDeporte.findMany({ where: { grupoId: { in: ids }, estado: "Activa" } }) : [],
    ids.length ? prisma.sesionDeporte.findMany({ where: { grupoId: { in: ids } } }) : [],
  ]);
  const asistencias = sesiones.length ? await prisma.asistenciaDeporte.findMany({ where: { sesionId: { in: sesiones.map((s) => s.id) } } }) : [];
  const horas = await horasDe();
  const totales = [...horas.entries()].map(([id, h]) => ({ id, total: h.total }));
  const cerca = totales.filter((t) => t.total < config.horasRequeridas && t.total >= config.horasRequeridas * 0.75).sort((a, b) => b.total - a.total).slice(0, 8);
  const usuariosCerca = cerca.length ? await prisma.usuario.findMany({ where: { id: { in: cerca.map((c) => c.id) } } }) : [];
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));
  const presentes = asistencias.filter((a) => a.presente);
  const dia = u.diaSemana(hoy);
  return {
    periodo,
    requeridas: config.horasRequeridas,
    gruposActivos: grupos.filter((g) => g.activo).length,
    inscritos: new Set(inscripciones.map((i) => i.usuarioId)).size,
    sesiones: sesiones.length,
    horasOtorgadas: u.redondear(presentes.reduce((s, a) => s + (sesionPorId.get(a.sesionId)?.horas || 0), 0)),
    asistenciaPromedio: asistencias.length ? Math.round((presentes.length / asistencias.length) * 1000) / 10 : null,
    cumplieron: totales.filter((t) => t.total >= config.horasRequeridas).length,
    clasesHoy: grupos
      .filter((g) => g.activo && (g.horario || []).some((h) => h.dia === dia))
      .map((g) => ({
        id: g.id,
        nombre: g.nombre,
        disciplina: g.disciplina?.nombre,
        franja: g.horario.find((h) => h.dia === dia),
        lugar: g.lugar,
        inscritos: g.inscritos,
        asistenciaTomada: sesionesHoy.some((s) => s.grupoId === g.id),
      }))
      .sort((a, b) => a.franja.inicio.localeCompare(b.franja.inicio)),
    porDisciplina: Object.entries(
      grupos.reduce((m, g) => {
        const k = g.disciplina?.nombre || "—";
        m[k] = (m[k] || 0) + g.inscritos;
        return m;
      }, {})
    )
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total),
    cercaDeCumplir: cerca.map((c) => {
      const x = usuariosCerca.find((y) => y.id === c.id);
      return { id: c.id, nombre: x?.nombre, email: x?.emailInstitucional, total: c.total };
    }),
  };
}

// Datos del reporte en Excel del periodo.
async function datosReporte({ periodo } = {}) {
  const { periodo: per, grupos } = await listarGrupos({ periodo });
  const { requeridas, estudiantes } = await listarEstudiantes();
  const ids = grupos.map((g) => g.id);
  const sesiones = ids.length ? await prisma.sesionDeporte.findMany({ where: { grupoId: { in: ids } }, orderBy: { fecha: "asc" } }) : [];
  const asistencias = sesiones.length ? await prisma.asistenciaDeporte.findMany({ where: { sesionId: { in: sesiones.map((s) => s.id) } } }) : [];
  const usuarios = asistencias.length ? await prisma.usuario.findMany({ where: { id: { in: [...new Set(asistencias.map((a) => a.usuarioId))] } } }) : [];
  const filas = asistencias.map((a) => {
    const s = sesiones.find((x) => x.id === a.sesionId);
    const g = grupos.find((x) => x.id === s.grupoId);
    const usuario = usuarios.find((x) => x.id === a.usuarioId);
    return { fecha: fechaISO(s.fecha), disciplina: g?.disciplina?.nombre, grupo: g?.nombre, nombre: usuario?.nombre, email: usuario?.emailInstitucional, presente: a.presente, horas: s.horas };
  });
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.grupo).localeCompare(String(b.grupo)) || String(a.nombre).localeCompare(String(b.nombre)));
  return { periodo: per, requeridas, estudiantes, grupos, asistencias: filas };
}

module.exports = {
  datosReporte,
  obtenerConfig,
  guardarConfig,
  listarDisciplinas,
  crearDisciplina,
  actualizarDisciplina,
  horasDe,
  progresoDe,
  oferta,
  inscribir,
  retirar,
  misGrupos,
  listarGrupos,
  crearGrupo,
  actualizarGrupo,
  detalleGrupo,
  inscribirPorCorreo,
  registrarSesion,
  actualizarSesion,
  eliminarSesion,
  listarEstudiantes,
  detalleEstudiante,
  reconocerHoras,
  eliminarHoras,
  resumen,
};
