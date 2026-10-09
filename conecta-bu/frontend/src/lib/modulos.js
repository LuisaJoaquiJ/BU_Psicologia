import { IMAGENES } from "./imagenes";

// Los cinco modulos de Conecta BU (Bienestar Universitario). Cada equipo
// habilita su modulo cambiando "estado" a "disponible" y definiendo sus rutas:
//   - publica: pagina informativa sin iniciar sesion.
//   - panel.Estudiante: area del estudiante en ese modulo.
//   - panel.personal: panel del personal; solo entran los correos que el
//     superadministrador asigno a ese modulo (y el superadministrador).
export const MODULOS = [
  {
    id: "desarrollo-humano",
    nombre: "Desarrollo humano y orientación",
    corto: "Desarrollo humano",
    descripcion:
      "Orientación psicológica, acompañamiento vocacional y talleres de crecimiento personal, con agenda en línea y asistente de orientación.",
    icono: "persona",
    imagen: IMAGENES.permanencia,
    estado: "disponible",
    publica: "/desarrollo-humano",
    panel: { Estudiante: "/estudiante", personal: "/admin" },
    servicios: ["Citas de orientación", "Talleres y eventos", "Asistente IA"],
  },
  {
    id: "deporte",
    nombre: "Deporte",
    corto: "Deporte",
    descripcion:
      "Natación, running, voleibol, fútbol, ajedrez y más: inscríbete a un grupo, asiste a tus clases y completa tus horas de deporte.",
    icono: "balon",
    imagen: IMAGENES.deportes,
    estado: "disponible",
    panel: { Estudiante: "/mi-deporte", personal: "/deporte" },
    servicios: ["Disciplinas e inscripción", "Control de horas", "Constancia"],
  },
  {
    id: "permanencia",
    nombre: "Permanencia estudiantil",
    corto: "Permanencia",
    descripcion: "Seguimiento, acompañamiento y estrategias para que avances y culmines tu vida universitaria.",
    icono: "birrete",
    imagen: IMAGENES.integracion,
    estado: "pronto",
    servicios: ["Alertas tempranas", "Tutorías", "Acompañamiento"],
  },
  {
    id: "salud",
    nombre: "Salud integral",
    corto: "Salud",
    descripcion:
      "Consultas de enfermería y médicas, jornadas de promoción y prevención, campañas y el registro de atenciones de la Unidad de Salud.",
    icono: "pulso",
    imagen: IMAGENES.salud,
    estado: "disponible",
    panel: { Estudiante: "/mi-salud", personal: "/salud" },
    servicios: ["Citas de enfermería y médicas", "Jornadas y campañas", "Salidas institucionales", "Registro con la cédula"],
    // Abierto a toda la Institucion (docentes, administrativos, estudiantes).
    extra: { to: "/reportes-sst", label: "Reportar salida institucional" },
  },
  {
    id: "cultura",
    nombre: "Cultura",
    corto: "Cultura",
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
