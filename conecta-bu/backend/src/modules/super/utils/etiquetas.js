// Nombres que el tablero del superadministrador muestra para los codigos
// guardados en la base de datos (categorias de Salud y tipos de reporte SST).

const CATEGORIAS_SALUD = {
  AtencionEnfermeria: "Atención servicio de enfermería",
  PromocionPrevencion: "Actividades de promoción y prevención de la salud",
  CampanaSalud: "Campañas de salud, belleza y autocuidado",
  DonacionSangre: "Campaña de donación de sangre",
  MedicinaLaboral: "Medicina laboral",
  Otra: "Otra",
};

const TIPOS_SST = {
  SalidaEstudiantesLocal: "Estudiantes local",
  SalidaEstudiantesRegional: "Estudiantes regional",
  SalidaEstudiantesNacional: "Estudiantes nacional",
  SalidaEstudiantesInternacional: "Estudiantes internacional",
  RepresentacionNacional: "Representación nacional",
  RepresentacionInternacional: "Representación internacional",
  TrasladoPosgrados: "Traslado posgrados",
  CondicionInsegura: "Condición insegura",
};

const ESTADOS_CITA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const ESTADOS_SST = ["Recibido", "Verificado", "RequiereAjustes", "Cerrado"];
const MODULOS_TABLERO = ["desarrollo-humano", "salud", "deporte"];

module.exports = { CATEGORIAS_SALUD, TIPOS_SST, ESTADOS_CITA, ESTADOS_SST, MODULOS_TABLERO };
