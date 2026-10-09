// Textos del formato INFBI-002 de Salud integral (hoja PROYECTO del informe
// de gestion vigente). Se usan para prellenar el primer informe; despues,
// cada informe nuevo copia los textos del informe anterior del modulo.
const PLANTILLA_SALUD = {
  "descripcion": "La Unidad de Salud Integral de la Corporación Universitaria Autónoma del Cauca, respaldada por una amplia trayectoria de excelencia académica e institucional, se dedica a la ejecución eficiente y oportuna de proyectos enfocados en la mejora continua.\n\nAlineados con la misión y visión institucional, nuestro impacto directo se refleja en el bienestar integral de estudiantes, docentes y colaboradores a través de tres pilares de servicio: atención básica de enfermería, asesoría en planificación familiar y el desarrollo de programas de prevención. Mediante el cumplimiento riguroso de nuestro cronograma de talleres, pausas activas y campañas, garantizamos una cobertura integral que promueve entornos y estilos de vida saludables en toda la comunidad UNIAUTONOMA DEL CAUCA.",
  "justificacion": "Como Equipo de Salud Integral, nuestro compromiso es la mejora continua en la atención a nuestra comunidad universitaria. Nos dedicamos a la innovación, buscando constantemente nuevas estrategias para brindar atención oportuna y eficiente a estudiantes, personal administrativo y docentes en sus entornos académicos y laborales. Este enfoque estratégico fortalece el puesto de primeros auxilios y optimiza nuestros servicios, incluyendo aquellos derivados de convenios interinstitucionales, para así atender integralmente las necesidades de salud de toda nuestra comunidad.\nA través de campañas de difusión proactivas, nos aseguramos de que todos nuestros estudiantes, docentes y personal administrativo conozcan la gama completa de servicios que ofrecemos. Nuestro objetivo es brindar atención adecuada, realizar detecciones tempranas de posibles problemas de salud y ofrecer una atención integral que abarque el bienestar físico, mental y emocional. En Salud Integral, la salud de nuestra comunidad es nuestra prioridad.",
  "alineacion": "Fortalecimiento y posicionamiento del sistema de salud institucional como unidad de Salud Integral, reconocido por su excelencia en la prestación de servicios centrados en el bienestar integral de toda la comunidad universitaria.",
  "objetivos": [
    {
      "objetivo": "Potenciar de forma proactiva y enfocada nuevas iniciativas que impulsen la calidad y eficacia de nuestros servicios como profesionales de la salud, orientados hacia la mejora continua de nuestra atención diaria.",
      "resultado": "Mayor acceso a servicios de salud integrales y de calidad para estudiantes, profesores y personal administrativo. Mejora en la conciencia y educación sobre la importancia de la salud integral dentro de la comunidad universitaria. Aumento en la satisfacción de los usuarios con los servicios de salud ofrecidos. Fomento de estilos de vida saludables y prevención de enfermedades a través de programas y actividades de promoción de la salud.",
      "beneficio": "Mejora en la calidad de vida de los miembros de la comunidad universitaria al recibir una atención médica más completa y centrada en su bienestar general. Reducción de enfermedades y lesiones a través de la promoción de estilos de vida saludables y la prevención de enfermedades. Mayor conciencia sobre la importancia de la salud integral y el autocuidado entre los estudiantes, profesores y personal administrativo."
    },
    {
      "objetivo": "Crear alianzas tanto internas como externas para ampliar la cobertura de los servicios de salud disponibles para cada estudiante o miembro beneficiado de la comunidad Uniautónoma, con el propósito de garantizar un acceso más completo y efectivo a la atención necesaria.",
      "resultado": "Mejora en la calidad de atención: Posibilidad de acceder a especialistas y recursos adicionales a través de las alianzas, lo que puede resultar en una atención más especializada y de mayor calidad. Optimización de recursos: Compartir recursos y conocimientos con otras entidades puede llevar a una utilización más eficiente de los recursos disponibles para la atención médica.\nMayor satisfacción del usuario: Al ofrecer una gama más amplia de servicios y una atención más completa, se espera que los usuarios se sientan más satisfechos con la atención recibida.\nPromoción de la salud integral: Al trabajar en colaboración con diversas entidades, se puede promover una visión más holística de la salud y el bienestar, abordando no solo la atención médica, sino también aspectos de prevención y promoción de la salud.",
      "beneficio": "Acceso ampliado a servicios especializados: Colaborar con diversas entidades puede brindar acceso a servicios médicos especializados que de otra manera podrían no estar disponibles internamente.\nMejora en la atención preventiva: Al tener una red ampliada de servicios y recursos, se puede enfocar en la prevención de enfermedades y promoción de la salud de manera más efectiva.\nVariedad de opciones de tratamiento: Al contar con alianzas externas, se pueden explorar diferentes opciones de tratamiento y enfoques terapéuticos para adaptarse a las necesidades individuales de los estudiantes y beneficiados.\nEnriquecimiento de la oferta de servicios: La diversificación de servicios a través de alianzas puede enriquecer la oferta de atención médica y bienestar, proporcionando una atención más completa y holística."
    }
  ]
};

// Encabezado del formato institucional.
const FORMATO = {
  codigo: "INFBI-002",
  version: 1,
  fecha: "2025-05-09",
  proceso: "DIRECCIONAMIENTO ESTRATÉGICO",
};

const NOMBRE_PROYECTO = { salud: "SALUD INTEGRAL" };

module.exports = { PLANTILLA_SALUD, FORMATO, NOMBRE_PROYECTO };
