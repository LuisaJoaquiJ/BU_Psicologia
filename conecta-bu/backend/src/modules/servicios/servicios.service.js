const { prisma } = require("../../config/prisma");

// RF-003 / HU-06: lista los servicios de Desarrollo Humano / Orientacion
// publicados (activos) para que el estudiante los consulte.
async function listarServiciosActivos() {
  return prisma.servicio.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });
}

module.exports = { listarServiciosActivos };
