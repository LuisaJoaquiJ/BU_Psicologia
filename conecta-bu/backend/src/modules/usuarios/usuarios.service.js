const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");

const INCLUDE_ROL = { rol: true };

function serializarUsuarioAdmin(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.emailInstitucional,
    rol: usuario.rol?.nombre,
    habilitado: usuario.habilitado,
    fechaCreacion: usuario.fechaCreacion,
  };
}

// RF-012, pasos 2-3: consulta de usuarios con filtros opcionales.
async function listarUsuarios({ busqueda, rol, habilitado } = {}) {
  const where = {};
  if (rol) where.rol = { nombre: rol };
  if (habilitado === "true" || habilitado === "false") where.habilitado = habilitado === "true";
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: "insensitive" } },
      { emailInstitucional: { contains: busqueda, mode: "insensitive" } },
    ];
  }

  const usuarios = await prisma.usuario.findMany({ where, include: INCLUDE_ROL, orderBy: { nombre: "asc" } });
  return usuarios.map(serializarUsuarioAdmin);
}

async function listarRoles() {
  const roles = await prisma.rol.findMany({ orderBy: { nombre: "asc" } });
  return roles.map((r) => r.nombre);
}

async function obtenerUsuarioOFallar(id) {
  const usuario = await prisma.usuario.findUnique({ where: { id }, include: INCLUDE_ROL });
  if (!usuario) {
    throw new AppError(404, "El usuario no existe.");
  }
  return usuario;
}

// RF-012, flujo alternativo: el administrador no puede cambiarse a si mismo el
// rol ni deshabilitarse (evita quedarse sin acceso por error).
function validarNoEsElMismo(adminId, usuarioId) {
  if (adminId === usuarioId) {
    throw new AppError(403, "No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta.");
  }
}

// Siempre debe quedar al menos un superadministrador habilitado.
async function validarQuedaOtroAdmin(usuario) {
  if (usuario.rol?.nombre !== "SuperAdministrador" || !usuario.habilitado) return;
  const adminsHabilitados = await prisma.usuario.count({
    where: { habilitado: true, rol: { nombre: "SuperAdministrador" } },
  });
  if (adminsHabilitados <= 1) {
    throw new AppError(409, "Debe quedar al menos un superadministrador habilitado en Conecta BU.");
  }
}

// RF-012, paso 4: modifica el rol de un usuario.
async function cambiarRolUsuario(adminId, usuarioId, nombreRol) {
  validarNoEsElMismo(adminId, usuarioId);
  const usuario = await obtenerUsuarioOFallar(usuarioId);
  const rol = await prisma.rol.findUnique({ where: { nombre: nombreRol } });
  if (!rol) {
    throw new AppError(400, `El rol "${nombreRol}" no existe.`);
  }
  if (usuario.rolId === rol.id) {
    return serializarUsuarioAdmin(usuario);
  }
  await validarQuedaOtroAdmin(usuario);

  const actualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { rolId: rol.id },
    include: INCLUDE_ROL,
  });
  return serializarUsuarioAdmin(actualizado);
}

// RF-012, paso 4: habilita o deshabilita a un usuario. Un usuario
// deshabilitado no puede iniciar sesion y su token deja de ser valido de
// inmediato (auth.middleware revisa "habilitado" en cada peticion).
async function cambiarEstadoUsuario(adminId, usuarioId, habilitado) {
  if (typeof habilitado !== "boolean") {
    throw new AppError(400, "El campo habilitado debe ser true o false.");
  }
  validarNoEsElMismo(adminId, usuarioId);
  const usuario = await obtenerUsuarioOFallar(usuarioId);
  if (usuario.habilitado === habilitado) {
    return serializarUsuarioAdmin(usuario);
  }
  if (!habilitado) await validarQuedaOtroAdmin(usuario);

  const actualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { habilitado },
    include: INCLUDE_ROL,
  });
  return serializarUsuarioAdmin(actualizado);
}

module.exports = { listarUsuarios, listarRoles, cambiarRolUsuario, cambiarEstadoUsuario };
