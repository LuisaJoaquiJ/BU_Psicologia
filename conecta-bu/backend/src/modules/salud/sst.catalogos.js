// Catalogo de los reportes SST (salidas institucionales, traslados y
// condiciones inseguras). Replica las secciones del formulario de Google
// "0 SALUD INTEGRAL" y es la unica fuente de verdad: el frontend arma el
// formulario a partir de lo que devuelve GET /reportes-sst/catalogos.

const AREAS = [
  "Rectoría",
  "Comunidad Universitaria",
  "Consultorio Jurídico",
  "Time",
  "Posgrados",
  "Vicerrectoría Académica",
  "Vicerrectoría de Relacionamiento con el Entorno",
  "Dirección General Administrativa",
  "Admisiones",
  "Comunicaciones",
  "Ingeniería Civil",
  "Ingeniería Electrónica",
  "Ingeniería Ambiental y Saneamiento",
  "Ingeniería Energética",
  "Ingeniería de Software y Computación",
  "Finanzas y Negocios Internacionales",
  "Emprendelab",
  "Licenciatura en Educación Infantil",
  "Administración de Empresas",
  "Contaduría Pública",
  "Derecho",
  "Egresados",
  "Planeación",
  "Entrenamiento Deportivo",
  "Servicios Institucionales",
  "Financiera",
  "Dirección de Posicionamiento",
];

const TRANSPORTES = {
  Publico: "Transporte público",
  Particular: "Particular o privado",
  Institucional: "Transporte institucional",
  Aereo: "Aéreo",
  Caminando: "Caminando",
};

const ESTADOS = {
  Recibido: "Recibido",
  Verificado: "Verificado",
  RequiereAjustes: "Requiere ajustes",
  Cerrado: "Cerrado",
};

const CLASIFICACIONES = { Incidente: "Incidente", CondicionInsegura: "Condición insegura", ActoInseguro: "Acto inseguro" };
const POTENCIALES = ["Alto", "Medio", "Bajo"];
const TIPOS_DOCUMENTO = ["CC", "CE", "TI"];

// Documentos que se adjuntan. "requerido" se calcula por tipo y transporte.
const ADJUNTOS = {
  Licencia: "Licencia de conducción",
  TarjetaPropiedad: "Tarjeta de propiedad",
  Tecnomecanica: "Certificado de revisión técnico-mecánica",
  Soat: "SOAT vigente",
  Vuelo: "Información del vuelo",
  Movilidad: "Certificado de movilidad internacional",
  Poliza: "Formato de verificación de la póliza estudiantil",
  Listado: "Listado de participantes (nombres y cédulas)",
  Evidencia: "Evidencia fotográfica",
};

// Campos de cada seccion del formulario. "obligatorio" por defecto true.
const C = {
  responsableNombre: (label = "Nombre completo") => ({ campo: "responsableNombre", label, tipo: "texto" }),
  responsableTipoDoc: (opciones = TIPOS_DOCUMENTO) => ({ campo: "responsableTipoDoc", label: "Tipo de documento", tipo: "opciones", opciones }),
  responsableDocumento: () => ({ campo: "responsableDocumento", label: "Número de documento", tipo: "documento" }),
  acompanantes: (label) => ({ campo: "acompanantes", label, tipo: "lista", obligatorio: false }),
  numeroEstudiantes: () => ({ campo: "numeroEstudiantes", label: "Número de estudiantes", tipo: "numero", obligatorio: false }),
  evento: () => ({ campo: "evento", label: "Nombre del evento", tipo: "texto" }),
  motivo: () => ({ campo: "motivo", label: "Motivo del traslado", tipo: "texto" }),
  pais: () => ({ campo: "pais", label: "País de destino", tipo: "texto" }),
  ciudadOrigen: () => ({ campo: "ciudadOrigen", label: "Ciudad de origen", tipo: "texto" }),
  destino: (label) => ({ campo: "destino", label, tipo: "texto" }),
  lugarDestino: () => ({ campo: "lugarDestino", label: "Lugar de destino", tipo: "texto" }),
  fechaSalida: () => ({ campo: "fechaSalida", label: "Fecha de salida", tipo: "fecha" }),
  fechaRegreso: (label = "Fecha de regreso") => ({ campo: "fechaRegreso", label, tipo: "fecha" }),
  horaSalida: () => ({ campo: "horaSalida", label: "Hora de salida", tipo: "hora" }),
  horaRegreso: (label = "Hora de llegada") => ({ campo: "horaRegreso", label, tipo: "hora" }),
};

