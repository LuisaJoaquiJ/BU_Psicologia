const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { POBLACIONES, TIPOS_DOCUMENTO, normalizarPrograma } = require("./catalogos");

// Personas atendidas por la Unidad de Salud (estudiantes, docentes,
// administrativos, egresados y externos). Se registran una sola vez; luego
// basta el numero de documento o el codigo estudiantil.

// Deja solo digitos y letras: "1.061.731.427", "1061731427.0" (Excel) y
// " 1061731427 " terminan siendo el mismo documento.
function limpiarIdentificador(valor) {
  if (valor === null || valor === undefined) return "";
  let texto = typeof valor === "number" ? String(Math.trunc(valor)) : String(valor).trim();
  texto = texto.replace(/\.0+$/, "");
  return texto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function textoOpcional(valor, max) {
  if (valor === undefined) return undefined;
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, max) : null;
}

function nombrePropio(valor) {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  return texto.replace(/(^|\s|-)(\p{L})/gu, (m, sep, letra) => sep + letra.toUpperCase());
}

async function buscarPorIdentificador(identificador) {
  const id = limpiarIdentificador(identificador);
  if (!id) return null;
  return prisma.personaSalud.findFirst({
    where: { OR: [{ numeroDocumento: id }, { codigoEstudiantil: id }] },
  });
}

// Busqueda del registro rapido: coincidencia exacta por documento/codigo y,
// si se escribio un nombre, coincidencias parciales por nombre o apellido.
async function buscarPersonas(q) {
  const texto = String(q || "").trim();
  if (texto.length < 2) return { exacta: null, coincidencias: [] };

  const exacta = await buscarPorIdentificador(texto);
  let coincidencias = [];
  if (!exacta && /\p{L}/u.test(texto)) {
    const partes = texto.split(/\s+/).filter(Boolean).slice(0, 3);
    const candidatos = await prisma.personaSalud.findMany({
      where: {
        OR: [
          { nombres: { contains: partes[0], mode: "insensitive" } },
          { apellidos: { contains: partes[0], mode: "insensitive" } },
        ],
      },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      take: 50,
    });
    const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    coincidencias = candidatos
      .filter((p) => partes.every((parte) => normal(`${p.nombres} ${p.apellidos}`).includes(normal(parte))))
      .slice(0, 8);
  } else if (!exacta && /^\d{4,}$/.test(limpiarIdentificador(texto))) {
    // Documento incompleto: sugiere los que empiezan igual.
    coincidencias = await prisma.personaSalud.findMany({
      where: { numeroDocumento: { startsWith: limpiarIdentificador(texto) } },
      orderBy: { numeroDocumento: "asc" },
      take: 8,
    });
  }
  return { exacta, coincidencias };
}

function validarDatosPersona(datos, { parcial = false } = {}) {
  const limpio = {};

  if (!parcial || datos.numeroDocumento !== undefined) {
    limpio.numeroDocumento = limpiarIdentificador(datos.numeroDocumento);
    if (limpio.numeroDocumento.length < 4) throw new AppError(400, "Escribe un número de documento válido.");
  }
  if (datos.codigoEstudiantil !== undefined) {
    limpio.codigoEstudiantil = limpiarIdentificador(datos.codigoEstudiantil) || null;
  }
  if (!parcial || datos.tipoDocumento !== undefined) {
    limpio.tipoDocumento = datos.tipoDocumento || "CC";
    if (!TIPOS_DOCUMENTO[limpio.tipoDocumento]) throw new AppError(400, "El tipo de documento no es válido.");
  }
  for (const campo of ["nombres", "apellidos"]) {
    if (!parcial || datos[campo] !== undefined) {
      limpio[campo] = nombrePropio(datos[campo]).slice(0, 120);
      if (!limpio[campo]) throw new AppError(400, `Faltan los ${campo} de la persona.`);
    }
  }
  if (!parcial || datos.poblacion !== undefined) {
    limpio.poblacion = datos.poblacion || "Estudiante";
    if (!POBLACIONES.includes(limpio.poblacion)) throw new AppError(400, "La población indicada no es válida.");
  }
  if (datos.programa !== undefined) {
    limpio.programa = datos.programa ? normalizarPrograma(datos.programa) || textoOpcional(datos.programa, 150) : null;
  }
  const telefono = textoOpcional(datos.telefono, 30);
  if (telefono !== undefined) limpio.telefono = telefono ? telefono.replace(/\.0+$/, "") : null;
  const correo = textoOpcional(datos.correo, 120);
  if (correo !== undefined) {
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new AppError(400, "El correo no es válido.");
    limpio.correo = correo ? correo.toLowerCase() : null;
  }
  if (datos.consentimientoDatos !== undefined) {
    limpio.consentimientoDatos = datos.consentimientoDatos === true;
    if (limpio.consentimientoDatos) limpio.fechaConsentimiento = new Date();
  }
  return limpio;
}

