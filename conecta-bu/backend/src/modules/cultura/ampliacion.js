const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { iso } = require("./periodo");
const { REDES, ROLES_OPERATIVOS } = require("./catalogo");
const notificaciones = require("../notificaciones/service");

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

// El area siempre necesita a alguien que la administre: si todavia no hay ningun administrador
// escrito, quien entra sin rol lo es; despues, quien entra sin rol queda como monitor (el de menos permisos).
async function hayAdministrador() {
  const [accesos, roles] = await Promise.all([prisma.accesoModulo.findMany({ where: { modulo: "cultura" } }), prisma.rolOperativoCultural.findMany()]);
  return accesos.some((a) => roles.some((r) => r.email === a.email && r.rol === "administrador"));
}

async function rolDe(email) {
  const correo = String(email || "").toLowerCase();
  const fila = await prisma.rolOperativoCultural.findFirst({ where: { email: correo } });
  if (fila && ROLES_OPERATIVOS.includes(fila.rol)) return fila.rol;
  return (await hayAdministrador()) ? "monitor" : "administrador";
}

const emailDe = (req) => String(req.usuario?.emailInstitucional || "").toLowerCase();
const monitoresDe = (grupo) => (Array.isArray(grupo?.monitoresEmails) ? grupo.monitoresEmails : []);
// El docente dirige su grupo; el monitor ayuda en los grupos donde esta asignado.
const aCargo = (grupo, email) => grupo?.docenteEmail === email || monitoresDe(grupo).includes(email);

// En un evento, a cargo esta quien aparece en su lista o quien esta a cargo del grupo que se presenta.
const responsablesDeEvento = (evento) => (Array.isArray(evento?.responsablesEmails) ? evento.responsablesEmails : []);
const eventoACargo = (evento, grupo, email, rol) => responsablesDeEvento(evento).includes(email) || aCargo(grupo, email, rol);

const SIN_ROL = "Tu rol en Arte y Cultura no incluye esta acción.";

