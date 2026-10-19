const ExcelJS = require("exceljs");
const { TIPOS_DOCUMENTO, EXAMENES_LABORALES } = require("../utils/catalogos");
const { cargoRegistro } = require("../utils/reportesDatos");
const { hojaPlana, estiloTabla } = require("./estiloExcel");

// Plantilla SNIES "Actividad de bienestar" y registro general de atenciones.

async function generarSnies(snies) {
  const libro = new ExcelJS.Workbook();
  hojaPlana(
    libro,
    "ACTIVIDAD_BIENESTAR",
    [
      "AÑO",
      "SEMESTRE",
      "CODIGO_UNIDAD_ORGANIZACIONAL",
      "CODIGO_ACTIVIDAD",
      "DESCRIPCION_ACTIVIDAD",
      "ID_TIPO_ACTIVIDAD_BIENESTAR",
      "FECHA_INICIO",
      "FECHA_FINAL",
      "ID_FUENTE_NACIONAL",
      "VLR_FINANCIACION_NACIONAL",
      "ID_PAIS_FINANCIADOR",
      "NOMBRE_ENTIDAD_FTE_INTERNAC",
      "ID_FUENTE_INTERNACIONAL",
      "VLR_FINANCIACION_INTERNACIONAL",
    ],
    snies.actividades.map((a) => ({
      ...a,
      FECHA_INICIO: a.FECHA_INICIO ? new Date(`${a.FECHA_INICIO}T00:00:00Z`) : null,
      FECHA_FINAL: a.FECHA_FINAL ? new Date(`${a.FECHA_FINAL}T00:00:00Z`) : null,
    }))
  ).getColumn(5).width = 60;
  const hojaAct = libro.getWorksheet("ACTIVIDAD_BIENESTAR");
  hojaAct.getColumn(7).numFmt = "yyyy-mm-dd";
  hojaAct.getColumn(8).numFmt = "yyyy-mm-dd";
  hojaPlana(
    libro,
    "ACT_BIENESTAR_BENEFICIARIOS",
    ["AÑO", "SEMESTRE", "CODIGO_UNIDAD_ORGANIZACIONAL", "CODIGO_ACTIVIDAD", "ID_TIPO_BENEFICIARIO", "CANTIDAD_BENEFICIARIOS"],
    snies.beneficiarios
  );
  hojaPlana(
    libro,
    "ACT_BIENESTAR_REC_HUMANO",
    ["AÑO", "SEMESTRE", "CODIGO_ACTIVIDAD", "CODIGO_UNIDAD_ORGANIZACIONAL", "ID_TIPO_DOCUMENTO", "NUM_DOCUMENTO", "DEDICACION"],
    snies.recursoHumano
  );
  const info = libro.addWorksheet("INFO");
  info.addRows([
    ["Información de Control. No editar, mover"],
    ["Nombre de la Plantilla", "Actividad de bienestar"],
    ["Descripción de la Plantilla", "Actividad de Bienestar"],
    ["Código de la Plantilla", 92],
  ]);
  info.getColumn(1).width = 34;
  info.getColumn(2).width = 28;
  return libro.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// Registro general (formato SPADIEZ) y atenciones de enfermeria
// ---------------------------------------------------------------------------

async function generarRegistro(atenciones, { desde, hasta }) {
  const libro = new ExcelJS.Workbook();
  const general = libro.addWorksheet("REGISTRO GENERAL", { views: [{ state: "frozen", ySplit: 1 }] });
  general.columns = [
    { header: "APELLIDOS", key: "apellidos", width: 24 },
    { header: "NOMBRES", key: "nombres", width: 22 },
    { header: "TIPO DE DOCUMENTO", key: "tipo", width: 22 },
    { header: "Nº DE DOCUMENTO", key: "documento", width: 16 },
    { header: "CÓDIGO ESTUDIANTIL", key: "codigo", width: 14 },
    { header: "TELEFONO", key: "telefono", width: 14 },
    { header: "CARGO", key: "cargo", width: 34 },
    { header: "POBLACIÓN", key: "poblacion", width: 14 },
    { header: "FECHA", key: "fecha", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "TIPO DE ACTIVIDAD", key: "actividad", width: 34 },
    { header: "MEDICO LABORAL", key: "laboral", width: 16 },
    { header: "TIPO DE INSUMO", key: "insumo", width: 20 },
    { header: "REGISTRADO POR", key: "registro", width: 22 },
  ];
  for (const at of atenciones) {
    general.addRow({
      apellidos: (at.persona?.apellidos || "").toUpperCase(),
      nombres: (at.persona?.nombres || "").toUpperCase(),
      tipo: (TIPOS_DOCUMENTO[at.persona?.tipoDocumento] || "").toUpperCase(),
      documento: at.persona?.numeroDocumento,
      codigo: at.persona?.codigoEstudiantil || "",
      telefono: at.persona?.telefono || "",
      cargo: cargoRegistro(at.poblacion, at.programa),
      poblacion: at.poblacion,
      fecha: new Date(at.fecha),
      actividad: (at.actividad?.nombre || "").toUpperCase(),
      laboral: at.examenLaboral ? EXAMENES_LABORALES[at.examenLaboral].toUpperCase() : "",
      insumo: at.insumo || "",
      registro: at.registradoPor?.nombre || (at.origen === "importado" ? "Importado de Excel" : ""),
    });
  }
  estiloTabla(general);

  const clinicas = atenciones.filter((at) => at.actividad?.clinica || at.tensionArterial || at.descripcion);
  const enfermeria = libro.addWorksheet("ATENCIÓN ENFERMERÍA", { views: [{ state: "frozen", ySplit: 1 }] });
  enfermeria.columns = [
    { header: "FECHA DE LA ATENCIÓN", key: "fecha", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "APELLIDOS", key: "apellidos", width: 22 },
    { header: "NOMBRES", key: "nombres", width: 20 },
    { header: "DOCUMENTO", key: "documento", width: 15 },
    { header: "TELÉFONO", key: "telefono", width: 13 },
    { header: "PROGRAMA / CARGO", key: "cargo", width: 32 },
    { header: "TIPO DE ATENCIÓN", key: "actividad", width: 24 },
    { header: "TIPO DE INSUMO", key: "insumo", width: 18 },
    { header: "TENSIÓN ARTERIAL", key: "ta", width: 11 },
    { header: "FRECUENCIA CARDIACA", key: "fc", width: 11 },
    { header: "FRECUENCIA RESPIRATORIA", key: "fr", width: 12 },
    { header: "PESO (kg)", key: "peso", width: 9 },
    { header: "TALLA (cm)", key: "talla", width: 9 },
    { header: "GLUCOMETRÍA", key: "gluco", width: 11 },
    { header: "DESCRIPCIÓN BREVE DEL EVENTO", key: "descripcion", width: 50 },
    { header: "REMITIDO", key: "remitido", width: 10 },
  ];
  for (const at of clinicas) {
    enfermeria.addRow({
      fecha: new Date(at.fecha),
      apellidos: at.persona?.apellidos,
      nombres: at.persona?.nombres,
      documento: at.persona?.numeroDocumento,
      telefono: at.persona?.telefono || "",
      cargo: cargoRegistro(at.poblacion, at.programa),
      actividad: at.actividad?.nombre,
      insumo: at.insumo || "",
      ta: at.tensionArterial || "",
      fc: at.frecuenciaCardiaca ?? "",
      fr: at.frecuenciaRespiratoria ?? "",
      peso: at.pesoKg ?? "",
      talla: at.tallaCm ?? "",
      gluco: at.glucometria || "",
      descripcion: at.descripcion || "",
      remitido: at.remitido ? "SÍ" : "",
    });
  }
  estiloTabla(enfermeria);
  enfermeria.getColumn("descripcion").alignment = { wrapText: true, vertical: "top" };

  const info = libro.addWorksheet("INFO");
  info.addRows([
    ["Conecta BU · Salud integral"],
    ["Registro de atenciones", `${desde || "inicio"} a ${hasta || "hoy"}`],
    ["Generado", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })],
    ["Aviso", "Contiene datos personales y de salud (Ley 1581 de 2012). Uso exclusivo de la Unidad de Salud Integral."],
  ]);
  info.getColumn(1).width = 26;
  info.getColumn(2).width = 90;
  return libro.xlsx.writeBuffer();
}

module.exports = { generarSnies, generarRegistro };
