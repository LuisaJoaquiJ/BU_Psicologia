import { IMAGENES } from "./imagenes";

// Los cinco modulos de Conecta BU (Bienestar Universitario). Cada equipo
// habilita su modulo cambiando "estado" a "disponible" y definiendo sus rutas:
//   - publica: pagina informativa sin iniciar sesion.
//   - panel: a donde entra cada rol una vez autenticado.
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
    panel: { Estudiante: "/estudiante", Administrador: "/admin" },
    servicios: ["Citas de orientación", "Talleres y eventos", "Asistente IA"],
  },
  {
    id: "deporte",
    nombre: "Deporte",
    corto: "Deporte",
    descripcion: "Inscripción a disciplinas, horarios de entrenamiento, cupos y práctica formativa y competitiva.",
    icono: "balon",
    imagen: IMAGENES.deportes,
    estado: "pronto",
    servicios: ["Disciplinas", "Horarios", "Torneos"],
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
    panel: { Estudiante: "/estudiante/salud", Salud: "/salud" },
    servicios: ["Citas de enfermería y médicas", "Jornadas y campañas", "Registro con la cédula"],
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
  return MODULOS_DISPONIBLES.filter((m) => !usuario || m.panel?.[usuario.rol]);
}

// Ruta de entrada de un modulo: el panel del rol si hay sesion, o su pagina publica.
// Con sesion, null si el rol no tiene acceso a ese modulo.
export function rutaModulo(modulo, usuario) {
  if (modulo.estado !== "disponible") return null;
  if (usuario) return modulo.panel?.[usuario.rol] || null;
  return modulo.publica || "/login";
}
