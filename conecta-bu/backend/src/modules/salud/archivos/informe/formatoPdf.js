const path = require("path");

// Formato INFBI-002 en PDF: colores, poblaciones, margenes y formatos de
// numeros y fechas.

const C = {
  azul: "#0B2A5B",
  azulSuave: "#163F86",
  dorado: "#E8B23A",
  doradoTexto: "#9A6B07",
  marfil: "#FBF7EE",
  borde: "#E5E0D2",
  tinta: "#0E1726",
  gris: "#5B6478",
  grisClaro: "#EDEFF4",
  verde: "#C8EBD9",
  amarillo: "#FBE6B0",
  rojo: "#F6CACA",
};
const POBLACION = {
  Estudiante: { nombre: "Estudiantes", color: "#163F86" },
  Docente: { nombre: "Docentes", color: "#0D9488" },
  Administrativo: { nombre: "Administrativos", color: "#D97706" },
  Externo: { nombre: "Externos", color: "#9CA3AF" },
  Egresado: { nombre: "Egresados", color: "#7C3AED" },
};
const ORDEN = ["Estudiante", "Docente", "Administrativo", "Externo", "Egresado"];
const ESTADO_TEXTO = { Borrador: "BORRADOR", Enviado: "Enviado", Devuelto: "Devuelto para ajustes", Aprobado: "Aprobado" };

const MARGEN = 40;
const ALTO_ENCABEZADO = 74;
const ALTO_PIE = 26;
const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "..", "..", "assets", "logo-uniautonoma.png");

const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("es-CO"));
const pct = (x) => (x === null || x === undefined ? "—" : `${Number(x).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const fechaTexto = (iso) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "—";

// Maximo "redondo" para los ejes.
function maximoEje(valor) {
  if (valor <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(valor));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= valor) return m * exp;
  return 10 * exp;
}

module.exports = { C, POBLACION, ORDEN, ESTADO_TEXTO, MARGEN, ALTO_ENCABEZADO, ALTO_PIE, RUTA_LOGO, num, pct, fechaTexto, maximoEje };
