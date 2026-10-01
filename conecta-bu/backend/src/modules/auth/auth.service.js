const { OAuth2Client } = require("google-auth-library");
const { config } = require("../../config/env");
const { prisma } = require("../../config/prisma");
const { signToken } = require("../../common/utils/jwt");
const { AppError } = require("../../common/utils/AppError");

const client = new OAuth2Client(config.googleClientId);

// RF-001, flujo principal, pasos 2-4: valida el ID Token que entrega Google
// Identity Services en el frontend.
async function verifyGoogleIdToken(idToken) {
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
  } catch (err) {
    throw new AppError(401, "No fue posible verificar la cuenta de Google. Intenta iniciar sesion de nuevo.");
  }
  return ticket.getPayload();
}

// RN-001 / HU-02: solo cuentas del dominio institucional autorizado pueden entrar.
function verificarDominioInstitucional(payload) {
  const email = (payload.email || "").toLowerCase();
  const dominio = email.split("@")[1];
  const emailVerificado = payload.email_verified === true;

  if (!emailVerificado || dominio !== config.allowedGoogleDomain.toLowerCase()) {
    throw new AppError(
      403,
      `Solo se permite el ingreso con cuentas institucionales @${config.allowedGoogleDomain}.`
    );
  }
}

// RF-001, flujo principal, pasos 5-6: busca el registro interno o lo crea con
// el rol Estudiante por defecto.
async function buscarOCrearUsuario(payload) {
  const email = payload.email.toLowerCase();
  const existente = await prisma.usuario.findUnique({
    where: { emailInstitucional: email },
    include: { rol: true },
  });

  if (existente) {
    if (!existente.habilitado) {
      throw new AppError(401, "Tu usuario esta deshabilitado. Contacta al administrador del modulo.");
    }
    return existente;
  }

  const rolEstudiante = await prisma.rol.findUnique({ where: { nombre: "Estudiante" } });
  if (!rolEstudiante) {
    throw new AppError(500, "El rol Estudiante no esta configurado. Ejecuta el seed de la base de datos.");
  }

  return prisma.usuario.create({
    data: {
      emailInstitucional: email,
      nombre: payload.name || email,
      rolId: rolEstudiante.id,
    },
    include: { rol: true },
  });
}

function serializarUsuario(usuario) {
  return {
    id: usuario.id,
    email: usuario.emailInstitucional,
    nombre: usuario.nombre,
    rol: usuario.rol.nombre,
    habilitado: usuario.habilitado,
  };
}

// RF-001 completo: valida el token de Google, aplica la regla de dominio,
// resuelve el usuario interno y emite el JWT propio de Conecta BU.
async function loginConGoogle(idToken) {
  const payload = await verifyGoogleIdToken(idToken);
  verificarDominioInstitucional(payload);
  const usuario = await buscarOCrearUsuario(payload);

  const token = signToken({ sub: usuario.id, rol: usuario.rol.nombre });

  return { token, usuario: serializarUsuario(usuario) };
}

module.exports = { loginConGoogle, serializarUsuario };
