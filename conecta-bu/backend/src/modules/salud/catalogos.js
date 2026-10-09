// Catalogos del modulo Salud integral, tomados de los formatos que hoy usa
// la Unidad de Salud (registro general SPADIEZ, formulario de enfermeria,
// reporte SNIES e informe de gestion INFBI-002).

const PROGRAMAS = [
  // Pregrado (orden de la matriz "ATENDIDOS" del informe de gestion)
  { nombre: "Administración de Empresas", nivel: "Pregrado" },
  { nombre: "Contaduría Pública", nivel: "Pregrado" },
  { nombre: "Finanzas y Negocios Internacionales", nivel: "Pregrado" },
  { nombre: "Derecho - Gobierno y Relaciones Internacionales", nivel: "Pregrado" },
  { nombre: "Entrenamiento Deportivo", nivel: "Pregrado" },
  { nombre: "Licenciatura en Educación Infantil", nivel: "Pregrado" },
  { nombre: "Ingeniería Ambiental y de Saneamiento", nivel: "Pregrado" },
  { nombre: "Ingeniería de Software y Computación", nivel: "Pregrado" },
  { nombre: "Ingeniería Electrónica", nivel: "Pregrado" },
  { nombre: "Ingeniería Civil", nivel: "Pregrado" },
  { nombre: "Ingeniería Energética", nivel: "Pregrado" },
  // Posgrado
  { nombre: "Especialización en Derecho Penal", nivel: "Posgrado" },
  { nombre: "Especialización en Derecho de Familia", nivel: "Posgrado" },
  { nombre: "Especialización en Finanzas Corporativas", nivel: "Posgrado" },
  { nombre: "Especialización en Gestión de Servicios de TI", nivel: "Posgrado" },
  { nombre: "Especialización en Gestión Integral del Riesgo de Desastres", nivel: "Posgrado" },
  { nombre: "Especialización en Seguridad y Salud en el Trabajo", nivel: "Posgrado" },
  { nombre: "Especialización en Pedagogía", nivel: "Posgrado" },
  { nombre: "Especialización en Proyectos de Desarrollo", nivel: "Posgrado" },
];

const POBLACIONES = ["Estudiante", "Docente", "Administrativo", "Egresado", "Externo"];

const TIPOS_DOCUMENTO = {
  CC: "Cédula de ciudadanía",
  TI: "Tarjeta de identidad",
  CE: "Cédula de extranjería",
  PA: "Pasaporte",
  RC: "Registro civil",
  OTRO: "Otro",
};

const CATEGORIAS = {
  AtencionEnfermeria: "Atención servicio de enfermería",
  PromocionPrevencion: "Actividades de promoción y prevención de la salud",
  CampanaSalud: "Campañas de salud, belleza y autocuidado",
  DonacionSangre: "Campaña de donación de sangre",
  MedicinaLaboral: "Medicina laboral",
  Otra: "Otra",
};

const EXAMENES_LABORALES = {
  Ingreso: "Ingreso",
  Egreso: "Egreso",
  Periodico: "Periódico",
  EnfasisAlturas: "Énfasis en alturas",
  PostIncapacidad: "Post-incapacidad",
};

// ID_TIPO_BENEFICIARIO del reporte SNIES. 1, 3 y 4 se verificaron contra el
// reporte 2026-1 (estudiantes, docentes y administrativos). Egresados y
// externos no aparecen en ese reporte: confirmar su codigo en el catalogo
// SNIES vigente antes de cargarlo (se puede cambiar aqui).
const SNIES_TIPO_BENEFICIARIO = {
  Estudiante: 1,
  Docente: 3,
  Administrativo: 4,
  Egresado: 2,
  Externo: 5,
};

// Actividades base del semestre (catalogo del reporte SNIES 2026-1). El seed
// las crea para el periodo actual; la Unidad de Salud puede editarlas o
// agregar nuevas desde el panel.
const ACTIVIDADES_BASE = [
  { nombre: "Atención básica", categoria: "AtencionEnfermeria", permanente: true, clinica: true },
  { nombre: "Atención básica telemedicina", categoria: "AtencionEnfermeria", permanente: true, clinica: true },
  { nombre: "Atención médica", categoria: "AtencionEnfermeria", permanente: true, clinica: true },
  { nombre: "Remisiones", categoria: "AtencionEnfermeria", permanente: true, clinica: true },
  { nombre: "Asesorías", categoria: "AtencionEnfermeria", permanente: true },
  { nombre: "Insumos", categoria: "AtencionEnfermeria", permanente: true },
  { nombre: "Recambio", categoria: "AtencionEnfermeria", permanente: true },
  { nombre: "Pausas activas", categoria: "PromocionPrevencion", permanente: true },
  { nombre: "Exámenes de medicina laboral", categoria: "MedicinaLaboral", permanente: true },
  { nombre: "Feria de la salud", categoria: "CampanaSalud" },
  { nombre: "Donación de sangre", categoria: "DonacionSangre" },
  { nombre: "Tamizaje corporal", categoria: "PromocionPrevencion" },
  { nombre: "Tamizaje visual", categoria: "PromocionPrevencion" },
  { nombre: "Taller proyecto de vida y sexualidad", categoria: "PromocionPrevencion" },
  { nombre: "Capacitación en primeros auxilios", categoria: "PromocionPrevencion" },
];

