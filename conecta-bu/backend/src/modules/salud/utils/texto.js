const { AppError } = require("../../../common/utils/AppError");

// Utilidades de texto y numeros del modulo Salud integral.

// Deja solo digitos y letras: "1.061.731.427", "1061731427.0" (Excel) y
// " 1061731427 " terminan siendo el mismo documento.
function limpiarIdentificador(valor) {
  if (valor === null || valor === undefined) return "";
  let texto = typeof valor === "number" ? String(Math.trunc(valor)) : String(valor).trim();
  texto = texto.replace(/\.0+$/, "");
  return texto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function textoOpcional(valor, max) {
  if (valor === undefined) return undefined;
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, max) : null;
}

function nombrePropio(valor) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return texto.replace(/(^|\s|-)(\p{L})/gu, (m, sep, letra) => sep + letra.toUpperCase());
}

// Texto sin tildes y en minuscula, para comparar.
const normal = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const fechaISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function enteroOpcional(valor, campo, { min = 0, max = 1e9 } = {}) {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, `El campo ${campo} debe ser un número entero válido.`);
  return n;
}

function textoLargo(valor) {
  if (valor === undefined) return undefined;
  const t = String(valor ?? "").trim();
  return t ? t.slice(0, 5000) : null;
}

function numeroEnRango(valor, campo, min, max, { decimal = false } = {}) {
  if (valor === undefined || valor === null || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n) || n < min || n > max || (!decimal && !Number.isInteger(n))) {
    throw new AppError(400, `Revisa el valor de ${campo} (entre ${min} y ${max}).`);
  }
  return decimal ? Math.round(n * 10) / 10 : n;
}

function textoCorto(valor, max) {
  const t = String(valor ?? "").trim();
  if (!t || /^(na|n\/a|no aplica|ninguno|none)$/i.test(t)) return null;
  return t.slice(0, max);
}

const esConflictoUnico = (err) => err?.code === "P2002";

module.exports = { limpiarIdentificador, textoOpcional, nombrePropio, normal, fechaISO, enteroOpcional, textoLargo, numeroEnRango, textoCorto, esConflictoUnico };
