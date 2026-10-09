import { IMAGENES } from "./imagenes";

// Las cinco dimensiones del Bienestar Institucional de la Uniautónoma, con
// sus nombres oficiales (documento de Bienestar de la Institucion). Cada equipo
// habilita su modulo cambiando "estado" a "disponible" y definiendo sus rutas:
//   - publica: pagina informativa sin iniciar sesion.
//   - panel.Estudiante: area del estudiante en ese modulo.
//   - panel.personal: panel del personal; solo entran los correos que el
//     superadministrador asigno a ese modulo (y el superadministrador).
export const MODULOS = [
  {
    id: "desarrollo-humano",
    nombre: "Desarrollo Humano",
    corto: "Desarrollo Humano",
    descripcion:
      "Acompañamiento psicológico individual y grupal, orientación vocacional y talleres para el manejo emocional, las relaciones y la prevención.",
    icono: "persona",
    imagen: IMAGENES.permanencia,
    estado: "disponible",
    publica: "/desarrollo-humano",
    panel: { Estudiante: "/estudiante", personal: "/admin" },
    servicios: ["Citas en línea con el equipo de psicología", "Talleres y eventos con inscripción", "Asistente que responde dudas sobre Bienestar"],
  },
  {
    id: "deporte",
    nombre: "Deporte y Recreación",
    corto: "Deporte",
    descripcion:
      "Natación, running, voleibol, fútbol, ajedrez y más: inscríbete a un grupo, asiste a tus clases y completa tus horas de deporte.",
    icono: "balon",
    imagen: IMAGENES.deportes,
    estado: "disponible",
    panel: { Estudiante: "/mi-deporte", personal: "/deporte" },
    servicios: ["Inscripción a grupos por disciplina", "Control de tus horas de deporte", "Constancia de horas"],
  },
  {
    id: "permanencia",
    nombre: "Permanencia Estudiantil",
    corto: "Permanencia",
    descripcion: "Seguimiento, acompañamiento y estrategias para que avances y culmines tu vida universitaria.",
    icono: "birrete",
    imagen: IMAGENES.integracion,
    estado: "pronto",
    servicios: ["Alertas tempranas", "Tutorías", "Acompañamiento"],
  },
  {
    id: "salud",
    nombre: "Salud Integral",
    corto: "Salud",
    descripcion:
      "Consultas de enfermería y médicas, jornadas de promoción y prevención, campañas y el registro de atenciones de la Unidad de Salud.",
    icono: "pulso",
    imagen: IMAGENES.salud,
    estado: "disponible",
    panel: { Estudiante: "/mi-salud", personal: "/salud" },
    servicios: ["Citas de enfermería y medicina general", "Jornadas de promoción y prevención", "Reporte de salidas institucionales"],
    // Abierto a toda la Institucion (docentes, administrativos, estudiantes).
    extra: { to: "/reportes-sst", label: "Reportar salida institucional" },
  },
  {
    id: "cultura",
    nombre: "Arte y Cultura",
    corto: "Arte y Cultura",
    descripcion: "Expresión artística, cultura institucional y espacios de participación para la comunidad.",
    icono: "musica",
    imagen: IMAGENES.auditorio,
    estado: "pronto",
    servicios: ["Grupos artísticos", "Agenda cultural", "Convocatorias"],
  },
];

export const MODULOS_DISPONIBLES = MODULOS.filter((m) => m.estado === "disponible");

// Modulos a los que puede entrar quien tiene la sesion.
export function modulosDe(usuario) {
  return MODULOS_DISPONIBLES.filter((m) => !usuario || rutaModulo(m, usuario));
}

export function moduloPorId(id) {
  return MODULOS.find((m) => m.id === id);
}

// Ruta de entrada de un modulo: el panel del rol si hay sesion, o su pagina publica.
// ¿Puede el usuario entrar al panel del personal de este modulo?
export function puedeAdministrar(usuario, idModulo) {
  if (usuario?.rol === "SuperAdministrador") return true;
  return usuario?.rol === "Administrador" && Boolean(usuario.modulos?.includes(idModulo));
}

// Con sesion, null si el usuario no tiene acceso a ese modulo.
export function rutaModulo(modulo, usuario) {
  if (modulo.estado !== "disponible") return null;
  if (!usuario) return modulo.publica || "/login";
  if (usuario.rol === "Estudiante") return modulo.panel?.Estudiante || null;
  return puedeAdministrar(usuario, modulo.id) ? modulo.panel?.personal || null : null;
}
