const { prisma } = require("../../config/prisma");

const { moduloDeServicio } = require("../../common/utils/modulos");

// RF-003 / HU-06: lista los servicios publicados (activos) de un modulo de
// Bienestar (Desarrollo humano por defecto, o Salud integral).
async function listarServiciosActivos(modulo = "desarrollo-humano") {
  const servicios = await prisma.servicio.findMany({
    where: { activo: true, modulo },
    orderBy: { nombre: "asc" },
  });
  return servicios.filter((s) => moduloDeServicio(s) === modulo);
}

module.exports = { listarServiciosActivos };