// Acciones sobre un grupo (req.params.id): el administrador en todos; docente y monitor, solo en los suyos.
function sobreGrupo(permitidos) {
  return async (req, res, next) => {
    try {
      const rol = await rolDe(emailDe(req));
      req.rolCultura = rol;
      if (!permitidos.includes(rol)) throw new AppError(403, SIN_ROL);
      if (rol !== "administrador") {
        const grupo = await prisma.grupoCultural.findUnique({ where: { id: req.params.id } });
        if (!grupo) throw new AppError(404, "No se encontró el grupo.");
        if (!aCargo(grupo, emailDe(req), rol)) throw new AppError(403, "Este grupo no está a tu cargo.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Acciones sobre un evento: fuera del administrador, solo si es de un grupo a su cargo.
function sobreEvento(permitidos) {
  return async (req, res, next) => {
    try {
      const rol = await rolDe(emailDe(req));
      req.rolCultura = rol;
      if (!permitidos.includes(rol)) throw new AppError(403, SIN_ROL);
      if (rol !== "administrador") {
        const evento = await prisma.eventoCultural.findUnique({ where: { id: req.params.id } });
        if (!evento) throw new AppError(404, "No se encontró el evento.");
        const grupo = evento.grupoId ? await prisma.grupoCultural.findUnique({ where: { id: evento.grupoId } }) : null;
        if (!eventoACargo(evento, grupo, emailDe(req), rol)) throw new AppError(403, "Este evento no está a tu cargo.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Citar, aceptar o rechazar una postulacion: el administrador, o el docente del grupo de la audicion.
function sobrePostulacion() {
  return async (req, res, next) => {
    try {
      const rol = await rolDe(emailDe(req));
      req.rolCultura = rol;
      if (rol !== "administrador") {
        if (rol !== "docente") throw new AppError(403, SIN_ROL);
        const postulacion = await prisma.postulacionCultural.findUnique({ where: { id: req.params.id } });
        if (!postulacion) throw new AppError(404, "No se encontró la postulación.");
        const convocatoria = await prisma.convocatoriaCultural.findUnique({ where: { id: postulacion.convocatoriaId } });
        const grupo = convocatoria?.grupoId ? await prisma.grupoCultural.findUnique({ where: { id: convocatoria.grupoId } }) : null;
        if (!grupo || grupo.docenteEmail !== emailDe(req)) throw new AppError(403, "Solo quien dirige el grupo de la audición puede decidir.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Docentes y monitores solo ven los grupos a su cargo.
function soloLosSuyos(lista, req) {
  const rol = req.rolCultura;
  if (rol === "administrador") return lista;
  return lista.filter((g) => aCargo(g, emailDe(req), rol));
}

// A cada evento le dice si quien consulta puede operar su asistencia (es de un grupo a su cargo).
async function conPermisoDeOperar(lista, req) {
  const rol = req.rolCultura;
  if (rol === "administrador") return lista.map((e) => ({ ...e, puedeOperar: true }));
  const grupos = await prisma.grupoCultural.findMany();
  return lista.map((e) => ({ ...e, puedeOperar: eventoACargo(e, grupos.find((g) => g.id === e.grupoId), emailDe(req), rol) }));
}

// A cada convocatoria le dice si quien consulta puede decidir sobre sus postulaciones.
async function conPermisoDeDecidir(lista, req) {
  const rol = req.rolCultura;
  const grupos = rol === "docente" ? await prisma.grupoCultural.findMany() : [];
  return lista.map((c) => ({ ...c, puedeDecidir: rol === "administrador" || (rol === "docente" && grupos.some((g) => g.id === c.grupoId && g.docenteEmail === emailDe(req))) }));
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
  const [filas, participantes, grupos, usuarios, evidencias] = await Promise.all([
    prisma.representacionRed.findMany({ orderBy: { fecha: "desc" } }),
    prisma.participanteRed.findMany(),
    prisma.grupoCultural.findMany(),
    prisma.usuario.findMany(),
    prisma.evidenciaCultural.findMany(),
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
      // Oficio de invitacion y soportes de la delegacion.
      documentos: evidencias
        .filter((e) => e.representacionId === f.id)
        .map((e) => ({ id: e.id, tipo: e.tipo, nombreOriginal: e.nombreOriginal, mime: e.mime })),
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
  return pausas.map((p) => {
    const propias = evidencias.filter((e) => e.pausaId === p.id);
    return {
      ...p,
      fecha: iso(p.fecha),
      evidencias: propias.length,
      // Fotos de la pausa (son evidencias privadas: el panel las pide con la sesion).
      fotos: propias.filter((e) => e.mime.startsWith("image/")).map((e) => ({ id: e.id, nombreOriginal: e.nombreOriginal })),
    };
  });
}

async function crearPausa(body, email) {
  const horaInicio = hora(body.horaInicio);
  const horaFin = hora(body.horaFin);
  if (horaFin <= horaInicio) throw new AppError(400, "La hora de fin debe ser posterior a la de inicio.");
  return prisma.pausaCreativa.create({
    data: {
      fecha: fechaDia(body.fecha, "La fecha"),
      horaInicio,
      horaFin,
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
  const [grupales, perfiles, usuarios, eventos, asistentesEvento, representaciones, participantesRed] = await Promise.all([
    prisma.asistenciaCultural.findMany({ where: { presente: true } }),
    prisma.perfilCultural.findMany(),
    prisma.usuario.findMany(),
    prisma.eventoCultural.findMany(),
    prisma.inscripcionEventoCultural.findMany({ where: { asistio: true } }),
    prisma.representacionRed.findMany(),
    prisma.participanteRed.findMany(),
  ]);
  const fechaEvento = new Map(eventos.map((e) => [e.id, e.fecha]));
  const fechaRepresentacion = new Map(representaciones.map((r) => [r.id, r.fecha]));
  const asistencias = [
    ...grupales,
    ...asistentesEvento.map((a) => ({ usuarioId: a.usuarioId, fechaHora: a.fechaAsistencia || fechaEvento.get(a.eventoId) })),
    ...participantesRed.map((p) => ({ usuarioId: p.usuarioId, fechaHora: fechaRepresentacion.get(p.representacionId) })),
  ].filter((a) => a.fechaHora);
  const perfilDe = new Map(perfiles.map((p) => [p.usuarioId, p]));
  const usuarioDe = new Map(usuarios.map((u) => [u.id, u]));
  const programaPedido = String(filtro.programa || "").trim().toLowerCase();
  const sinTildes = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cuentas = new Map();
  for (const a of asistencias) {
    if (desde && new Date(a.fechaHora) < desde) continue;
    if (hasta && new Date(a.fechaHora).getTime() >= hasta.getTime() + 86400000) continue;
    const perfil = perfilDe.get(a.usuarioId);
    const programa = perfil?.programa || "Sin programa";
    if (programaPedido && sinTildes(programa.toLowerCase()) !== sinTildes(programaPedido)) continue;
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
      .map((p) => ({ id: p.id, fecha: iso(p.fecha), horaInicio: p.horaInicio, horaFin: p.horaFin, lugar: p.lugar, tecnica: p.tecnica, impactoEstimado: p.impactoEstimado, evidencias: evidencias.filter((e) => e.pausaId === p.id).length })),
    representaciones: representaciones
      .filter((r) => pasa({ nombre: `${r.red} ${r.nombre} ${r.posicion || ""}`, fecha: r.fecha }))
      .map((r) => ({ id: r.id, red: r.red, nombre: r.nombre, fecha: iso(r.fecha), posicion: r.posicion })),
  };
}

async function listarEquipo() {
  const [accesos, roles, usuarios, grupos, eventos] = await Promise.all([
    prisma.accesoModulo.findMany({ where: { modulo: "cultura" } }),
    prisma.rolOperativoCultural.findMany(),
    prisma.usuario.findMany(),
    prisma.grupoCultural.findMany(),
    prisma.eventoCultural.findMany(),
  ]);
  const rolDeEmail = new Map(roles.filter((r) => ROLES_OPERATIVOS.includes(r.rol)).map((r) => [r.email, r.rol]));
  const hayAdmin = accesos.some((a) => rolDeEmail.get(a.email) === "administrador");
  const nombreDe = new Map(usuarios.map((u) => [String(u.emailInstitucional || "").toLowerCase(), u.nombre]));
  return accesos
    .map((a) => {
      const rol = rolDeEmail.get(a.email) || (hayAdmin ? "monitor" : "administrador");
      const dirige = grupos.filter((g) => g.docenteEmail === a.email).map((g) => ({ id: g.id, nombre: g.nombre }));
      const ayuda = grupos.filter((g) => g.docenteEmail !== a.email && monitoresDe(g).includes(a.email)).map((g) => ({ id: g.id, nombre: g.nombre }));
      return {
        email: a.email,
        nombre: nombreDe.get(a.email) || "",
        rol,
        roles: ROLES_OPERATIVOS,
        asignadoPor: a.asignadoPor || null,
        dirige,
        ayuda,
        grupos: [...dirige, ...ayuda],
        eventos: eventos.filter((e) => responsablesDeEvento(e).includes(a.email)).map((e) => ({ id: e.id, nombre: e.nombre, fecha: iso(e.fecha) })),
      };
    })
    .sort((x, y) => x.email.localeCompare(y.email));
}

async function asignarRol(email, rol) {
  const correo = String(email || "").trim().toLowerCase();
  if (!ROLES_OPERATIVOS.includes(rol)) throw new AppError(400, "El rol debe ser administrador, docente o monitor.");
  const acceso = await prisma.accesoModulo.findFirst({ where: { email: correo, modulo: "cultura" } });
  if (!acceso) throw new AppError(400, "Ese correo no está en la lista de Cultura. Pide al superadministrador que lo asigne primero.");
  // Siempre debe quedar alguien que administre el area: sin un administrador
  // nadie podria volver a asignar roles ni ver Redes, Apoyo o Informes.
  if (rol !== "administrador") {
    const otrosAdmin = (await listarEquipo()).filter((m) => m.rol === "administrador" && m.email !== correo);
    if (!otrosAdmin.length) throw new AppError(409, "Arte y Cultura debe tener al menos un administrador. Asigna otro administrador antes de cambiar este rol.");
  }
  const previo = await prisma.rolOperativoCultural.findFirst({ where: { email: correo } });
  if (previo) await prisma.rolOperativoCultural.update({ where: { email: correo }, data: { rol } });
  else await prisma.rolOperativoCultural.create({ data: { email: correo, rol } });
  return { email: correo, rol };
}

// El administrador del area suma a una persona a su equipo: queda con acceso a Cultura y con el rol elegido.
async function agregarPersona(body = {}, asignadoPor) {
  const correo = String(body.email || "").trim().toLowerCase();
  const rol = body.rol || "monitor";
  if (!ROLES_OPERATIVOS.includes(rol)) throw new AppError(400, "El rol debe ser administrador, docente o monitor.");
  const { accesoService } = require("../super/services/AccesoService");
  if (await prisma.accesoModulo.findFirst({ where: { email: correo, modulo: "cultura" } })) throw new AppError(409, `${correo} ya está en el equipo de Arte y Cultura.`);
  await accesoService.asignar({ email: correo, modulo: "cultura" }, asignadoPor, { avisar: false });
  await asignarRol(correo, rol);
  await notificaciones.crearPorCorreo(correo, { modulo: "cultura", tipo: "equipo", titulo: "Te agregaron al equipo de Arte y Cultura", mensaje: `Quedaste con el rol de ${rol}. Entra al panel de Arte y Cultura para empezar.`, ruta: "/cultura" });
  return { email: correo, rol };
}

// Quita el acceso a Cultura (sigue teniendo los demas modulos que tenga). Siempre queda un administrador.
async function quitarPersona(emailCrudo, quienLoPide) {
  const correo = String(emailCrudo || "").trim().toLowerCase();
  const acceso = await prisma.accesoModulo.findFirst({ where: { email: correo, modulo: "cultura" } });
  if (!acceso) throw new AppError(404, "Esa persona no está en el equipo de Arte y Cultura.");
  if (correo === String(quienLoPide || "").toLowerCase()) throw new AppError(409, "No puedes quitarte a ti mismo. Pídele a otro administrador que lo haga.");
  const equipo = await listarEquipo();
  const persona = equipo.find((m) => m.email === correo);
  if (persona?.rol === "administrador" && !equipo.some((m) => m.rol === "administrador" && m.email !== correo)) {
    throw new AppError(409, "Arte y Cultura debe tener al menos un administrador. Asigna otro antes de quitar a esta persona.");
  }
  const { accesoService } = require("../super/services/AccesoService");
  await accesoService.quitar(acceso.id, { avisar: false });
  await prisma.rolOperativoCultural.deleteMany({ where: { email: correo } });
  await notificaciones.crearPorCorreo(correo, { modulo: "cultura", tipo: "equipo", titulo: "Ya no estás en el equipo de Arte y Cultura", mensaje: "La coordinación quitó tu acceso al panel del área.", ruta: "/" });
  const grupos = await prisma.grupoCultural.findMany();
  for (const g of grupos) {
    const datos = {};
    if (g.docenteEmail === correo) datos.docenteEmail = null;
    if (monitoresDe(g).includes(correo)) datos.monitoresEmails = monitoresDe(g).filter((m) => m !== correo);
    if (Object.keys(datos).length) await prisma.grupoCultural.update({ where: { id: g.id }, data: datos });
  }
  return { eliminado: correo };
}

const normalizarCorreo = (v) => String(v || "").trim().toLowerCase();
const listaDeCorreos = (v) => [...new Set((Array.isArray(v) ? v : []).map(normalizarCorreo).filter(Boolean))];

// Quien dirige un grupo y quienes lo ayudan, elegidos entre el equipo. Siempre hay al menos una
// persona a cargo: si no se indica ninguna al crearlo, queda a cargo quien lo crea (porDefecto).
async function fijarResponsables(grupoId, body = {}, { porDefecto, actor } = {}) {
  const grupo = await prisma.grupoCultural.findUnique({ where: { id: grupoId } });
  if (!grupo) throw new AppError(404, "No se encontró el grupo.");
  const equipo = await listarEquipo();
  const rolDeCorreo = new Map(equipo.map((m) => [m.email, m.rol]));
  let docenteEmail = normalizarCorreo(body.docenteEmail) || null;
  const monitoresEmails = listaDeCorreos(body.monitoresEmails).filter((m) => m !== docenteEmail);
  if (!docenteEmail && !monitoresEmails.length) {
    if (!porDefecto) throw new AppError(400, "Debe haber al menos una persona a cargo del grupo.");
    docenteEmail = normalizarCorreo(porDefecto);
  }
  if (docenteEmail && !["docente", "administrador"].includes(rolDeCorreo.get(docenteEmail))) throw new AppError(400, "Quien dirige el grupo debe ser docente o administrador del equipo.");
  if (monitoresEmails.some((m) => !["docente", "monitor"].includes(rolDeCorreo.get(m)))) throw new AppError(400, "Quienes ayudan en el grupo deben ser docentes o monitores del equipo.");
  const actualizado = await prisma.grupoCultural.update({ where: { id: grupoId }, data: { docenteEmail, monitoresEmails } });
  const antes = new Set([grupo.docenteEmail, ...monitoresDe(grupo)].filter(Boolean));
  const ahora = new Set([docenteEmail, ...monitoresEmails].filter(Boolean));
  const quien = normalizarCorreo(actor);
  for (const email of ahora) {
    if (email !== quien && (!antes.has(email) || (email === docenteEmail) !== (email === grupo.docenteEmail))) {
      await notificaciones.crearPorCorreo(email, { modulo: "cultura", tipo: "equipo", titulo: "Quedaste a cargo de un grupo", mensaje: `${email === docenteEmail ? "Diriges" : "Ayudas en"} ${grupo.nombre}.`, ruta: "/cultura/grupos" });
    }
  }
  for (const email of antes) {
    if (email !== quien && !ahora.has(email)) await notificaciones.crearPorCorreo(email, { modulo: "cultura", tipo: "equipo", titulo: "Cambió tu asignación", mensaje: `Ya no estás a cargo de ${grupo.nombre}.`, ruta: "/cultura/grupos" });
  }
  return actualizado;
}

// Personas a cargo de un evento (opcional, del equipo). Sin nadie, lo maneja la coordinacion.
async function fijarResponsablesEvento(eventoId, body = {}, { actor } = {}) {
  const evento = await prisma.eventoCultural.findUnique({ where: { id: eventoId } });
  if (!evento) throw new AppError(404, "No se encontró el evento.");
  const equipo = await listarEquipo();
  const delEquipo = new Set(equipo.map((m) => m.email));
  const responsablesEmails = listaDeCorreos(body.responsablesEmails);
  if (responsablesEmails.some((m) => !delEquipo.has(m))) throw new AppError(400, "Las personas a cargo deben ser del equipo de Arte y Cultura.");
  const actualizado = await prisma.eventoCultural.update({ where: { id: eventoId }, data: { responsablesEmails } });
  const antes = new Set(responsablesDeEvento(evento));
  const quien = normalizarCorreo(actor);
  for (const email of responsablesEmails) {
    if (email !== quien && !antes.has(email)) await notificaciones.crearPorCorreo(email, { modulo: "cultura", tipo: "equipo", titulo: "Quedaste a cargo de un evento", mensaje: `Tomas la asistencia de ${evento.nombre}.`, ruta: "/cultura/agenda" });
  }
  for (const email of antes) {
    if (email !== quien && !responsablesEmails.includes(email)) await notificaciones.crearPorCorreo(email, { modulo: "cultura", tipo: "equipo", titulo: "Cambió tu asignación", mensaje: `Ya no estás a cargo de ${evento.nombre}.`, ruta: "/cultura/agenda" });
  }
  return actualizado;
}

// Avisos a los estudiantes cuando se publica algo en Arte y Cultura.
const textoFecha = (d) => (d ? new Date(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");

function avisarEventoPublicado(evento) {
  if (evento?.estado !== "Publicado") return;
  return notificaciones.difundirAEstudiantes({
    modulo: "cultura",
    tipo: "evento-publicado",
    titulo: "Nuevo evento en Arte y Cultura",
    mensaje: `${evento.nombre}: ${textoFecha(evento.fecha)}, ${evento.horaInicio} a ${evento.horaFin}${evento.lugar ? ` · ${evento.lugar}` : ""}.`,
    ruta: "/mi-cultura/agenda",
  });
}

async function avisarConvocatoria(convocatoria) {
  if (convocatoria?.estado !== "Abierta") return;
  const grupo = convocatoria.grupoId ? await prisma.grupoCultural.findUnique({ where: { id: convocatoria.grupoId } }) : null;
  return notificaciones.difundirAEstudiantes({
    modulo: "cultura",
    tipo: "convocatoria",
    titulo: "Convocatoria abierta",
    mensaje: `${convocatoria.titulo}${grupo ? ` para entrar a ${grupo.nombre}` : ""}. Cierra el ${textoFecha(convocatoria.cierra)}.`,
    ruta: "/mi-cultura/convocatorias",
  });
}

async function avisarGrupo(grupo) {
  if (!grupo?.activo || !grupo.inscripcionesAbiertas) return;
  const area = await prisma.areaCultural.findUnique({ where: { id: grupo.areaId } });
  const representativo = area?.categoria === "representativo";
  return notificaciones.difundirAEstudiantes({
    modulo: "cultura",
    tipo: "grupo-nuevo",
    titulo: representativo ? "Nuevo grupo representativo" : "Nuevo taller disponible",
    mensaje: representativo ? `${grupo.nombre} abre sus puertas. Se entra por audición: mira las convocatorias.` : `Ya puedes inscribirte en ${grupo.nombre}.`,
    ruta: representativo ? "/mi-cultura/convocatorias" : "/mi-cultura/grupos",
  });
}

// Editar un evento: si pasa de borrador a publicado, se avisa.
async function editarEventoYAvisar(editar, id, body) {
  const previo = await prisma.eventoCultural.findUnique({ where: { id } });
  const actualizado = await editar(id, body);
  if (previo && previo.estado !== "Publicado") await avisarEventoPublicado(actualizado);
  return actualizado;
}

async function crearConvocatoriaYAvisar(crear, body) {
  const creada = await crear(body);
  await avisarConvocatoria(creada);
  return creada;
}

// Crea el grupo o el evento y le deja su equipo a cargo; si el equipo no es valido, no queda creado.
async function crearGrupoConResponsables(crear, body, creador) {
  const grupo = await crear(body);
  try {
    const listo = await fijarResponsables(grupo.id, body, { porDefecto: creador, actor: creador });
    await avisarGrupo(listo);
    return listo;
  } catch (err) {
    await prisma.grupoCultural.delete({ where: { id: grupo.id } });
    throw err;
  }
}

async function crearEventoConResponsables(crear, body, creador) {
  const evento = await crear(body);
  try {
    const listo = await fijarResponsablesEvento(evento.id, body, { actor: creador });
    await avisarEventoPublicado(listo);
    return listo;
  } catch (err) {
    await prisma.eventoCultural.delete({ where: { id: evento.id } });
    throw err;
  }
}

// Avisa a quienes les toca saber de una accion de un estudiante: la coordinacion y quienes estan a cargo
// del grupo (o del evento y del grupo que se presenta).
async function avisarAlEquipo({ grupo = null, evento = null }, datos) {
  try {
    const correos = new Set(await correosDeAdministradores());
    const sumar = (g) => [g?.docenteEmail, ...monitoresDe(g)].filter(Boolean).forEach((c) => correos.add(c));
    sumar(grupo);
    if (evento) {
      responsablesDeEvento(evento).forEach((c) => correos.add(c));
      if (evento.grupoId) sumar(await prisma.grupoCultural.findUnique({ where: { id: evento.grupoId } }));
    }
    for (const correo of correos) await notificaciones.crearPorCorreo(correo, { modulo: "cultura", tipo: "inscripcion", ...datos });
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar al equipo de Cultura: ${err.message}`);
  }
}

// Correos de la coordinacion del area (reciben lo que no tiene un responsable concreto).
async function correosDeAdministradores() {
  return (await listarEquipo()).filter((m) => m.rol === "administrador").map((m) => m.email);
}

module.exports = {
  avisarAlEquipo,
  editarEventoYAvisar,
  crearConvocatoriaYAvisar,
  correosDeAdministradores,
  sobreGrupo,
  sobreEvento,
  sobrePostulacion,
  soloLosSuyos,
  conPermisoDeDecidir,
  conPermisoDeOperar,
  agregarPersona,
  quitarPersona,
  fijarResponsables,
  fijarResponsablesEvento,
  crearGrupoConResponsables,
  crearEventoConResponsables,
  texto,
  fechaDia,
  entero,
  grupoONull,
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
