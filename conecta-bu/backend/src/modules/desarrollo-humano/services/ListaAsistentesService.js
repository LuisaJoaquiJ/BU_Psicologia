const { prisma } = require("../../../config/prisma");
const { AppError } = require("../../../common/utils/AppError");
const { LibroExcel } = require("../archivos/LibroExcel");
const { PdfDocumento } = require("../archivos/PdfDocumento");

// Lista de asistentes de citas y de un evento, en Excel o PDF, con el mismo
// formato de los informes de Desarrollo Humano.
const FORMATOS = ["xlsx", "pdf"];
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const hora = (d) => new Date(d).toISOString().slice(11, 16);
const ESTADO = { Agendada: "Agendada", Atendida: "Atendida", NoAsistio: "No asistió", Cancelada: "Cancelada" };
const asistencia = (a) => (a === true ? "Asistió" : a === false ? "No asistió" : "Sin registrar");
const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

const COLUMNAS_CITAS = [
  { clave: "fecha", titulo: "Fecha", ancho: 12 },
  { clave: "hora", titulo: "Hora", ancho: 13 },
  { clave: "servicio", titulo: "Servicio", ancho: 24 },
  { clave: "estudiante", titulo: "Estudiante", ancho: 28 },
  { clave: "correo", titulo: "Correo", ancho: 32 },
  { clave: "estado", titulo: "Estado", ancho: 13 },
  { clave: "asistencia", titulo: "Asistencia", ancho: 14 },
];
const COLUMNAS_EVENTO = [
  { clave: "estudiante", titulo: "Estudiante", ancho: 32 },
  { clave: "correo", titulo: "Correo", ancho: 36 },
  { clave: "inscripcion", titulo: "Inscripción", ancho: 14 },
  { clave: "asistencia", titulo: "Asistencia", ancho: 16 },
];

class ListaAsistentesService {
  async citas({ desde, hasta } = {}) {
    if (!desde || !hasta) throw new AppError(400, "Indica desde y hasta (AAAA-MM-DD).");
    const citas = await prisma.citaDesarrollo.findMany({
      where: { horario: { fecha: { gte: new Date(desde), lte: new Date(hasta) } } },
      include: {
        usuario: { select: { nombre: true, emailInstitucional: true } },
        horario: { include: { servicio: { select: { nombre: true } } } },
        asistencia: true,
      },
      orderBy: [{ horario: { fecha: "asc" } }, { horario: { horaInicio: "asc" } }],
    });
    const filas = citas.map((c) => ({
      fecha: iso(c.horario.fecha),
      hora: `${hora(c.horario.horaInicio)} - ${hora(c.horario.horaFin)}`,
      servicio: c.horario.servicio?.nombre || "",
      estudiante: c.usuario.nombre,
      correo: c.usuario.emailInstitucional,
      estado: ESTADO[c.estado] || c.estado,
      asistencia: asistencia(c.asistencia?.asistio),
    }));
    const asistieron = filas.filter((f) => f.asistencia === "Asistió").length;
    return {
      titulo: "Asistentes a citas · Desarrollo Humano",
      nota: `Periodo: ${desde} a ${hasta} · ${filas.length} citas · ${asistieron} asistieron`,
      columnas: COLUMNAS_CITAS,
      filas,
      nombre: `asistentes-citas-${desde}_a_${hasta}`,
    };
  }

  async evento(eventoId) {
    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento) throw new AppError(404, "El evento no existe.");
    const inscripciones = await prisma.inscripcion.findMany({
      where: { eventoId, estado: "Confirmada" },
      include: { usuario: { select: { nombre: true, emailInstitucional: true } }, asistencia: true },
      orderBy: { usuario: { nombre: "asc" } },
    });
    const filas = inscripciones.map((i) => ({
      estudiante: i.usuario.nombre,
      correo: i.usuario.emailInstitucional,
      inscripcion: iso(i.fechaInscripcion),
      asistencia: asistencia(i.asistencia?.asistio),
    }));
    const asistieron = filas.filter((f) => f.asistencia === "Asistió").length;
    return {
      titulo: `Asistentes · ${evento.nombre}`,
      nota: `${iso(evento.fecha)}, ${hora(evento.horaInicio)} - ${hora(evento.horaFin)} · ${filas.length} inscritos · ${asistieron} asistieron`,
      columnas: COLUMNAS_EVENTO,
      filas,
      nombre: `asistentes-${slug(evento.nombre) || "evento"}`,
    };
  }

  async archivo(lista, formato = "xlsx") {
    if (!FORMATOS.includes(formato)) throw new AppError(400, "El formato debe ser xlsx o pdf.");
    let buffer;
    if (formato === "xlsx") {
      const libro = new LibroExcel(lista.titulo);
      libro.hojaTabla("Asistentes", { titulo: lista.titulo, nota: lista.nota, columnas: lista.columnas, filas: lista.filas });
      buffer = Buffer.from(await libro.aBuffer());
    } else {
      const pdf = new PdfDocumento(lista.titulo);
      pdf.tituloSeccion(lista.titulo, lista.nota);
      pdf.tabla(lista.columnas, lista.filas);
      pdf.pie("Conecta BU · Desarrollo Humano");
      buffer = await pdf.aBuffer();
    }
    return { buffer, nombre: `${lista.nombre}.${formato}` };
  }
}

module.exports = { ListaAsistentesService, listaAsistentesService: new ListaAsistentesService() };