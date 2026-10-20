// Lectura de celdas de los Excel importados: texto, fechas (con errores de
// digitacion frecuentes), numeros y peso/talla.

function textoCelda(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if (valor.richText) return valor.richText.map((r) => r.text).join("");
    if (valor.text !== undefined) return String(valor.text);
    if (valor.result !== undefined) return textoCelda(valor.result);
  }
  return String(valor).trim();
}

function valorCelda(valor) {
  if (valor && typeof valor === "object" && !(valor instanceof Date) && valor.result !== undefined) return valor.result;
  return valor;
}

function leerFecha(valor) {
  const v = valorCelda(valor);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Numero de serie de Excel (dias desde 1899-12-30).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  }
  const texto = textoCelda(v);
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,5})\b/.exec(texto);
  if (m) {
    // Errores de digitacion frecuentes en el año: "026" o "20026" -> 2026, "26" -> 2026.
    let anio = m[3];
    if (anio.length <= 3) anio = `20${anio.slice(-2)}`;
    else if (anio.length === 5 && /^200\d\d$/.test(anio)) anio = `20${anio.slice(-2)}`;
    return new Date(Date.UTC(Number(anio), Number(m[2]) - 1, Number(m[1])));
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return null;
}

function entero(valor, min, max) {
  const n = Number(String(textoCelda(valorCelda(valor))).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

function textoUtil(valor, max) {
  const t = textoCelda(valorCelda(valor)).replace(/\s+/g, " ").trim();
  if (!t || /^(NA|N\/A|NO APLICA|NINGUNO|NONE|NO|-)$/i.test(t)) return null;
  return t.slice(0, max);
}

// "65/175" -> peso 65 kg, talla 175 cm (la talla en metros tambien se acepta).
function pesoTalla(valor) {
  const t = textoCelda(valorCelda(valor));
  const m = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(t);
  if (!m) return { pesoKg: null, tallaCm: null };
  const peso = Number(m[1].replace(",", "."));
  let talla = Number(m[2].replace(",", "."));
  if (talla < 3) talla *= 100;
  return {
    pesoKg: peso >= 2 && peso <= 400 ? Math.round(peso * 10) / 10 : null,
    tallaCm: talla >= 30 && talla <= 250 ? Math.round(talla) : null,
  };
}

module.exports = { textoCelda, valorCelda, leerFecha, entero, textoUtil, pesoTalla };
