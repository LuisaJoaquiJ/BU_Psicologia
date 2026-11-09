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

async function crear(usuarioId, { modulo = "general", tipo = "general", titulo, mensaje, ruta = null }) {
  if (!usuarioId || !titulo) return null;
  try {
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

async function listar(usuarioId, { soloNoLeidas = false, limite = 20, pagina = 1 } = {}) {
  const take = Math.min(Math.max(Number(limite) || 20, 1), MAX_PAGINA);
  const skip = (Math.max(Number(pagina) || 1, 1) - 1) * take;
  const where = { usuarioId, ...(soloNoLeidas ? { leida: false } : {}) };
  const [items, total, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({ where, orderBy: { fechaCreacion: "desc" }, skip, take }),
    prisma.notificacion.count({ where }),
    prisma.notificacion.count({ where: { usuarioId, leida: false } }),
  ]);
  return { items: items.map(publica), total, noLeidas, pagina: Math.max(Number(pagina) || 1, 1), limite: take };
}

const contarNoLeidas = (usuarioId) => prisma.notificacion.count({ where: { usuarioId, leida: false } });

async function deLaPersona(usuarioId, id) {
  const n = await prisma.notificacion.findUnique({ where: { id } });
  if (!n || n.usuarioId !== usuarioId) throw new AppError(404, "No se encontró la notificación.");
  return n;
}

async function marcarLeida(usuarioId, id) {
  await deLaPersona(usuarioId, id);
  return publica(await prisma.notificacion.update({ where: { id }, data: { leida: true } }));
}

async function marcarTodas(usuarioId) {
  const { count } = await prisma.notificacion.updateMany({ where: { usuarioId, leida: false }, data: { leida: true } });
  return { marcadas: count };
}

async function eliminar(usuarioId, id) {
  await deLaPersona(usuarioId, id);
  await prisma.notificacion.delete({ where: { id } });
  return { eliminada: id };
}

module.exports = { crear, crearPorCorreo, avisarASuperadministradores, avisarAlPersonal, difundirAEstudiantes, listar, contarNoLeidas, marcarLeida, marcarTodas, eliminar };