function sinTildes(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Reglas para reconocer un programa escrito de distintas formas en los
// Excel ("INGENIERÍA SOFWARE Y COMPUTACION (INGENIERÍA DE SISTEMAS)",
// "DERECHO", "LICENCIATURA EN EDUCACION INFANTIL", ...).
const PATRONES_PROGRAMA = [
  [/DERECHO PENAL/, "Especialización en Derecho Penal"],
  [/DERECHO DE FAMIL/, "Especialización en Derecho de Familia"],
  [/FINANZAS CORPORATIVAS/, "Especialización en Finanzas Corporativas"],
  [/SERVICIOS DE TECNOLOGIA|GESTION DE SERVICIOS DE TI/, "Especialización en Gestión de Servicios de TI"],
  [/RIESGO/, "Especialización en Gestión Integral del Riesgo de Desastres"],
  [/SEGURIDAD Y SALUD|ESPECIALIZACION SST|\bSST\b/, "Especialización en Seguridad y Salud en el Trabajo"],
  [/ESPECIALIZACION (EN )?PEDAGOGIA/, "Especialización en Pedagogía"],
  [/PROYECTOS DE DESARROL/, "Especialización en Proyectos de Desarrollo"],
  [/ADMINISTRACION DE EMPRESAS/, "Administración de Empresas"],
  [/CONTADURIA/, "Contaduría Pública"],
  [/FINANZAS Y NEGOCIOS/, "Finanzas y Negocios Internacionales"],
  [/DERECHO|GOBIERNO Y RELACIONES/, "Derecho - Gobierno y Relaciones Internacionales"],
  [/ENTRENAMIENTO DEPORTIVO|DEPORTE Y ACTIVIDAD/, "Entrenamiento Deportivo"],
  [/LICENCIATURA|EDUCACION INFANTIL|PRIMERA INFANCIA/, "Licenciatura en Educación Infantil"],
  [/AMBIENTAL/, "Ingeniería Ambiental y de Saneamiento"],
  [/SOFTWARE|SOFWARE|SISTEMAS/, "Ingeniería de Software y Computación"],
  [/ELECTRONICA/, "Ingeniería Electrónica"],
  [/CIVIL/, "Ingeniería Civil"],
  [/ENERGETICA/, "Ingeniería Energética"],
];

function normalizarPrograma(texto) {
  if (!texto) return null;
  const limpio = sinTildes(texto);
  const encontrado = PATRONES_PROGRAMA.find(([patron]) => patron.test(limpio));
  return encontrado ? encontrado[1] : null;
}

function nivelDePrograma(programa) {
  return PROGRAMAS.find((p) => p.nombre === programa)?.nivel || null;
}

// Interpreta la columna "CARGO" del registro general, que mezcla la
// poblacion con el programa ("DOCENTE DERECHO", "ADMINISTRATIVO", "DERECHO").
function interpretarCargo(texto) {
  const limpio = sinTildes(texto);
  if (!limpio) return { poblacion: "Estudiante", programa: null };
  if (/^ADMINISTRATIV/.test(limpio)) return { poblacion: "Administrativo", programa: null };
  if (/^EGRESAD/.test(limpio)) return { poblacion: "Egresado", programa: normalizarPrograma(limpio.replace(/^EGRESAD[OA]S?/, "")) };
  if (/^(VISITANTE|EXTERNO|PARTICULAR)/.test(limpio)) return { poblacion: "Externo", programa: null };
  if (/^DOCENTE/.test(limpio)) return { poblacion: "Docente", programa: normalizarPrograma(limpio.replace(/^DOCENTES?/, "")) };
  return { poblacion: "Estudiante", programa: normalizarPrograma(limpio) };
}

function interpretarTipoDocumento(texto) {
  const limpio = sinTildes(texto);
  if (/TARJETA/.test(limpio) || limpio === "TI") return "TI";
  if (/EXTRANJ/.test(limpio) || limpio === "CE") return "CE";
  if (/PASAPORTE/.test(limpio) || limpio === "PA") return "PA";
  if (/REGISTRO CIVIL/.test(limpio) || limpio === "RC") return "RC";
  if (/CEDULA|CIUDADANIA/.test(limpio) || limpio === "CC" || !limpio) return "CC";
  return "OTRO";
}

function interpretarExamenLaboral(texto) {
  const limpio = sinTildes(texto);
  if (!limpio || limpio === "NONE" || limpio === "NA") return null;
  if (/INGRESO/.test(limpio)) return "Ingreso";
  if (/EGRESO/.test(limpio)) return "Egreso";
  if (/PERIODIC/.test(limpio)) return "Periodico";
  if (/ALTURA/.test(limpio)) return "EnfasisAlturas";
  if (/INCAPACIDAD/.test(limpio)) return "PostIncapacidad";
  return null;
}

// Periodo academico "AAAA-1" (enero-junio) o "AAAA-2" (julio-diciembre).
function periodoDeFecha(fecha = new Date()) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() < 6 ? 1 : 2}`;
}

function rangoDePeriodo(periodo) {
  const [anio, semestre] = String(periodo).split("-").map(Number);
  if (!anio || ![1, 2].includes(semestre)) return null;
  return semestre === 1
    ? { desde: new Date(Date.UTC(anio, 0, 1)), hasta: new Date(Date.UTC(anio, 5, 30)) }
    : { desde: new Date(Date.UTC(anio, 6, 1)), hasta: new Date(Date.UTC(anio, 11, 31)) };
}

module.exports = {
  PROGRAMAS,
  POBLACIONES,
  TIPOS_DOCUMENTO,
  CATEGORIAS,
  EXAMENES_LABORALES,
  SNIES_TIPO_BENEFICIARIO,
  ACTIVIDADES_BASE,
  sinTildes,
  normalizarPrograma,
  nivelDePrograma,
  interpretarCargo,
  interpretarTipoDocumento,
  interpretarExamenLaboral,
  periodoDeFecha,
  rangoDePeriodo,
};