const VIAJE = (regreso = "Fecha de regreso", llegada = "Hora de llegada") => [
  C.fechaSalida(),
  C.fechaRegreso(regreso),
  C.horaSalida(),
  C.horaRegreso(llegada),
];

const AVISO_ESTUDIANTES =
  "Este reporte es exclusivamente para salidas con estudiantes. Adjunta el formato de verificación de la póliza estudiantil con la aprobación del jefe inmediato.";
const AVISO_INTERNACIONAL =
  "Las salidas internacionales se reportan con mínimo 5 días de anticipación para gestionar el certificado de ASIST CARD en caso de emergencia.";

const TIPOS = {
  SalidaEstudiantesLocal: {
    nombre: "Salida con estudiantes · Local",
    corto: "Estudiantes local",
    grupo: "estudiantes",
    nivel: "Local",
    aviso: AVISO_ESTUDIANTES,
    anticipacion: null,
    gestion: "ARL",
    transportes: ["Publico", "Particular", "Institucional"],
    campos: [
      C.evento(),
      C.destino("Lugar de destino"),
      ...VIAJE(),
      C.numeroEstudiantes(),
      C.responsableNombre("Nombre del docente a cargo"),
      C.responsableTipoDoc(["CC", "CE"]),
      C.responsableDocumento(),
      C.acompanantes("Otros docentes a cargo"),
    ],
  },
  SalidaEstudiantesRegional: {
    nombre: "Salida con estudiantes · Regional",
    corto: "Estudiantes regional",
    grupo: "estudiantes",
    nivel: "Regional",
    aviso: AVISO_ESTUDIANTES,
    anticipacion: null,
    gestion: "ARL",
    transportes: ["Publico", "Particular", "Institucional"],
    campos: [
      C.evento(),
      C.destino("Ciudad / departamento de destino"),
      ...VIAJE(),
      C.numeroEstudiantes(),
      C.responsableNombre("Nombre del docente a cargo"),
      C.responsableTipoDoc(["CC", "CE"]),
      C.responsableDocumento(),
      C.acompanantes("Otros docentes a cargo"),
    ],
  },
  SalidaEstudiantesNacional: {
    nombre: "Salida con estudiantes · Nacional",
    corto: "Estudiantes nacional",
    grupo: "estudiantes",
    nivel: "Nacional",
    aviso: AVISO_ESTUDIANTES,
    anticipacion: null,
    gestion: "ARL",
    transportes: ["Publico", "Particular", "Institucional", "Aereo"],
    campos: [
      C.evento(),
      C.destino("Ciudad de destino"),
      ...VIAJE(),
      C.numeroEstudiantes(),
      C.responsableNombre("Nombre del docente a cargo"),
      C.responsableTipoDoc(),
      C.responsableDocumento(),
      C.acompanantes("Otros docentes a cargo"),
    ],
  },
  SalidaEstudiantesInternacional: {
    nombre: "Salida con estudiantes · Internacional",
    corto: "Estudiantes internacional",
    grupo: "estudiantes",
    nivel: "Internacional",
    aviso: AVISO_INTERNACIONAL,
    anticipacion: 5,
    gestion: "ASIST CARD",
    transportes: ["Publico", "Particular", "Institucional", "Aereo"],
    etiquetaTransporte: "Medio de transporte hacia el aeropuerto",
    campos: [
      C.responsableNombre("Nombre completo del responsable"),
      C.responsableTipoDoc(),
      C.responsableDocumento(),
      C.evento(),
      C.pais(),
      C.destino("Ciudad de destino"),
      ...VIAJE("Fecha de llegada"),
      C.numeroEstudiantes(),
      C.acompanantes("Otros participantes"),
    ],
  },
  RepresentacionNacional: {
    nombre: "Representación institucional · Local, regional o nacional",
    corto: "Representación nacional",
    grupo: "representacion",
    nivel: "Local / regional / nacional",
    aviso:
      "Repórtala con al menos 3 días de anticipación: así se verifica la información y se reporta la salida a la ARL en caso de un accidente laboral.",
    anticipacion: 3,
    gestion: "ARL",
    transportes: ["Publico", "Particular", "Institucional", "Aereo", "Caminando"],
    campos: [
      C.responsableNombre(),
      C.responsableTipoDoc(),
      C.responsableDocumento(),
      C.acompanantes("Otros colaboradores"),
      C.evento(),
      C.destino("Ciudad / departamento del evento"),
      ...VIAJE("Fecha de llegada", "Hora de llegada a la Institución"),
    ],
  },
  RepresentacionInternacional: {
    nombre: "Representación institucional · Internacional",
    corto: "Representación internacional",
    grupo: "representacion",
    nivel: "Internacional",
    aviso: AVISO_INTERNACIONAL,
    anticipacion: 5,
    gestion: "ASIST CARD",
    transportes: ["Publico", "Particular", "Institucional"],
    etiquetaTransporte: "Medio de transporte hacia el aeropuerto",
    campos: [
      C.responsableNombre(),
      C.responsableTipoDoc(),
      C.responsableDocumento(),
      C.acompanantes("Otros colaboradores"),
      C.evento(),
      C.pais(),
      C.destino("Ciudad de destino"),
      ...VIAJE(),
    ],
  },
  TrasladoPosgrados: {
    nombre: "Traslado de docentes · Posgrados",
    corto: "Traslado posgrados",
    grupo: "posgrados",
    nivel: "Posgrados",
    aviso:
      "Diligéncialo con mínimo 3 días de anticipación para verificar la documentación del desplazamiento de docentes que vienen de otras ciudades.",
    anticipacion: 3,
    gestion: "ARL",
    transportes: ["Publico", "Particular", "Institucional", "Aereo"],
    campos: [
      C.responsableNombre(),
      C.responsableTipoDoc(["CC", "CE"]),
      C.responsableDocumento(),
      C.motivo(),
      C.ciudadOrigen(),
      C.destino("Ciudad / departamento de destino"),
      C.lugarDestino(),
      ...VIAJE("Fecha de regreso", "Hora de regreso"),
      C.acompanantes("Otros docentes que se trasladan"),
    ],
  },
  CondicionInsegura: {
    nombre: "Condición insegura o incidente",
    corto: "Condición insegura",
    grupo: "riesgo",
    nivel: "Riesgo",
    aviso:
      "Reportar a tiempo una condición insegura permite corregir el peligro antes de que cause daños. Tu reporte es clave para prevenir incidentes.",
    anticipacion: null,
    gestion: null,
    transportes: [],
    campos: [
      { campo: "lugarEvento", label: "Lugar", tipo: "texto" },
      { campo: "fechaEvento", label: "Fecha", tipo: "fecha" },
      { campo: "horaEvento", label: "Hora", tipo: "hora" },
      { campo: "afectado", label: "Persona que sufre el evento", tipo: "texto" },
      { campo: "cargo", label: "Cargo", tipo: "texto" },
      { campo: "descripcion", label: "Descripción del evento", tipo: "parrafo" },
      { campo: "clasificacion", label: "Clasificación del evento", tipo: "opciones", opciones: Object.keys(CLASIFICACIONES) },
      { campo: "potencial", label: "Potencial del evento", tipo: "opciones", opciones: POTENCIALES },
      { campo: "medidaControl", label: "Medida de control propuesta", tipo: "parrafo" },
    ],
  },
};

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
  TIPOS_DOCUMENTO,
  ADJUNTOS,
  TIPOS,
  GRUPOS,
  CAMPOS_TRANSPORTE,
  esSalida,
  adjuntosRequeridos,
  adjuntosOpcionales,
  catalogoPublico,
};
