const { prisma } = require("../../config/prisma");

// Correo del superadministrador definido en el .env (SUPERADMIN_EMAIL).
function correoSuperadmin() {
  return String(process.env.SUPERADMIN_EMAIL || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
}

// Si el usuario es el correo de SUPERADMIN_EMAIL y todavia no tiene el rol,
// se lo da. Se llama al iniciar sesion y en cada peticion autenticada, asi
// no hace falta cerrar sesion despues de cambiar el .env, y funciona aunque
// la base de datos no tenga el rol (lo crea si falta).
async function asegurarSuperadmin(usuario) {
  const correo = correoSuperadmin();
  if (!correo || !usuario || usuario.emailInstitucional.toLowerCase() !== correo) return usuario;
  if (usuario.rol?.nombre === "SuperAdministrador" && usuario.habilitado !== false) return usuario;
  const rolSuper =
    (await prisma.rol.findUnique({ where: { nombre: "SuperAdministrador" } })) ||
    (await prisma.rol.create({ data: { nombre: "SuperAdministrador" } }));
  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { rolId: rolSuper.id, habilitado: true },
    include: { rol: true },
  });
  return actualizado;
}

module.exports = { correoSuperadmin, asegurarSuperadmin };
