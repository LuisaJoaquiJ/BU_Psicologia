const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");

// Centro de notificaciones: avisos dentro de la plataforma para cada persona
// (citas, inscripciones, audiciones, equipo...). Crear un aviso nunca debe
// romper lo que lo origina, por eso crear() y crearPorCorreo() no lanzan errores.

const MAX_PAGINA = 50;

const publica = (n) => ({
  id: n.id,
  modulo: n.modulo,
  tipo: n.tipo,
  titulo: n.titulo,
  mensaje: n.mensaje,
  ruta: n.ruta || null,
  leida: Boolean(n.leida),
  fecha: n.fechaCreacion,
});

const recortar = (texto, max) => String(texto || "").slice(0, max);

// ---------------------------------------------------------------------------
// Quien ve que. Las notificaciones se guardan por usuario, pero el personal
// cambia de area (Super > Accesos) y las viejas se quedaban con su usuarioId:
// alguien que paso de Desarrollo Humano a Salud seguia viendo las alertas de
// crisis y los avisos de Orientacion. Por eso, al listar, contar, marcar o borrar
// se filtra por el area ACTUAL de la persona (sus accesos de hoy), sin migracion:
//   - Alertas de crisis (datos sensibles del estudiante): solo personal con
//     acceso actual a Desarrollo Humano. Nadie mas, ni el superadministrador
//     (no entra a los modulos; ve solo cifras e informes).
//   - Personal: las de sus areas actuales + las personales (acceso, equipo, general).
//   - Estudiantes: las suyas, menos las que eran del personal (si antes lo fue).
//   - Superadministrador: las suyas (informes...), menos las de crisis.
// ---------------------------------------------------------------------------
const TIPOS_CRISIS = ["alerta-crisis"];
const MODULO_CRISIS = "desarrollo-humano";
const TIPOS_PERSONALES = ["acceso", "equipo", "general"];
// Paneles del personal: un aviso que lleva ahi era para el personal, no para un estudiante.
const PANELES_PERSONAL = ["/admin", "/salud", "/deporte", "/super"];
const esCrisis = (tipo) => TIPOS_CRISIS.includes(String(tipo || ""));
// El docente de Deporte recibe los avisos de "deporte".
const areaDeAcceso = (modulo) => (modulo === "deporte-docente" ? "deporte" : modulo);

// Acepta el usuario de la sesion (req.usuario, con rol y modulos) o solo su id.
async function perfilDe(usuario) {
  if (usuario && typeof usuario === "object" && usuario.id && usuario.rol && Array.isArray(usuario.modulos)) {
    return { id: usuario.id, rol: usuario.rol?.nombre || usuario.rol, areas: [...new Set(usuario.modulos.map(areaDeAcceso))] };
  }
  const id = typeof usuario === "object" ? usuario?.id : usuario;
  const u = id ? await prisma.usuario.findUnique({ where: { id }, include: { rol: true } }) : null;
  if (!u) return { id, rol: null, areas: [] };
  const accesos = await prisma.accesoModulo.findMany({ where: { email: String(u.emailInstitucional || "").toLowerCase() } });
  return { id: u.id, rol: u.rol?.nombre || null, areas: [...new Set(accesos.map((a) => areaDeAcceso(a.modulo)))] };
}

const veCrisis = (perfil) => perfil.rol === "Administrador" && perfil.areas.includes(MODULO_CRISIS);

function filtroVisible(perfil) {
  const sinCrisis = { tipo: { notIn: TIPOS_CRISIS } };
  if (perfil.rol === "Administrador") {
    const deSusAreas = { OR: [{ modulo: { in: perfil.areas } }, { tipo: { in: TIPOS_PERSONALES } }] };
    return veCrisis(perfil) ? deSusAreas : { AND: [sinCrisis, deSusAreas] };
  }
  if (perfil.rol === "Estudiante") {
    const delPersonal = { OR: PANELES_PERSONAL.map((p) => ({ ruta: { startsWith: p } })) };
    return { AND: [sinCrisis, { OR: [{ tipo: { in: TIPOS_PERSONALES } }, { ruta: null }, { NOT: delPersonal }] }] };
  }
  return sinCrisis;
}

const dondeVe = (perfil, extra = {}) => ({ usuarioId: perfil.id, ...extra, AND: [filtroVisible(perfil)] });

// Una alerta de crisis solo se guarda si quien la recibe es hoy personal habilitado de Desarrollo Humano.
async function puedeRecibirCrisis(usuarioId) {
  const perfil = await perfilDe(usuarioId);
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  return Boolean(u?.habilitado) && veCrisis(perfil);
}

async function crear(usuarioId, { modulo = "general", tipo = "general", titulo, mensaje, ruta = null }) {
  if (!usuarioId || !titulo) return null;
  try {
    if (esCrisis(tipo) && (modulo !== MODULO_CRISIS || !(await puedeRecibirCrisis(usuarioId)))) {
      console.warn("[notificaciones] Alerta de crisis no enviada: quien la recibiria no es personal de Desarrollo Humano.");
      return null;
    }
    return await prisma.notificacion.create({
      data: { usuarioId, modulo: recortar(modulo, 30), tipo: recortar(tipo, 40), titulo: recortar(titulo, 150), mensaje: recortar(mensaje, 500), ruta: ruta ? recortar(ruta, 200) : null },
    });
  } catch (err) {
    console.error(`[notificaciones] No se pudo crear el aviso: ${err.message}`);
    return null;
  }
}

