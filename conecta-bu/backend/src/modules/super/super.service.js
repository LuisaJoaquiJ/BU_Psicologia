const { prisma } = require("../../config/prisma");
const { config } = require("../../config/env");
const { AppError } = require("../../common/utils/AppError");
const { MODULOS, moduloDeServicio } = require("../../common/utils/modulos");

// Superadministrador de Conecta BU: decide, por correo, que personal entra a
// cada modulo. Los modulos son independientes entre si: tener acceso a
// Desarrollo humano no da acceso a Salud integral, y al reves.

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function cambiarRol(usuario, nombreRol) {
  const rol = await prisma.rol.findUnique({ where: { nombre: nombreRol } });
  if (!rol || usuario.rolId === rol.id) return;
  await prisma.usuario.update({ where: { id: usuario.id }, data: { rolId: rol.id } });
}

async function listarAccesos() {
  const accesos = await prisma.accesoModulo.findMany({ orderBy: [{ modulo: "asc" }, { email: "asc" }] });
  const emails = [...new Set(accesos.map((a) => a.email))];
  const usuarios = emails.length
    ? await prisma.usuario.findMany({ where: { emailInstitucional: { in: emails } }, include: { rol: true } })
    : [];
  const porEmail = new Map(usuarios.map((u) => [u.emailInstitucional.toLowerCase(), u]));
  return {
    modulos: MODULOS,
    accesos: accesos.map((a) => {
      const u = porEmail.get(a.email);
      return {
        ...a,
        usuario: u ? { id: u.id, nombre: u.nombre, rol: u.rol?.nombre, habilitado: u.habilitado } : null,
      };
    }),
  };
}

async function asignarAcceso({ email, modulo }, asignadoPor) {
  const correo = normalizarEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new AppError(400, "Escribe un correo válido.");
  if (correo.split("@")[1] !== config.allowedGoogleDomain) {
    throw new AppError(400, `Solo se pueden asignar correos institucionales @${config.allowedGoogleDomain}.`);
  }
  if (!MODULOS[modulo]) throw new AppError(400, "El módulo indicado no existe.");

  const existente = await prisma.accesoModulo.findFirst({ where: { email: correo, modulo } });
  if (existente) throw new AppError(409, `${correo} ya tiene acceso a ${MODULOS[modulo]}.`);

  const acceso = await prisma.accesoModulo.create({ data: { email: correo, modulo, asignadoPor: asignadoPor || null } });

  // Si la persona ya inicio sesion como estudiante, pasa a ser personal.
  const usuario = await prisma.usuario.findFirst({
    where: { emailInstitucional: { equals: correo, mode: "insensitive" } },
    include: { rol: true },
  });
  if (usuario && usuario.rol?.nombre === "Estudiante") await cambiarRol(usuario, "Administrador");
  return acceso;
}

async function quitarAcceso(id) {
  const acceso = await prisma.accesoModulo.findUnique({ where: { id } });
  if (!acceso) throw new AppError(404, "El acceso no existe.");
  await prisma.accesoModulo.delete({ where: { id } });

  // Sin ningun modulo asignado, el personal vuelve a ser estudiante.
  const restantes = await prisma.accesoModulo.count({ where: { email: acceso.email } });
  if (restantes === 0) {
    const usuario = await prisma.usuario.findFirst({
      where: { emailInstitucional: { equals: acceso.email, mode: "insensitive" } },
      include: { rol: true },
    });
    if (usuario && usuario.rol?.nombre === "Administrador") await cambiarRol(usuario, "Estudiante");
  }
  return { eliminado: id };
}

// Vista general de Conecta BU para el superadministrador.
async function resumen() {
  const [usuarios, accesos, citas, eventos, atenciones, personas, informesPorRevisar] = await Promise.all([
    prisma.usuario.findMany({ include: { rol: true } }),
    prisma.accesoModulo.findMany(),
    prisma.cita.findMany({ include: { horario: { include: { servicio: true } } } }),
    prisma.evento.findMany({ where: { estado: { in: ["Publicado", "Cerrado"] } } }),
    prisma.atencionSalud.count(),
    prisma.personaSalud.count(),
    prisma.informeGestion.count({ where: { estado: "Enviado" } }),
  ]);
  const porRol = {};
  for (const u of usuarios) porRol[u.rol?.nombre] = (porRol[u.rol?.nombre] || 0) + 1;
  const citasDe = (m) => citas.filter((c) => moduloDeServicio(c.horario?.servicio) === m);
  return {
    informesPorRevisar,
    usuarios: { total: usuarios.length, porRol },
    modulos: [
      {
        id: "desarrollo-humano",
        nombre: MODULOS["desarrollo-humano"],
        personal: accesos.filter((a) => a.modulo === "desarrollo-humano").length,
        indicadores: [
          { nombre: "Citas", valor: citasDe("desarrollo-humano").length },
          { nombre: "Eventos publicados", valor: eventos.length },
        ],
      },
      {
        id: "salud",
        nombre: MODULOS.salud,
        personal: accesos.filter((a) => a.modulo === "salud").length,
        indicadores: [
          { nombre: "Citas", valor: citasDe("salud").length },
          { nombre: "Atenciones registradas", valor: atenciones },
          { nombre: "Personas", valor: personas },
        ],
      },
    ],
  };
}

module.exports = { listarAccesos, asignarAcceso, quitarAcceso, resumen, normalizarEmail };
