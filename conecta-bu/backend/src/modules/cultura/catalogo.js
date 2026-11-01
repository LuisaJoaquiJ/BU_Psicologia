// Codigos del modulo de Cultura. La ficha del area numera docente=2,
// administrativo=3 y egresado=4. La plantilla SNIES que ya usa Salud
// (verificada con el reporte 2026-1) numera egresado=2, docente=3 y
// administrativo=4. El informe de Cultura marca la diferencia en una nota.

const TIPOS = [
  { codigo: 1, nombre: "Estudiante" },
  { codigo: 2, nombre: "Docente" },
  { codigo: 3, nombre: "Administrativo" },
  { codigo: 4, nombre: "Egresado" },
];

const CATEGORIAS = [
  { id: "taller", nombre: "Taller de formación" },
  { id: "representativo", nombre: "Grupo representativo" },
  { id: "especial", nombre: "Evento especial" },
  { id: "itinerante", nombre: "Arte itinerante" },
  { id: "promocion", nombre: "Evento interno / promoción" },
];

const CARACTERIZACIONES = ["No registra", "Afro", "Indígena", "Rom", "Raizal", "Palenquero", "Mestizo", "Otra"];
const REDES = ["ASIES", "ASCUN"];
const ROLES_OPERATIVOS = ["administrador", "docente", "monitor"];
const TIPOS_EVIDENCIA = ["fotografia", "planilla"];

const CATALOGO = [
  { categoria: "taller", nombre: "Guitarra" },
  { categoria: "taller", nombre: "Piano" },
  { categoria: "taller", nombre: "Ritmos latinos" },
  { categoria: "taller", nombre: "Danzas folclóricas" },
  { categoria: "taller", nombre: "Expresión corporal y oralidad" },
  { categoria: "representativo", nombre: "Uniautónoma Band" },
  { categoria: "representativo", nombre: "Synapsis" },
  { categoria: "representativo", nombre: "Grupo de danzas folclóricas" },
  { categoria: "especial", nombre: "Día de la secretaria" },
  { categoria: "especial", nombre: "Día de la madre, el padre y el profesor" },
  { categoria: "especial", nombre: "Semana universitaria" },
  { categoria: "especial", nombre: "Halloween" },
  { categoria: "especial", nombre: "Amor y amistad" },
  { categoria: "itinerante", nombre: "Pausas creativas" },
  { categoria: "promocion", nombre: "Promoción en colegios y ferias" },
];

function tipoValido(valor) {
  const n = Number(valor || 1);
  if (!TIPOS.some((t) => t.codigo === n)) {
    const { AppError } = require("../../common/utils/AppError");
    throw new AppError(400, "El tipo de usuario debe ser 1 estudiante, 2 docente, 3 administrativo o 4 egresado.");
  }
  return n;
}

function nombreTipo(codigo) {
  return TIPOS.find((t) => t.codigo === Number(codigo))?.nombre || "Estudiante";
}

function nombreCategoria(id) {
  return CATEGORIAS.find((c) => c.id === id)?.nombre || id || "";
}

function ipDe(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  const cruda = String((typeof fwd === "string" ? fwd.split(",")[0] : req.ip || "") || "").trim();
  return (cruda || "desconocida").slice(0, 45);
}

module.exports = {
  TIPOS, CATEGORIAS, CATALOGO, CARACTERIZACIONES, REDES, ROLES_OPERATIVOS, TIPOS_EVIDENCIA,
  tipoValido, nombreTipo, nombreCategoria, ipDe,
};