// Personal que aun no ha iniciado sesion no tiene usuario: en ese caso no hay a quien avisar.
async function crearPorCorreo(email, datos) {
  try {
    const usuario = await prisma.usuario.findFirst({ where: { emailInstitucional: String(email || "").trim().toLowerCase() } });
    return usuario ? await crear(usuario.id, datos) : null;
  } catch (err) {
    console.error(`[notificaciones] No se pudo buscar a ${email}: ${err.message}`);
    return null;
  }
}

// Aviso para los superadministradores (llego un informe para revisar...).
async function avisarASuperadministradores(datos) {
  try {
    const supers = await prisma.usuario.findMany({ where: { habilitado: true, rol: { nombre: "SuperAdministrador" } } });
    for (const u of supers) await crear(u.id, datos);
    return supers.length;
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar a los superadministradores: ${err.message}`);
    return 0;
  }
}

// Aviso para todo el personal con acceso a una dimension (llego una cita, una solicitud...).
// "excepto": quien origino el cambio no se avisa a si mismo.
async function avisarAlPersonal(modulo, datos, { excepto } = {}) {
  try {
    // Las alertas de crisis van solo al personal de Desarrollo Humano.
    if (esCrisis(datos?.tipo) && (modulo !== MODULO_CRISIS || datos?.modulo !== MODULO_CRISIS)) return 0;
    const omitir = String(excepto || "").trim().toLowerCase();
    const correos = [...new Set((await prisma.accesoModulo.findMany({ where: { modulo } })).map((a) => String(a.email).toLowerCase()))];
    for (const correo of correos) if (correo !== omitir) await crearPorCorreo(correo, datos);
    return correos.length;
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar al personal de ${modulo}: ${err.message}`);
    return 0;
  }
}

// Aviso para todos los estudiantes habilitados (se publico un evento, una convocatoria...). Si ya se
// aviso lo mismo (misma clase y mismo texto), no se repite: editar algo publicado no vuelve a avisar.
async function difundirAEstudiantes({ modulo = "general", tipo = "general", titulo, mensaje, ruta = null }, { unaVez = true } = {}) {
  try {
    if (!titulo) return 0;
    const base = { modulo: recortar(modulo, 30), tipo: recortar(tipo, 40), titulo: recortar(titulo, 150), mensaje: recortar(mensaje, 500), ruta: ruta ? recortar(ruta, 200) : null };
    if (unaVez && (await prisma.notificacion.findFirst({ where: { tipo: base.tipo, mensaje: base.mensaje } }))) return 0;
    const estudiantes = await prisma.usuario.findMany({ where: { habilitado: true, rol: { nombre: "Estudiante" } }, select: { id: true } });
    for (let i = 0; i < estudiantes.length; i += 500) {
      await prisma.notificacion.createMany({ data: estudiantes.slice(i, i + 500).map((u) => ({ usuarioId: u.id, ...base })) });
    }
    return estudiantes.length;
  } catch (err) {
    console.error(`[notificaciones] No se pudo avisar a los estudiantes: ${err.message}`);
    return 0;
  }
}

// "usuario": el de la sesion (req.usuario) o su id. Todo filtra por lo que la persona puede ver hoy.
async function listar(usuario, { soloNoLeidas = false, limite = 20, pagina = 1 } = {}) {
  const perfil = await perfilDe(usuario);
  const take = Math.min(Math.max(Number(limite) || 20, 1), MAX_PAGINA);
  const skip = (Math.max(Number(pagina) || 1, 1) - 1) * take;
  const where = dondeVe(perfil, soloNoLeidas ? { leida: false } : {});
  const [items, total, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({ where, orderBy: { fechaCreacion: "desc" }, skip, take }),
    prisma.notificacion.count({ where }),
    prisma.notificacion.count({ where: dondeVe(perfil, { leida: false }) }),
  ]);
  return { items: items.map(publica), total, noLeidas, pagina: Math.max(Number(pagina) || 1, 1), limite: take };
}

async function contarNoLeidas(usuario) {
  return prisma.notificacion.count({ where: dondeVe(await perfilDe(usuario), { leida: false }) });
}

// Una que la persona ya no puede ver (de otra area, o de crisis) responde igual que una ajena: 404.
async function deLaPersona(usuario, id) {
  const perfil = await perfilDe(usuario);
  const n = await prisma.notificacion.findFirst({ where: dondeVe(perfil, { id: String(id) }) });
  if (!n || n.usuarioId !== perfil.id) throw new AppError(404, "No se encontró la notificación.");
  return n;
}

async function marcarLeida(usuario, id) {
  await deLaPersona(usuario, id);
  return publica(await prisma.notificacion.update({ where: { id }, data: { leida: true } }));
}

async function marcarTodas(usuario) {
  const { count } = await prisma.notificacion.updateMany({ where: dondeVe(await perfilDe(usuario), { leida: false }), data: { leida: true } });
  return { marcadas: count };
}

async function eliminar(usuario, id) {
  await deLaPersona(usuario, id);
  await prisma.notificacion.delete({ where: { id } });
  return { eliminada: id };
}

module.exports = { crear, crearPorCorreo, avisarASuperadministradores, avisarAlPersonal, difundirAEstudiantes, listar, contarNoLeidas, marcarLeida, marcarTodas, eliminar, filtroVisible, TIPOS_CRISIS };
