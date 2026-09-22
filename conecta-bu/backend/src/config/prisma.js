const { PrismaClient } = require("@prisma/client");

// Cliente unico de Prisma para toda la aplicacion (evita abrir muchas conexiones).
const prisma = new PrismaClient();

module.exports = { prisma };
