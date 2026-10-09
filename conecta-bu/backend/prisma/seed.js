// Roles de Conecta BU: Estudiante, Administrador (personal de un modulo) y
// SuperAdministrador (controla todos los modulos y asigna los accesos).
// Ejecutar con: npm run prisma:seed
// Opcional en .env (cada uno crea o actualiza un usuario de prueba):
//   SUPERADMIN_EMAIL / SUPERADMIN_NOMBRE -> superadministrador
//   ADMIN_EMAIL / ADMIN_NOMBRE           -> personal de Desarrollo humano y orientacion
//   SALUD_EMAIL / SALUD_NOMBRE           -> personal de Salud integral
//   DEPORTE_EMAIL / DEPORTE_NOMBRE       -> personal de Deporte

// "npm run prisma:seed" corre con node directamente: hay que cargar el .env
// para leer SUPERADMIN_EMAIL, ADMIN_EMAIL y SALUD_EMAIL.
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function rol(nombre) {
  return prisma.rol.upsert({ where: { nombre }, update: {}, create: { nombre } });
}

async function usuarioDePrueba(email, nombre, rolId) {
  email = email.trim().toLowerCase();
  return prisma.usuario.upsert({
    where: { emailInstitucional: email },
    update: { rolId, habilitado: true },
    create: { emailInstitucional: email, nombre, rolId },
  });
}

async function darAcceso(email, modulo) {
  await prisma.accesoModulo.upsert({
    where: { email_modulo: { email: email.toLowerCase(), modulo } },
    update: {},
    create: { email: email.toLowerCase(), modulo, asignadoPor: "seed" },
  });
}

async function main() {
  const estudiante = await rol("Estudiante");
  const administrador = await rol("Administrador");
  const superadmin = await rol("SuperAdministrador");
  console.log("Roles listos:", [estudiante.nombre, administrador.nombre, superadmin.nombre].join(", "));

  if (process.env.SUPERADMIN_EMAIL) {
    const u = await usuarioDePrueba(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_NOMBRE || "Superadministrador Conecta BU", superadmin.id);
    console.log("Superadministrador listo:", u.emailInstitucional);
  } else {
    console.log("No se definio SUPERADMIN_EMAIL: no se creo superadministrador.");
  }
  if (process.env.ADMIN_EMAIL) {
    const u = await usuarioDePrueba(process.env.ADMIN_EMAIL, process.env.ADMIN_NOMBRE || "Administrador Desarrollo Humano", administrador.id);
    await darAcceso(u.emailInstitucional, "desarrollo-humano");
    console.log("Personal de Desarrollo humano listo:", u.emailInstitucional);
  }
  if (process.env.SALUD_EMAIL) {
    const u = await usuarioDePrueba(process.env.SALUD_EMAIL, process.env.SALUD_NOMBRE || "Personal de Salud", administrador.id);
    await darAcceso(u.emailInstitucional, "salud");
    console.log("Personal de Salud listo:", u.emailInstitucional);
  }
  if (process.env.DEPORTE_EMAIL) {
    const u = await usuarioDePrueba(process.env.DEPORTE_EMAIL, process.env.DEPORTE_NOMBRE || "Coordinación de Deportes", administrador.id);
    await darAcceso(u.emailInstitucional, "deporte");
    console.log("Personal de Deporte listo:", u.emailInstitucional);
  }

  await seedServiciosYHorarios();
  await seedEventos();
  await seedSalud();
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

// Sprint 4 (RF-009 / RF-010): eventos de ejemplo para probar "Eventos" e
// inscripciones. Solo se crean si todavia no hay eventos.
async function seedEventos() {
  const existentes = await prisma.evento.count();
  if (existentes > 0) {
    console.log("Ya existen eventos cargados: se omite el seed de eventos.");
    return;
  }

  const diaUTC = (diasDesdeHoy) => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasDesdeHoy));
  };
  const horaUTC = (hora, minuto = 0) => new Date(Date.UTC(1970, 0, 1, hora, minuto, 0));

  await prisma.evento.createMany({
    data: [
      {
        nombre: "Taller de mindfulness y respiración",
        descripcion: "Técnicas sencillas de atención plena para reducir la ansiedad en época de parciales.",
        lugar: "Auditorio principal",
        fecha: diaUTC(7),
        horaInicio: horaUTC(14),
        horaFin: horaUTC(16),
        cupos: 30,
        fechaLimiteInscripcion: diaUTC(5),
        estado: "Publicado",
      },
      {
        nombre: "Charla: hábitos de estudio saludables",
        descripcion: "Organización del tiempo, descanso y hábitos que ayudan al rendimiento académico.",
        lugar: "Sala de conferencias B",
        fecha: diaUTC(12),
        horaInicio: horaUTC(10),
        horaFin: horaUTC(11, 30),
        cupos: 40,
        fechaLimiteInscripcion: diaUTC(10),
        estado: "Publicado",
      },
      {
        nombre: "Jornada de integración de primer semestre",
        descripcion: "Actividad en preparación (borrador): aún no visible para los estudiantes.",
        lugar: "Plazoleta central",
        fecha: diaUTC(20),
        horaInicio: horaUTC(9),
        horaFin: horaUTC(12),
        cupos: 80,
        fechaLimiteInscripcion: diaUTC(18),
        estado: "Borrador",
      },
    ],
  });
  console.log("Eventos de ejemplo creados (3).");
}

