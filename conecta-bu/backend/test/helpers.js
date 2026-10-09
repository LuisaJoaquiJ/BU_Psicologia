// Utilidades compartidas por las pruebas del Sprint 5.
const { prisma } = require("./mocks/prisma.mock");

function configurarEntorno(extra = {}) {
  Object.assign(process.env, {
    PORT: "4000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
    JWT_SECRET: "secreto-de-pruebas",
    GOOGLE_CLIENT_ID: "client-id-de-pruebas",
    ALLOWED_GOOGLE_DOMAIN: "uniautonoma.edu.co",
    FRONTEND_URL: "http://localhost:5173",
    ...extra,
  });
}

// Roles de prueba: "Administrador" = personal de Desarrollo humano;
// "Salud" = personal de Salud integral (rol Administrador con acceso solo a
// Salud); "SuperAdministrador" = controla todos los modulos.
function crearUsuario(rol, email, nombre) {
  const usuario = prisma.__seedUsuario({
    emailInstitucional: email,
    nombre: nombre || ({ Administrador: "Admin de Prueba", Salud: "Enfermera de Prueba", SuperAdministrador: "Super de Prueba" }[rol] || "Estudiante de Prueba"),
    rolId: { Administrador: "rol-administrador", Salud: "rol-administrador", SuperAdministrador: "rol-super" }[rol] || "rol-estudiante",
    ...(rol === "Salud" ? { modulos: ["salud"] } : {}),
  });
  rol = rol === "Salud" ? "Administrador" : rol;
  // Se requiere aqui (y no arriba) para que configurarEntorno() corra antes
  // de que env.js lea las variables de entorno.
  const { signToken } = require("../src/common/utils/jwt");
  return { usuario, token: signToken({ sub: usuario.id, rol }) };
}

function diasDesdeHoy(dias) {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias));
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { configurarEntorno, crearUsuario, diasDesdeHoy, auth };