function esConflictoUnico(err) {
  return err?.code === "P2002";
}

async function crearPersona(datos) {
  const limpio = validarDatosPersona(datos);
  // Ley 1581 de 2012: sin autorizacion no se guardan los datos.
  if (!limpio.consentimientoDatos) {
    throw new AppError(400, "La persona debe autorizar el tratamiento de sus datos (Ley 1581 de 2012).", "SIN_CONSENTIMIENTO");
  }
  try {
    return await prisma.personaSalud.create({ data: limpio });
  } catch (err) {
    if (esConflictoUnico(err)) throw new AppError(409, "Ya existe una persona con ese documento o código estudiantil.");
    throw err;
  }
}

async function obtenerPersonaOFallar(id) {
  const persona = await prisma.personaSalud.findUnique({ where: { id } });
  if (!persona) throw new AppError(404, "La persona no existe.");
  return persona;
}

async function actualizarPersona(id, datos) {
  await obtenerPersonaOFallar(id);
  const limpio = validarDatosPersona(datos, { parcial: true });
  try {
    return await prisma.personaSalud.update({ where: { id }, data: limpio });
  } catch (err) {
    if (esConflictoUnico(err)) throw new AppError(409, "Ya existe una persona con ese documento o código estudiantil.");
    throw err;
  }
}

async function obtenerPersona(id) {
  const persona = await obtenerPersonaOFallar(id);
  const atenciones = await prisma.atencionSalud.findMany({
    where: { personaId: id },
    include: { actividad: true, registradoPor: { select: { nombre: true } } },
    orderBy: [{ fecha: "desc" }, { fechaRegistro: "desc" }],
    take: 100,
  });
  return { ...persona, atenciones };
}

async function listarPersonas({ q, poblacion, pagina = 1 } = {}) {
  const where = {};
  if (poblacion) where.poblacion = poblacion;
  const texto = String(q || "").trim();
  if (texto) {
    const id = limpiarIdentificador(texto);
    where.OR = [
      { nombres: { contains: texto, mode: "insensitive" } },
      { apellidos: { contains: texto, mode: "insensitive" } },
      ...(id ? [{ numeroDocumento: { startsWith: id } }, { codigoEstudiantil: { startsWith: id } }] : []),
    ];
  }
  const porPagina = 25;
  const [total, personas] = await Promise.all([
    prisma.personaSalud.count({ where }),
    prisma.personaSalud.findMany({
      where,
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      skip: (Math.max(1, Number(pagina)) - 1) * porPagina,
      take: porPagina,
    }),
  ]);
  return { total, pagina: Number(pagina) || 1, porPagina, personas };
}

module.exports = {
  limpiarIdentificador,
  nombrePropio,
  buscarPorIdentificador,
  buscarPersonas,
  validarDatosPersona,
  crearPersona,
  actualizarPersona,
  obtenerPersona,
  obtenerPersonaOFallar,
  listarPersonas,
};
