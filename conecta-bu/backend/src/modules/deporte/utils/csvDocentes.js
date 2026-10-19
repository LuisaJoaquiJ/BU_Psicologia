const { AppError } = require("../../../common/utils/AppError");

// Lee el CSV de la carga masiva de docentes (RF-004): columnas correo, nombre,
// telefono y especialidad. Acepta coma o punto y coma y una fila de encabezado.
function leerCsvDocentes(contenido) {
  const lineas = String(contenido || "")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l, i) => ({ numero: i + 1, texto: l.trim() }))
    .filter((l) => l.texto);
  if (!lineas.length) throw new AppError(400, "El archivo está vacío.");
  if (lineas.length > 501) throw new AppError(400, "Carga máximo 500 docentes por archivo.");

  const separador = (lineas[0].texto.match(/;/g) || []).length > (lineas[0].texto.match(/,/g) || []).length ? ";" : ",";
  const celdas = (t) => t.split(separador).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
  const primera = celdas(lineas[0].texto).map((c) => c.toLowerCase());
  const conEncabezado = primera.some((c) => /correo|email|nombre/.test(c));
  const indice = (nombres, porDefecto) => (conEncabezado ? primera.findIndex((c) => nombres.some((n) => c.includes(n))) : porDefecto);
  const col = {
    email: indice(["correo", "email"], 0),
    nombre: indice(["nombre"], 1),
    telefono: indice(["telefono", "teléfono", "celular"], 2),
    especialidad: indice(["especialidad", "disciplina"], 3),
  };
  if (col.email < 0 || col.nombre < 0) throw new AppError(400, "El archivo debe tener las columnas correo y nombre.");

  return (conEncabezado ? lineas.slice(1) : lineas).map((l) => {
    const c = celdas(l.texto);
    const valor = (i) => (i >= 0 ? c[i] : undefined);
    return { linea: l.numero, email: valor(col.email), nombre: valor(col.nombre), telefono: valor(col.telefono), especialidad: valor(col.especialidad) };
  });
}

module.exports = { leerCsvDocentes };
