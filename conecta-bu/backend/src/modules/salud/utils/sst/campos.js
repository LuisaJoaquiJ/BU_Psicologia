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

module.exports = { AREAS, TRANSPORTES, ESTADOS, CLASIFICACIONES, POTENCIALES, TIPOS_DOCUMENTO, ADJUNTOS, C, VIAJE };
