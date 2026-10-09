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
    descripcion: "Promoción, prevención y atención en salud para toda la comunidad universitaria.",
    icono: "pulso",
    imagen: IMAGENES.salud,
    estado: "pronto",
    servicios: ["Atención", "Prevención", "Campañas"],
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

// Ruta de entrada de un modulo: el panel del rol si hay sesion, o su pagina publica.
export function rutaModulo(modulo, usuario) {
  if (modulo.estado !== "disponible") return null;
  if (usuario && modulo.panel?.[usuario.rol]) return modulo.panel[usuario.rol];
  return modulo.publica || "/login";
}
