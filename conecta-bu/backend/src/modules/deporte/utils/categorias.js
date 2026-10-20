const { AppError } = require("../../../common/utils/AppError");
const { CATEGORIAS } = require("./constantes");

// RN-002: categorias de estudiante y restricciones por disciplina o evento.

const categoriaDe = (usuario) => (CATEGORIAS.includes(usuario?.categoriaEstudiante) ? usuario.categoriaEstudiante : "Pregrado");

// Lista de categorias permitidas (vacia = todas).
function validarCategorias(lista) {
  if (lista === undefined || lista === null) return [];
  if (!Array.isArray(lista)) throw new AppError(400, "Las categorías deben ser una lista.");
  const limpias = [...new Set(lista.map((c) => String(c).trim()))];
  const mala = limpias.find((c) => !CATEGORIAS.includes(c));
  if (mala) throw new AppError(400, `La categoría ${mala} no existe. Usa Pregrado, Posgrado o Egresado.`);
  return limpias.length === CATEGORIAS.length ? [] : limpias;
}

// ¿Puede esta persona inscribirse? Si no, el texto que se le muestra.
function restriccionCategoria(categorias, usuario) {
  if (!categorias?.length) return null;
  const propia = categoriaDe(usuario);
  return categorias.includes(propia) ? null : `Solo para ${categorias.join(" y ").toLowerCase()} (tu categoría es ${propia.toLowerCase()}).`;
}

module.exports = { categoriaDe, validarCategorias, restriccionCategoria };
