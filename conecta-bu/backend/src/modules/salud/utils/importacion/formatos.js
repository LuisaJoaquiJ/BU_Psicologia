const { sinTildes } = require("../catalogos");

// Formatos de Excel que hoy lleva la Unidad de Salud y su equivalencia con
// el catalogo de actividades:
//   - Registro general (SPADIEZ): APELLIDOS, NOMBRES, TIPO DE DOCUMENTO,
//     Nº DE DOCUMENTO, TELEFONO, CARGO, FECHA, TIPO DE ACTIVIDAD, ...
//   - Formulario de atencion de enfermeria (Microsoft/Google Forms).

const FORMATOS = {
  registro: {
    nombre: "Registro general de atenciones (SPADIEZ)",
    columnas: {
      apellidos: ["APELLIDOS"],
      nombres: ["NOMBRES"],
      tipoDocumento: ["TIPO DE DOCUMENTO"],
      documento: ["N DE DOCUMENTO", "NO DE DOCUMENTO", "NUMERO DE DOCUMENTO", "DOCUMENTO"],
      telefono: ["TELEFONO"],
      cargo: ["CARGO"],
      fecha: ["FECHA"],
      actividad: ["TIPO DE ACTIVIDAD"],
      laboral: ["MEDICO LABORAL"],
      insumo: ["TIPO DE INSUMO"],
    },
    obligatorias: ["apellidos", "nombres", "documento", "fecha", "actividad"],
  },
  enfermeria: {
    nombre: "Formulario de atención de enfermería",
    columnas: {
      correo: ["CORREO ELECTRONICO"],
      consentimiento: ["EN CUMPLIMIENTO DE LA LEY 1581"],
      apellidos: ["APELLIDO"],
      nombres: ["NOMBRE1", "NOMBRES"],
      tipoDocumento: ["TIPO DE DOCUMENTO"],
      documento: ["DOCUMENTO DE IDENTIFICACION"],
      telefono: ["TELEFONO"],
      cargo: ["PROGRAMA"],
      fecha: ["FECHA DE LA ATENCION"],
      actividad: ["TIPO DE ATENCION"],
      insumo: ["TIPO DE INSUMO"],
      tension: ["TENSION ARTERIAL"],
      fc: ["FRECUENCIA CARDIACA"],
      fr: ["FRECUENCIA RESPIRATORIA"],
      pesoTalla: ["PESO / TALLA", "PESO/TALLA"],
      gluco: ["GLUCOMETRIA"],
      descripcion: ["DESCRIPCION BREVE DEL EVENTO"],
    },
    obligatorias: ["apellidos", "nombres", "documento", "fecha", "actividad"],
  },
};

// Nombre de actividad en el Excel -> actividad del catalogo.
const EQUIVALENCIAS_ACTIVIDAD = [
  [/^ATENCION BASICA TELEMEDICINA|^TELEMEDICINA/, "Atención básica telemedicina", "AtencionEnfermeria", true, true],
  [/^ATENCION BASICA/, "Atención básica", "AtencionEnfermeria", true, true],
  [/^ATENCION MEDICA/, "Atención médica", "AtencionEnfermeria", true, true],
  [/^REMISION/, "Remisiones", "AtencionEnfermeria", true, true],
  [/^ENTREGA DE INSUMOS|^INSUMOS?$/, "Insumos", "AtencionEnfermeria", true, false],
  [/^ASESORIA/, "Asesorías", "AtencionEnfermeria", true, false],
  [/^RECAMBIO/, "Recambio", "AtencionEnfermeria", true, false],
  [/^PAUSAS? ACTIVAS?/, "Pausas activas", "PromocionPrevencion", true, false],
];

function actividadDestino(texto) {
  const limpio = sinTildes(texto);
  const equivalencia = EQUIVALENCIAS_ACTIVIDAD.find(([patron]) => patron.test(limpio));
  if (equivalencia) {
    const [, nombre, categoria, permanente, clinica] = equivalencia;
    return { nombre, categoria, permanente, clinica };
  }
  let categoria = "PromocionPrevencion";
  if (/DONACION DE SANGRE|BANCO DE SANGRE/.test(limpio) && !/CAPACITACION/.test(limpio)) categoria = "DonacionSangre";
  else if (/FERIA|CAMPANA|BELLEZA|AUTOCUIDADO/.test(limpio)) categoria = "CampanaSalud";
  return { nombre: nombreActividad(texto), categoria, permanente: false, clinica: false };
}

// Mayuscula inicial, pero conserva siglas cortas escritas en mayuscula
// (SOS, EPS, PYP, EPOC, CENAL) para no convertirlas en "Sos" o "Eps".
const PALABRAS_COMUNES = new Set(["DE", "LA", "EL", "Y", "EN", "DEL", "LOS", "LAS", "CON", "POR", "AL", "UN", "UNA", "SU", "A", "O", "E", "SE", "LO"]);
function nombreActividad(texto) {
  const palabras = String(texto).replace(/\s+/g, " ").trim().split(" ");
  return palabras
    .map((p, i) => {
      const esSigla = p.length >= 2 && p.length <= 5 && p === p.toUpperCase() && /\p{L}/u.test(p) && !PALABRAS_COMUNES.has(sinTildes(p));
      if (esSigla && texto === texto.toUpperCase() ? p.length <= 4 && !/^(ARTE|YOGA|VIDA|SALUD|CASA|PARA|TALLER)$/.test(sinTildes(p)) : esSigla) return p;
      const minuscula = p.toLowerCase();
      return i === 0 ? minuscula.charAt(0).toUpperCase() + minuscula.slice(1) : minuscula;
    })
    .join(" ")
    .slice(0, 200);
}

const claveNombre = (s) => sinTildes(s).replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

module.exports = { FORMATOS, EQUIVALENCIAS_ACTIVIDAD, actividadDestino, nombreActividad, claveNombre };
