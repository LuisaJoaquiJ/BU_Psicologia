const campos = require("./campos");
const { TIPOS } = require("./tipos");
const { AREAS, TRANSPORTES, ESTADOS, CLASIFICACIONES, POTENCIALES, ADJUNTOS } = campos;

// Catalogo de los reportes SST (salidas institucionales, traslados y
// condiciones inseguras). Es la unica fuente de verdad: el frontend arma el
// formulario con lo que devuelve GET /reportes-sst/catalogos.

const GRUPOS = {
  estudiantes: "Salidas con estudiantes",
  representacion: "Salidas en representación de la Institución",
  posgrados: "Traslados de posgrados",
  riesgo: "Condiciones inseguras",
};

// Campos de transporte que pide cada medio.
const CAMPOS_TRANSPORTE = {
  Publico: [{ campo: "transporteEmpresa", label: "Medio y empresa en que se transporta", tipo: "texto" }],
  Institucional: [
    { campo: "conductor", label: "Nombre del conductor", tipo: "texto" },
    { campo: "placa", label: "Placa del vehículo", tipo: "placa" },
  ],
  Particular: [],
  Aereo: [],
  Caminando: [],
};

function esSalida(tipo) {
  return tipo !== "CondicionInsegura";
}

// Documentos obligatorios segun el tipo de reporte y el medio de transporte.
function adjuntosRequeridos(tipo, medio) {
  const requeridos = [];
  if (["SalidaEstudiantesLocal", "SalidaEstudiantesRegional", "SalidaEstudiantesNacional"].includes(tipo)) requeridos.push("Poliza");
  if (["SalidaEstudiantesInternacional", "RepresentacionInternacional"].includes(tipo)) requeridos.push("Movilidad");
  if (medio === "Particular") requeridos.push("Licencia", "TarjetaPropiedad", "Tecnomecanica", "Soat");
  if (medio === "Aereo") requeridos.push("Vuelo");
  return requeridos;
}

function adjuntosOpcionales(tipo) {
  return esSalida(tipo) ? ["Listado"] : ["Evidencia"];
}

function catalogoPublico() {
  return {
    areas: AREAS,
    grupos: GRUPOS,
    estados: ESTADOS,
    transportes: TRANSPORTES,
    camposTransporte: CAMPOS_TRANSPORTE,
    adjuntos: ADJUNTOS,
    clasificaciones: CLASIFICACIONES,
    potenciales: POTENCIALES,
    tipos: Object.entries(TIPOS).map(([id, t]) => ({
      id,
      ...t,
      adjuntosOpcionales: adjuntosOpcionales(id),
      // Requeridos sin importar el transporte (los del transporte se suman en el formulario).
      adjuntosBase: adjuntosRequeridos(id, null),
    })),
    requeridosPorTransporte: { Particular: adjuntosRequeridos(null, "Particular"), Aereo: adjuntosRequeridos(null, "Aereo") },
  };
}

module.exports = {
  AREAS,
  TRANSPORTES,
  ESTADOS,
  CLASIFICACIONES,
  POTENCIALES,
  TIPOS_DOCUMENTO: campos.TIPOS_DOCUMENTO,
  ADJUNTOS,
  TIPOS,
  GRUPOS,
  CAMPOS_TRANSPORTE,
  esSalida,
  adjuntosRequeridos,
  adjuntosOpcionales,
  catalogoPublico,
};
