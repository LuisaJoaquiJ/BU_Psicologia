// Series y colores de las gráficas del tablero de Deporte.

export const ICONOS = {
  asistencia: ["check", "verde"],
  horas: ["reloj", "naranja"],
  sesiones: ["calendario", "azul"],
  activos: ["usuarios", "morado"],
};

// Colores validados para daltonismo (los mismos del resto de tableros).
export const ASISTENCIA = [
  { clave: "Presentes", etiqueta: "Presentes", color: "#0d9488" },
  { clave: "Ausentes", etiqueta: "Ausentes", color: "#d97706" },
];

export const ORIGEN = [
  { clave: "Clases", etiqueta: "Clases de los grupos", color: "#eb6834" },
  { clave: "Eventos", etiqueta: "Eventos deportivos", color: "#2a78d6" },
  { clave: "Reconocidas", etiqueta: "Reconocidas por la coordinación", color: "#1baf7a" },
];

// Escala ordinal: mas oscuro = mas avance.
export const AVANCE = [
  { clave: "Completaron", etiqueta: "Completaron las horas", color: "#0d366b" },
  { clave: "Cerca", etiqueta: "Del 75 al 99 %", color: "#1c5cab" },
  { clave: "EnCurso", etiqueta: "Del 25 al 74 %", color: "#3987e5" },
  { clave: "Iniciando", etiqueta: "Menos del 25 %", color: "#86b6ef" },
];

// Perfil de cada disciplina, las dos medidas en porcentaje (radar).
export const PERFIL_DISCIPLINA = [
  { clave: "ocupacion", etiqueta: "Cupos ocupados", color: "#2a78d6" },
  { clave: "asistencia", etiqueta: "Asistencia a clases", color: "#eb6834" },
];

export const OCUPACION = [
  { clave: "inscritos", etiqueta: "Inscritos", color: "#eb6834" },
  { clave: "libres", etiqueta: "Cupos libres", color: "#E5E9F0" },
];

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const fmt = (n) => Number(n || 0).toLocaleString("es-CO");
