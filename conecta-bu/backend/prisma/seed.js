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

  await seedServiciosYHorarios();
}

// Sprint 2 (RF-003 / RF-004): un par de servicios y horarios de ejemplo para
// poder probar "Servicios" y "Agendar cita" sin tener que crearlos a mano.
// Solo se crean la primera vez (si ya existe al menos un servicio, se omite).
async function seedServiciosYHorarios() {
  const existentes = await prisma.servicio.count();
  if (existentes > 0) {
    console.log("Ya existen servicios cargados: se omite el seed de servicios/horarios.");
    return;
  }

  const orientacionIndividual = await prisma.servicio.create({
    data: {
      nombre: "Orientación psicológica individual",
      descripcion:
        "Acompañamiento personalizado para manejar situaciones academicas, emocionales o personales.",
      activo: true,
    },
  });

  const tallerGrupal = await prisma.servicio.create({
    data: {
      nombre: "Taller de manejo del estrés académico",
      descripcion: "Sesión grupal con herramientas prácticas para afrontar el estrés en época de parciales.",
      activo: true,
    },
  });

  const horaUTC = (hora, minuto = 0) => new Date(Date.UTC(1970, 0, 1, hora, minuto, 0));

  const proximosDiasHabiles = (cantidad) => {
    const dias = [];
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    cursor.setUTCDate(cursor.getUTCDate() + 1); // desde manana
    while (dias.length < cantidad) {
      const diaSemana = cursor.getUTCDay(); // 0 = domingo, 6 = sabado
      if (diaSemana !== 0 && diaSemana !== 6) {
        dias.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dias;
  };

  const dias = proximosDiasHabiles(4);
  const bloques = [
    { inicio: [9, 0], fin: [9, 45], servicioId: orientacionIndividual.id },
    { inicio: [10, 0], fin: [10, 45], servicioId: orientacionIndividual.id },
    { inicio: [15, 0], fin: [16, 0], servicioId: tallerGrupal.id },
  ];

  for (const fecha of dias) {
    for (const bloque of bloques) {
      await prisma.horario.create({
        data: {
          servicioId: bloque.servicioId,
          fecha,
          horaInicio: horaUTC(...bloque.inicio),
          horaFin: horaUTC(...bloque.fin),
          cupo: 1,
          ocupado: false,
        },
      });
    }
  }

  console.log(`Servicios y horarios de ejemplo creados (${dias.length * bloques.length} horarios).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