// Modulo Salud integral: servicios con cita (modulo "salud"), algunos
// horarios y el catalogo de actividades del periodo actual (tomado del
// reporte SNIES). Cada parte se crea solo si todavia no existe.
async function seedSalud() {
  const { ACTIVIDADES_BASE, periodoDeFecha, rangoDePeriodo } = require("../src/modules/salud/catalogos");

  const serviciosSalud = await prisma.servicio.count({ where: { modulo: "salud" } });
  if (serviciosSalud === 0) {
    const enfermeria = await prisma.servicio.create({
      data: {
        nombre: "Consulta de enfermería",
        descripcion: "Valoración básica, toma de signos vitales, curaciones y orientación en salud.",
        modulo: "salud",
      },
    });
    const medica = await prisma.servicio.create({
      data: {
        nombre: "Atención médica",
        descripcion: "Consulta médica general en la Unidad de Salud Integral.",
        modulo: "salud",
      },
    });
    await prisma.servicio.create({
      data: {
        nombre: "Telemedicina",
        descripcion: "Atención básica a distancia por videollamada.",
        modulo: "salud",
      },
    });

    const horaUTC = (hora, minuto = 0) => new Date(Date.UTC(1970, 0, 1, hora, minuto, 0));
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    let creados = 0;
    for (let i = 0; creados < 9; i += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if ([0, 6].includes(cursor.getUTCDay())) continue;
      for (const [servicio, hora] of [[enfermeria, 8], [enfermeria, 9], [medica, 14]]) {
        await prisma.horario.create({
          data: { servicioId: servicio.id, fecha: new Date(cursor), horaInicio: horaUTC(hora), horaFin: horaUTC(hora, 30) },
        });
        creados += 1;
      }
    }
    console.log("Servicios y horarios de Salud creados.");
  }

  const periodo = periodoDeFecha(new Date());
  const existentes = await prisma.actividadSalud.count({ where: { periodo } });
  if (existentes > 0) {
    console.log(`Ya existen actividades de Salud para ${periodo}: se omite el catalogo.`);
    return;
  }
  const rango = rangoDePeriodo(periodo);
  await prisma.actividadSalud.createMany({
    data: ACTIVIDADES_BASE.map((a, i) => ({
      codigo: i + 1,
      periodo,
      nombre: a.nombre,
      categoria: a.categoria,
      permanente: Boolean(a.permanente),
      clinica: Boolean(a.clinica),
      fechaInicio: rango.desde,
      fechaFin: rango.hasta,
      meta: 1,
    })),
  });
  console.log(`Catalogo de actividades de Salud ${periodo} creado (${ACTIVIDADES_BASE.length}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
