// Catalogos fijos del modulo Deporte.

const DIAS = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };
const TIPOS = ["Individual", "Colectivo", "Mental"];
// RN-002: categorias de estudiante. Quien no tiene categoria se toma como Pregrado.
const CATEGORIAS = ["Pregrado", "Posgrado", "Egresado"];
const TIPOS_EVENTO = ["Torneo", "Masterclass", "Jornada recreativa", "Exhibición", "Otro"];
const ESTADOS_EVENTO = ["Borrador", "Publicado", "Cancelado", "Finalizado"];
const PRIORIDADES = ["Informativa", "Importante", "Urgente"];
const ALCANCES = ["Todos", "Disciplina", "Grupo"];
const TIPOS_RESPONSABLE = ["Estudiante", "Docente", "Grupo", "Otro"];
const TIPOS_AJUSTE = ["Ingreso", "Baja", "Reparacion", "Danado"];
// Acceso (AccesoModulo) que abre el panel del docente.
const ACCESO_DOCENTE = "deporte-docente";

module.exports = { DIAS, TIPOS, CATEGORIAS, TIPOS_EVENTO, ESTADOS_EVENTO, PRIORIDADES, ALCANCES, TIPOS_RESPONSABLE, TIPOS_AJUSTE, ACCESO_DOCENTE };
