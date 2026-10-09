const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { config } = require("../../config/env");
const { exigirMismoModulo } = require("../../common/utils/modulos");
const { aFechaUTC, aHoraUTC, hoyBogota } = require("../../common/utils/fechas");

// Atencion sin cita: el estudiante llega sin haber pedido cita y el
// profesional lo atiende porque esta disponible. Se registra como una cita
// ya atendida sobre un horario creado en el momento (marcado sinCita), para
// que cuente en las estadisticas y en el historial del estudiante igual que
// una cita normal, sin aparecer en la lista de horarios publicados.

const DURACIONES = [15, 20, 30, 45, 60, 90];

function texto(v, max) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

// Hora actual en Bogota como "HH:mm".
function horaBogota() {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// Busca estudiantes por nombre o correo para el formulario.
async function buscarEstudiantes(q) {
  const termino = texto(q, 80);
  if (termino.length < 2) return [];
  const usuarios = await prisma.usuario.findMany({
    where: {
      rol: { nombre: "Estudiante" },
      OR: [{ nombre: { contains: termino, mode: "insensitive" } }, { emailInstitucional: { contains: termino, mode: "insensitive" } }],
    },
    orderBy: { nombre: "asc" },
    take: 8,
  });
  return usuarios.slice(0, 8).map((u) => ({ id: u.id, nombre: u.nombre, email: u.emailInstitucional }));
}

// Estudiante elegido de la lista o, si nunca ha entrado a Conecta BU, uno
// nuevo con su correo institucional (cuando entre con Google se usa el mismo
// registro).
async function resolverEstudiante({ usuarioId, correo, nombre }, tx) {
  if (usuarioId) {
    const usuario = await tx.usuario.findUnique({ where: { id: String(usuarioId) } });
    if (!usuario) throw new AppError(404, "No encontramos a ese estudiante.");
    return usuario;
  }
  const email = texto(correo, 120).toLowerCase();
  if (!email) throw new AppError(400, "Elige al estudiante o escribe su correo institucional.");
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.split("@")[1] !== config.allowedGoogleDomain) {
    throw new AppError(400, `Usa el correo institucional del estudiante (@${config.allowedGoogleDomain}).`);
  }
  const existente = await tx.usuario.findUnique({ where: { emailInstitucional: email } });
  if (existente) return existente;
  const nombreLimpio = texto(nombre, 200);
  if (nombreLimpio.length < 3) throw new AppError(400, "Escribe el nombre completo del estudiante.");
  const rol = await tx.rol.findUnique({ where: { nombre: "Estudiante" } });
  if (!rol) throw new AppError(500, "El rol Estudiante no esta configurado. Ejecuta el seed de la base de datos.");
  return tx.usuario.create({ data: { emailInstitucional: email, nombre: nombreLimpio, rolId: rol.id } });
}

async function registrarAtencionSinCita(adminId, cuerpo = {}, modulo = "desarrollo-humano") {
  const servicio = await prisma.servicio.findUnique({ where: { id: String(cuerpo.servicioId || "") } });
  if (!servicio) throw new AppError(400, "Elige el servicio que prestaste.");
  exigirMismoModulo(servicio, modulo);

  const hoy = hoyBogota();
  const fecha = cuerpo.fecha ? aFechaUTC(cuerpo.fecha) : hoy;
  if (fecha > hoy) throw new AppError(400, "La atención sin cita se registra el mismo día o después, no por adelantado.");
  const hora = texto(cuerpo.hora, 5) || horaBogota();
  const inicio = aHoraUTC(hora);
  const duracion = DURACIONES.includes(Number(cuerpo.duracion)) ? Number(cuerpo.duracion) : 30;
  const minutosFin = Math.min(inicio.getUTCHours() * 60 + inicio.getUTCMinutes() + duracion, 23 * 60 + 59);
  const fin = new Date(Date.UTC(1970, 0, 1, Math.floor(minutosFin / 60), minutosFin % 60));
  const observaciones = texto(cuerpo.observaciones, 2000) || null;

  return prisma.$transaction(async (tx) => {
    const usuario = await resolverEstudiante(cuerpo, tx);
    const horario = await tx.horario.create({
      data: { servicioId: servicio.id, fecha, horaInicio: inicio, horaFin: fin, cupo: 1, ocupado: true, sinCita: true },
    });
    const cita = await tx.cita.create({
      data: { usuarioId: usuario.id, horarioId: horario.id, estado: "Atendida", observaciones },
    });
    await tx.asistenciaCita.create({ data: { citaId: cita.id, asistio: true, registradoPorId: adminId } });
    return tx.cita.findUnique({ where: { id: cita.id }, include: { usuario: true, horario: { include: { servicio: true } } } });
  });
}

module.exports = { buscarEstudiantes, registrarAtencionSinCita, DURACIONES };
