// Crea los dos roles iniciales (Estudiante, Administrador) definidos en F-02 / F-03.
// Ejecutar con: npm run prisma:seed
// Opcional: define ADMIN_EMAIL y ADMIN_NOMBRE en .env para crear/promover un administrador de prueba.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const estudiante = await prisma.rol.upsert({
    where: { nombre: "Estudiante" },
    update: {},
    create: { nombre: "Estudiante" },
  });

  const administrador = await prisma.rol.upsert({
    where: { nombre: "Administrador" },
    update: {},
    create: { nombre: "Administrador" },
  });

  console.log("Roles listos:", { estudiante: estudiante.id, administrador: administrador.id });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const admin = await prisma.usuario.upsert({
      where: { emailInstitucional: adminEmail },
      update: { rolId: administrador.id, habilitado: true },
      create: {
        emailInstitucional: adminEmail,
        nombre: process.env.ADMIN_NOMBRE || "Administrador Conecta BU",
        rolId: administrador.id,
      },
    });
    console.log("Usuario administrador listo:", admin.emailInstitucional);
  } else {
    console.log("No se definio ADMIN_EMAIL en .env: no se creo administrador de prueba.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
