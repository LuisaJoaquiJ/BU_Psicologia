const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { iso } = require("./periodo");
const { REDES, ROLES_OPERATIVOS } = require("./catalogo");

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

function hora(valor) {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(valor || ""))) throw new AppError(400, "La hora debe tener la forma HH:mm.");
  return valor;
}

function entero(valor, etiqueta) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) throw new AppError(400, `${etiqueta} debe ser un número entero de cero en adelante.`);
  return n;
}

async function rolDe(email) {
  const fila = await prisma.rolOperativoCultural.findFirst({ where: { email: String(email || "").toLowerCase() } });
  const rol = fila?.rol || "administrador";
  return ROLES_OPERATIVOS.includes(rol) ? rol : "administrador";
}

function exigir(...permitidos) {
  return async (req, res, next) => {
    try {
      const rol = await rolDe(req.usuario.emailInstitucional);
      req.rolCultura = rol;
      if (!permitidos.includes(rol)) throw new AppError(403, "Tu rol en Arte y Cultura no incluye esta acción.");
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function grupoONull(grupoId) {
  if (!grupoId) return null;
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo.");
  return grupo.id;
}

async function listarRepresentaciones(filtro = {}) {
  const [filas, participantes, grupos, usuarios] = await Promise.all([
    prisma.representacionRed.findMany({ orderBy: { fecha: "desc" } }),
    prisma.participanteRed.findMany(),
    prisma.grupoCultural.findMany(),
    prisma.usuario.findMany(),
  ]);
  const grupoDe = new Map(grupos.map((g) => [g.id, g.nombre]));
  const usuarioDe = new Map(usuarios.map((u) => [u.id, u]));
  return filas
    .filter((f) => !filtro.grupoId || f.grupoId === filtro.grupoId)
    .filter((f) => !filtro.usuarioId || participantes.some((p) => p.representacionId === f.id && p.usuarioId === filtro.usuarioId))
    .map((f) => ({
      ...f,
      fecha: iso(f.fecha),
      grupo: grupoDe.get(f.grupoId) || "",
      participantes: participantes
        .filter((p) => p.representacionId === f.id)
        .map((p) => {
          const u = usuarioDe.get(p.usuarioId);
          return { usuarioId: p.usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "" };
        }),
    }));
}

async function crearRepresentacion(body, email) {
  const red = String(body.red || "").toUpperCase();
  if (!REDES.includes(red)) throw new AppError(400, "La red debe ser ASIES o ASCUN.");
  const tokens = [...new Set((Array.isArray(body.participantes) ? body.participantes : []).map((t) => String(t || "").trim()).filter(Boolean))];
  if (!tokens.length) throw new AppError(400, "Vincula al menos un estudiante a la delegación.");
  const usuarios = await prisma.usuario.findMany();
  const participantes = tokens.map((token) => {
    const persona = usuarios.find((u) => u.id === token || u.emailInstitucional.toLowerCase() === token.toLowerCase());
    if (!persona) throw new AppError(400, `No se encontró a ${token}.`);
    return persona.id;
  });
  const creada = await prisma.representacionRed.create({
    data: {
      red,
      nombre: texto(body.nombre, 150, "el nombre de la convocatoria"),
      modalidad: body.modalidad ? texto(body.modalidad, 120, "la modalidad") : null,
      fecha: fechaDia(body.fecha, "La fecha"),
      grupoId: await grupoONull(body.grupoId),
      posicion: body.posicion ? texto(body.posicion, 120, "la posición") : null,
    },
  });
  for (const usuarioId of participantes) {
    await prisma.participanteRed.create({ data: { representacionId: creada.id, usuarioId } });
  }
  return { ...(await listarRepresentaciones()).find((f) => f.id === creada.id), registradaPor: email };
}

async function reconocer(id, posicion) {
  const previa = await prisma.representacionRed.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró la representación.");
  await prisma.representacionRed.update({ where: { id }, data: { posicion: texto(posicion, 120, "la posición o el reconocimiento") } });
  return (await listarRepresentaciones()).find((f) => f.id === id);
}

async function listarPausas() {
  const [pausas, evidencias] = await Promise.all([
    prisma.pausaCreativa.findMany({ orderBy: { fecha: "desc" } }),
    prisma.evidenciaCultural.findMany(),
  ]);
  return pausas.map((p) => ({
    ...p,
    fecha: iso(p.fecha),
    evidencias: evidencias.filter((e) => e.pausaId === p.id).length,
  }));
}

async function crearPausa(body, email) {
  return prisma.pausaCreativa.create({
    data: {
      fecha: fechaDia(body.fecha, "La fecha"),
      lugar: texto(body.lugar, 150, "el lugar"),
      tecnica: texto(body.tecnica, 150, "la técnica"),
      impactoEstimado: entero(body.impactoEstimado, "El número de estudiantes impactados"),
      registradaPor: email,
    },
  });
}

async function listarSolicitudes() {
  const [filas, grupos] = await Promise.all([
    prisma.solicitudApoyo.findMany({ orderBy: { fecha: "desc" } }),
    prisma.grupoCultural.findMany(),
  ]);
  const grupoDe = new Map(grupos.map((g) => [g.id, g.nombre]));
  return filas.map((f) => ({ ...f, fecha: iso(f.fecha), grupo: grupoDe.get(f.grupoId) || "" }));
}

async function crearSolicitud(body, email) {
  return prisma.solicitudApoyo.create({
    data: {
      lugarDestino: texto(body.lugarDestino, 150, "el colegio o lugar de destino"),
      fecha: fechaDia(body.fecha, "La fecha"),
      hora: hora(body.hora),
      grupoId: await grupoONull(body.grupoId),
      detalle: body.detalle ? texto(body.detalle, 1000, "el detalle") : null,
      personalAsignado: body.personalAsignado ? texto(body.personalAsignado, 300, "el personal asignado") : null,
      estado: body.personalAsignado ? "Programada" : "Recibida",
      solicitadaPor: email,
    },
  });
}

async function asignarSolicitud(id, body) {
  const previa = await prisma.solicitudApoyo.findUnique({ where: { id } });
  if (!previa) throw new AppError(404, "No se encontró la solicitud.");
  const estado = body.estado || previa.estado;
  if (!["Recibida", "Programada", "Realizada"].includes(estado)) throw new AppError(400, "El estado debe ser Recibida, Programada o Realizada.");
  return prisma.solicitudApoyo.update({
    where: { id },
    data: {
      estado,
      personalAsignado: body.personalAsignado !== undefined ? (body.personalAsignado ? texto(body.personalAsignado, 300, "el personal asignado") : null) : previa.personalAsignado,
      grupoId: body.grupoId !== undefined ? await grupoONull(body.grupoId) : previa.grupoId,
    },
  });
}

async function buscarInscritos(q) {
  const textoBusqueda = String(q || "").trim().toLowerCase();
  if (textoBusqueda.length < 3) throw new AppError(400, "Escribe al menos 3 caracteres del correo o de la cédula.");
  const [inscripciones, eventos, perfiles, usuarios] = await Promise.all([
    prisma.inscripcionCultural.findMany({ where: { estado: "Activa" } }),
    prisma.inscripcionEventoCultural.findMany({ where: { estado: "Activa" } }),
    prisma.perfilCultural.findMany(),
    prisma.usuario.findMany(),
  ]);
  const perfilDe = new Map(perfiles.map((p) => [p.usuarioId, p]));
  const ids = new Set([...inscripciones.map((i) => i.usuarioId), ...eventos.map((i) => i.usuarioId)]);
  return usuarios
    .filter((u) => ids.has(u.id))
    .filter((u) => {
      const documento = perfilDe.get(u.id)?.documento || "";
      return u.emailInstitucional.toLowerCase().includes(textoBusqueda) || documento.includes(textoBusqueda) || u.nombre.toLowerCase().includes(textoBusqueda);
    })
    .map((u) => {
      const perfil = perfilDe.get(u.id);
      return {
        usuarioId: u.id,
        nombre: u.nombre,
        email: u.emailInstitucional,
        documento: perfil?.documento || "",
        programa: perfil?.programa || "",
        caracterizacion: perfil?.caracterizacion || "No registra",
      };
    });
}

async function registroCalificado(filtro = {}) {
  const desde = filtro.desde ? fechaDia(filtro.desde, "La fecha inicial") : null;
  const hasta = filtro.hasta ? fechaDia(filtro.hasta, "La fecha final") : null;
  const [asistencias, perfiles, usuarios] = await Promise.all([
    prisma.asistenciaCultural.findMany({ where: { presente: true } }),
    prisma.perfilCultural.findMany(),
    prisma.usuario.findMany(),
  ]);
  const perfilDe = new Map(perfiles.map((p) => [p.usuarioId, p]));
  const usuarioDe = new Map(usuarios.map((u) => [u.id, u]));
  const programaPedido = String(filtro.programa || "").trim().toLowerCase();
  const cuentas = new Map();
  for (const a of asistencias) {
    if (desde && new Date(a.fechaHora) < desde) continue;
    if (hasta && new Date(a.fechaHora).getTime() >= hasta.getTime() + 86400000) continue;
    const perfil = perfilDe.get(a.usuarioId);
    const programa = perfil?.programa || "Sin programa";
    if (programaPedido && programa.toLowerCase() !== programaPedido) continue;
    const previo = cuentas.get(a.usuarioId) || { asistencias: 0 };
    cuentas.set(a.usuarioId, { asistencias: previo.asistencias + 1, programa, caracterizacion: perfil?.caracterizacion || "No registra" });
  }
  return [...cuentas.entries()].map(([usuarioId, dato]) => {
    const u = usuarioDe.get(usuarioId);
    return { usuarioId, nombre: u?.nombre || "", email: u?.emailInstitucional || "", ...dato, asistenciaConfirmada: true };
  });
}

async function inclusion(filtro = {}) {
  const lista = await registroCalificado(filtro);
  const cuentas = new Map();
  for (const f of lista) cuentas.set(f.caracterizacion, (cuentas.get(f.caracterizacion) || 0) + 1);
  return [...cuentas.entries()].map(([caracterizacion, personas]) => ({ caracterizacion, personas }));
}

async function historico(filtro = {}) {
  const anio = String(filtro.anio || "").trim();
  const periodo = String(filtro.periodo || "").trim();
  const q = String(filtro.q || "").trim().toLowerCase();
  const [grupos, eventos, pausas, representaciones, evidencias, areas] = await Promise.all([
    prisma.grupoCultural.findMany(),
    prisma.eventoCultural.findMany(),
    prisma.pausaCreativa.findMany(),
    prisma.representacionRed.findMany(),
    prisma.evidenciaCultural.findMany(),
    prisma.areaCultural.findMany(),
  ]);
  const areaDe = new Map(areas.map((a) => [a.id, a.nombre]));
  const pasa = ({ nombre, fecha, periodoFila }) => {
    if (q && !String(nombre || "").toLowerCase().includes(q)) return false;
    const ano = fecha ? String(iso(fecha) || "").slice(0, 4) : String(periodoFila || "").slice(0, 4);
    if (anio && ano !== anio) return false;
    if (periodo && periodoFila && periodoFila !== periodo) return false;
    return true;
  };
  return {
    grupos: grupos
      .filter((g) => pasa({ nombre: `${g.nombre} ${areaDe.get(g.areaId) || ""}`, periodoFila: g.periodo }))
      .map((g) => ({ id: g.id, nombre: g.nombre, periodo: g.periodo, area: areaDe.get(g.areaId) || "", evidencias: evidencias.filter((e) => e.grupoId === g.id).length })),
    eventos: eventos
      .filter((e) => pasa({ nombre: e.nombre, fecha: e.fecha }))
      .map((e) => ({ id: e.id, nombre: e.nombre, fecha: iso(e.fecha), lugar: e.lugar, representacion: e.representacion, evidencias: evidencias.filter((ev) => ev.eventoId === e.id).length })),
    pausas: pausas
      .filter((p) => pasa({ nombre: `${p.tecnica} ${p.lugar}`, fecha: p.fecha }))
      .map((p) => ({ id: p.id, fecha: iso(p.fecha), lugar: p.lugar, tecnica: p.tecnica, impactoEstimado: p.impactoEstimado, evidencias: evidencias.filter((e) => e.pausaId === p.id).length })),
    representaciones: representaciones
      .filter((r) => pasa({ nombre: `${r.red} ${r.nombre} ${r.posicion || ""}`, fecha: r.fecha }))
      .map((r) => ({ id: r.id, red: r.red, nombre: r.nombre, fecha: iso(r.fecha), posicion: r.posicion })),
  };
}

async function listarEquipo() {
  const [accesos, roles] = await Promise.all([
    prisma.accesoModulo.findMany({ where: { modulo: "cultura" } }),
    prisma.rolOperativoCultural.findMany(),
  ]);
  const rolDeEmail = new Map(roles.map((r) => [r.email, r.rol]));
  return accesos.map((a) => ({
    email: a.email,
    rol: rolDeEmail.get(a.email) || "administrador",
    roles: ROLES_OPERATIVOS,
  }));
}

async function asignarRol(email, rol) {
  const correo = String(email || "").trim().toLowerCase();
  if (!ROLES_OPERATIVOS.includes(rol)) throw new AppError(400, "El rol debe ser administrador, docente o monitor.");
  const acceso = await prisma.accesoModulo.findFirst({ where: { email: correo, modulo: "cultura" } });
  if (!acceso) throw new AppError(400, "Ese correo no está en la lista de Cultura. Pide al superadministrador que lo asigne primero.");
  const previo = await prisma.rolOperativoCultural.findFirst({ where: { email: correo } });
  if (previo) await prisma.rolOperativoCultural.update({ where: { email: correo }, data: { rol } });
  else await prisma.rolOperativoCultural.create({ data: { email: correo, rol } });
  return { email: correo, rol };
}

module.exports = {
  rolDe,
  exigir,
  listarRepresentaciones,
  crearRepresentacion,
  reconocer,
  listarPausas,
  crearPausa,
  listarSolicitudes,
  crearSolicitud,
  asignarSolicitud,
  buscarInscritos,
  registroCalificado,
  inclusion,
  historico,
  listarEquipo,
  asignarRol,
};
