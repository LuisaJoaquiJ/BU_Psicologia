// Fotos de la Uniautónoma usadas en el rediseño (frontend/public/img).
// Son fotos institucionales: confirmar su uso con Bienestar/Comunicaciones
// antes de publicar el sitio.
export const IMAGENES = {
  sede: { src: "/img/sede.jpg", alt: "Sede histórica de la Uniautónoma del Cauca en Popayán" },
  integracion: { src: "/img/integracion.jpg", alt: "Estudiantes reunidos en la cancha durante una jornada de integración" },
  permanencia: { src: "/img/permanencia.jpg", alt: "Actividad grupal de permanencia estudiantil en el campus" },
  auditorio: { src: "/img/auditorio.jpg", alt: "Estudiantes en el auditorio de la universidad" },
  deportes: { src: "/img/deportes.jpg", alt: "Estudiantes del equipo deportivo en una feria" },
  salud: { src: "/img/grupo-salud.jpg", alt: "Grupo de estudiantes de salud" },
};

// Los eventos todavia no tienen foto propia en la base de datos: se asigna
// una de este grupo de forma estable segun el id del evento.
const ROTACION = ["permanencia", "auditorio", "deportes", "integracion", "salud"];

export function imagenParaEvento(id = "") {
  let suma = 0;
  for (const caracter of String(id)) suma += caracter.charCodeAt(0);
  return IMAGENES[ROTACION[suma % ROTACION.length]];
}
