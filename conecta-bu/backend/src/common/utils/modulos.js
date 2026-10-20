// Modulos con personal asignado (accesos por correo).
const MODULOS = {
  "desarrollo-humano": "Desarrollo Humano",
  salud: "Salud Integral",
  deporte: "Deporte y Recreación",
  // Docentes de Deporte: solo ven y toman asistencia de sus grupos.
  "deporte-docente": "Deporte (docentes)",
};

// Modulo por defecto de cada rol cuando no se indica (compatibilidad).
const MODULO_POR_ROL = { Administrador: "desarrollo-humano" };

function moduloDeRol(rol) {
  return MODULO_POR_ROL[rol] || "desarrollo-humano";
}

// Modulos que puede gestionar un usuario: el personal (Administrador), los
// que tenga asignados por correo. El superadministrador no entra a los
// modulos: trabaja solo desde su panel (/super), donde ve las estadisticas e
// informes de todos y asigna el personal de cada uno.
function modulosDeUsuario(usuario) {
  if (usuario?.rol?.nombre === "Administrador") return usuario.modulos || [];
  return [];
}

module.exports = { MODULOS, modulosDeUsuario, moduloDeRol };
