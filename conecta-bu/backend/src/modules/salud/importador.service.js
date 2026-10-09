const ExcelJS = require("exceljs");
const { prisma } = require("../../config/prisma");
const { AppError } = require("../../common/utils/AppError");
const { hoyBogota } = require("../../common/utils/fechas");
const {
  sinTildes,
  interpretarCargo,
  interpretarTipoDocumento,
  interpretarExamenLaboral,
  normalizarPrograma,
  periodoDeFecha,
  rangoDePeriodo,
} = require("./catalogos");
const { limpiarIdentificador, nombrePropio } = require("./personas.service");

// Importador de los Excel que hoy lleva la Unidad de Salud, para arrancar
// con las personas (y poder buscarlas por documento) y su historial:
//   - Registro general (SPADIEZ): APELLIDOS, NOMBRES, TIPO DE DOCUMENTO,
//     Nº DE DOCUMENTO, TELEFONO, CARGO, FECHA, TIPO DE ACTIVIDAD, ...
//   - Formulario de atencion de enfermeria (Microsoft/Google Forms).
// Primero se muestra una vista previa; solo con confirmar=true se guarda.

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

function textoCelda(valor) {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if (valor.richText) return valor.richText.map((r) => r.text).join("");
    if (valor.text !== undefined) return String(valor.text);
    if (valor.result !== undefined) return textoCelda(valor.result);
  }
  return String(valor).trim();
}

function valorCelda(valor) {
  if (valor && typeof valor === "object" && !(valor instanceof Date) && valor.result !== undefined) return valor.result;
  return valor;
}

function leerFecha(valor) {
  const v = valorCelda(valor);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Numero de serie de Excel (dias desde 1899-12-30).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  }
  const texto = textoCelda(v);
  let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,5})\b/.exec(texto);
  if (m) {
    // Errores de digitacion frecuentes en el año: "026" o "20026" -> 2026, "26" -> 2026.
    let anio = m[3];
    if (anio.length <= 3) anio = `20${anio.slice(-2)}`;
    else if (anio.length === 5 && /^200\d\d$/.test(anio)) anio = `20${anio.slice(-2)}`;
    return new Date(Date.UTC(Number(anio), Number(m[2]) - 1, Number(m[1])));
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(texto);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return null;
}

function entero(valor, min, max) {
  const n = Number(String(textoCelda(valorCelda(valor))).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

function textoUtil(valor, max) {
  const t = textoCelda(valorCelda(valor)).replace(/\s+/g, " ").trim();
  if (!t || /^(NA|N\/A|NO APLICA|NINGUNO|NONE|NO|-)$/i.test(t)) return null;
  return t.slice(0, max);
}

// "65/175" -> peso 65 kg, talla 175 cm (la talla en metros tambien se acepta).
function pesoTalla(valor) {
  const t = textoCelda(valorCelda(valor));
  const m = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(t);
  if (!m) return { pesoKg: null, tallaCm: null };
  const peso = Number(m[1].replace(",", "."));
  let talla = Number(m[2].replace(",", "."));
  if (talla < 3) talla *= 100;
  return {
    pesoKg: peso >= 2 && peso <= 400 ? Math.round(peso * 10) / 10 : null,
    tallaCm: talla >= 30 && talla <= 250 ? Math.round(talla) : null,
  };
}

function ubicarColumnas(hoja) {
  for (let filaCab = 1; filaCab <= 5; filaCab += 1) {
    const cabeceras = [];
    hoja.getRow(filaCab).eachCell({ includeEmpty: false }, (celda, col) => {
      cabeceras.push({ col, texto: sinTildes(textoCelda(celda.value)).replace(/[º°]/g, "").replace(/\s+/g, " ") });
    });
    for (const [clave, formato] of Object.entries(FORMATOS)) {
      const mapa = {};
      for (const [campo, nombres] of Object.entries(formato.columnas)) {
        const encontrada = cabeceras.find((c) => nombres.some((n) => c.texto === n || c.texto.startsWith(n)));
        if (encontrada) mapa[campo] = encontrada.col;
      }
      if (formato.obligatorias.every((c) => mapa[c])) return { formato: clave, mapa, filaCab };
    }
  }
  return null;
}

async function leerLibro(buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw new AppError(400, "No se pudo leer el archivo. Súbelo en formato Excel (.xlsx).");
  }
  for (const hoja of libro.worksheets) {
    const ubicacion = ubicarColumnas(hoja);
    if (ubicacion) return { hoja, ...ubicacion };
  }
  throw new AppError(
    400,
    "No reconocimos el formato. Sube el registro general (columnas APELLIDOS, NOMBRES, Nº DE DOCUMENTO, CARGO, FECHA, TIPO DE ACTIVIDAD) o el formulario de enfermería."
  );
}

// Convierte cada fila del Excel en un registro normalizado.
function extraerRegistros({ hoja, formato, mapa, filaCab }) {
  const registros = [];
  const advertencias = [];
  let corregidas = 0;
  const manana = new Date(hoyBogota().getTime() + 86400000);
  const valor = (fila, campo) => (mapa[campo] ? fila.getCell(mapa[campo]).value : null);

  for (let n = filaCab + 1; n <= hoja.rowCount; n += 1) {
    const fila = hoja.getRow(n);
    const documento = limpiarIdentificador(textoCelda(valorCelda(valor(fila, "documento"))));
    const apellidos = textoUtil(valor(fila, "apellidos"), 120);
    const nombres = textoUtil(valor(fila, "nombres"), 120);
    if (!documento && !apellidos && !nombres) continue;

    if (!documento || documento.length < 4) {
      advertencias.push({ fila: n, motivo: "Sin número de documento válido" });
      continue;
    }
    if (!nombres || !apellidos) {
      advertencias.push({ fila: n, motivo: "Faltan nombres o apellidos" });
      continue;
    }
    let fecha = leerFecha(valor(fila, "fecha"));
    // Excel a veces invierte dia y mes ("11/02/2026" escrito como 11 de
    // febrero queda como 2 de noviembre). Si la fecha resulta futura y el
    // intercambio da una fecha valida pasada, se corrige.
    if (fecha && fecha > manana && fecha.getUTCDate() <= 12) {
      const invertida = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCDate() - 1, fecha.getUTCMonth() + 1));
      if (invertida <= manana) {
        fecha = invertida;
        corregidas += 1;
      }
    }
    if (!fecha || fecha.getUTCFullYear() < 2015 || fecha > manana) {
      advertencias.push({ fila: n, motivo: fecha && fecha > manana ? "Fecha futura (revisar en el Excel)" : "Fecha vacía o no válida" });
      continue;
    }
    const actividadTexto = textoUtil(valor(fila, "actividad"), 200);
    if (!actividadTexto) {
      advertencias.push({ fila: n, motivo: "Sin tipo de actividad o atención" });
      continue;
    }

    const cargoTexto = textoCelda(valorCelda(valor(fila, "cargo")));
    const { poblacion, programa } =
      formato === "enfermeria"
        ? { poblacion: "Estudiante", programa: normalizarPrograma(cargoTexto) }
        : interpretarCargo(cargoTexto);
    const telefono = textoUtil(valor(fila, "telefono"), 30);

    const registro = {
      fila: n,
      persona: {
        numeroDocumento: documento,
        tipoDocumento: interpretarTipoDocumento(textoCelda(valorCelda(valor(fila, "tipoDocumento")))),
        nombres: nombrePropio(nombres),
        apellidos: nombrePropio(apellidos),
        telefono: telefono ? telefono.replace(/\.0+$/, "") : null,
        correo: null,
        poblacion,
        programa,
        consentimiento: formato === "enfermeria" && /^SI/i.test(sinTildes(textoCelda(valorCelda(valor(fila, "consentimiento"))))),
      },
      fecha,
      actividadTexto,
      examenLaboral: interpretarExamenLaboral(textoCelda(valorCelda(valor(fila, "laboral")))),
      insumo: textoUtil(valor(fila, "insumo"), 200),
    };
    const correo = textoUtil(valor(fila, "correo"), 120);
    if (correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) registro.persona.correo = correo.toLowerCase();

    if (formato === "enfermeria") {
      const tension = textoUtil(valor(fila, "tension"), 15);
      Object.assign(registro, {
        tensionArterial: tension && /^\d{2,3}\s*\/\s*\d{2,3}$/.test(tension) ? tension.replace(/\s/g, "") : null,
        frecuenciaCardiaca: entero(valor(fila, "fc"), 20, 250),
        frecuenciaRespiratoria: entero(valor(fila, "fr"), 4, 80),
        ...pesoTalla(valor(fila, "pesoTalla")),
        glucometria: textoUtil(valor(fila, "gluco"), 20),
        descripcion: textoUtil(valor(fila, "descripcion"), 4000),
        remitido: /REMISION/.test(sinTildes(actividadTexto)),
      });
    }
    registros.push(registro);
  }
  return { registros, advertencias, fechasCorregidas: corregidas };
}

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

async function importarExcel(buffer, { confirmar = false } = {}, usuarioId) {
  const lectura = await leerLibro(buffer);
  const { registros, advertencias, fechasCorregidas } = extraerRegistros(lectura);
  if (!registros.length) throw new AppError(400, "El archivo no tiene filas válidas para importar.");

  // Personas: la ultima fila de cada documento trae los datos mas recientes.
  const personasExcel = new Map();
  for (const r of registros) {
    const previa = personasExcel.get(r.persona.numeroDocumento);
    personasExcel.set(r.persona.numeroDocumento, {
      ...previa,
      ...Object.fromEntries(Object.entries(r.persona).filter(([, v]) => v !== null && v !== false)),
      consentimiento: Boolean(previa?.consentimiento || r.persona.consentimiento),
    });
  }
  const documentos = [...personasExcel.keys()];
  const existentes = await prisma.personaSalud.findMany({ where: { numeroDocumento: { in: documentos } } });
  const porDocumento = new Map(existentes.map((p) => [p.numeroDocumento, p]));

  // Actividades por periodo y nombre.
  const periodos = [...new Set(registros.map((r) => periodoDeFecha(r.fecha)))].sort();
  const actividades = await prisma.actividadSalud.findMany({ where: { periodo: { in: periodos } } });
  const catalogo = new Map(actividades.map((a) => [`${a.periodo}|${claveNombre(a.nombre)}`, a]));
  const actividadesNuevas = new Map();
  for (const r of registros) {
    const destino = actividadDestino(r.actividadTexto);
    const periodo = periodoDeFecha(r.fecha);
    const clave = `${periodo}|${claveNombre(destino.nombre)}`;
    r.claveActividad = clave;
    if (!catalogo.has(clave) && !actividadesNuevas.has(clave)) actividadesNuevas.set(clave, { ...destino, periodo, fechas: [] });
    if (actividadesNuevas.has(clave)) actividadesNuevas.get(clave).fechas.push(r.fecha);
  }

  const vistaPrevia = {
    formato: FORMATOS[lectura.formato].nombre,
    hoja: lectura.hoja.name,
    filasLeidas: registros.length + advertencias.length,
    atenciones: registros.length,
    personasNuevas: documentos.filter((d) => !porDocumento.has(d)).length,
    personasExistentes: documentos.filter((d) => porDocumento.has(d)).length,
    periodos,
    actividadesNuevas: [...actividadesNuevas.values()].map((a) => ({ nombre: a.nombre, periodo: a.periodo })),
    filasOmitidas: advertencias.length,
    motivosOmision: advertencias.reduce((acc, a) => ({ ...acc, [a.motivo]: (acc[a.motivo] || 0) + 1 }), {}),
    fechasCorregidas,
    advertencias: advertencias.slice(0, 30),
  };
  if (!confirmar) return { ...vistaPrevia, confirmado: false };

  // 1) Personas nuevas y datos faltantes de las existentes.
  const nuevas = documentos.filter((d) => !porDocumento.has(d)).map((d) => personasExcel.get(d));
  for (let i = 0; i < nuevas.length; i += 500) {
    await prisma.personaSalud.createMany({
      data: nuevas.slice(i, i + 500).map((p) => ({
        numeroDocumento: p.numeroDocumento,
        tipoDocumento: p.tipoDocumento || "CC",
        nombres: p.nombres,
        apellidos: p.apellidos,
        telefono: p.telefono || null,
        correo: p.correo || null,
        poblacion: p.poblacion || "Estudiante",
        programa: p.programa || null,
        consentimientoDatos: Boolean(p.consentimiento),
        fechaConsentimiento: p.consentimiento ? new Date() : null,
      })),
      skipDuplicates: true,
    });
  }
  for (const existente of existentes) {
    const p = personasExcel.get(existente.numeroDocumento);
    const cambios = {};
    if (!existente.telefono && p.telefono) cambios.telefono = p.telefono;
    if (!existente.correo && p.correo) cambios.correo = p.correo;
    if (!existente.programa && p.programa) cambios.programa = p.programa;
    if (!existente.consentimientoDatos && p.consentimiento) Object.assign(cambios, { consentimientoDatos: true, fechaConsentimiento: new Date() });
    if (Object.keys(cambios).length) await prisma.personaSalud.update({ where: { id: existente.id }, data: cambios });
  }
  const personas = await prisma.personaSalud.findMany({ where: { numeroDocumento: { in: documentos } } });
  const idPersona = new Map(personas.map((p) => [p.numeroDocumento, p]));

  // 2) Actividades que no estaban en el catalogo del periodo.
  for (const [clave, a] of actividadesNuevas) {
    const ultima = await prisma.actividadSalud.findFirst({ where: { periodo: a.periodo }, orderBy: { codigo: "desc" } });
    const rango = rangoDePeriodo(a.periodo);
    const fechas = a.fechas.map((f) => f.getTime());
    const creada = await prisma.actividadSalud.create({
      data: {
        codigo: (ultima?.codigo || 0) + 1,
        periodo: a.periodo,
        nombre: a.nombre,
        categoria: a.categoria,
        permanente: a.permanente,
        clinica: a.clinica,
        meta: 1,
        fechaInicio: a.permanente ? rango.desde : new Date(Math.min(...fechas)),
        fechaFin: a.permanente ? rango.hasta : new Date(Math.max(...fechas)),
      },
    });
    catalogo.set(clave, creada);
  }

  // 3) Atenciones, sin duplicar lo ya importado (persona + actividad + fecha).
  const previas = await prisma.atencionSalud.findMany({
    where: { personaId: { in: personas.map((p) => p.id) } },
    select: { personaId: true, actividadId: true, fecha: true },
  });
  const vistas = new Set(previas.map((a) => `${a.personaId}|${a.actividadId}|${new Date(a.fecha).toISOString().slice(0, 10)}`));
  const nuevasAtenciones = [];
  let duplicadas = 0;
  for (const r of registros) {
    const persona = idPersona.get(r.persona.numeroDocumento);
    const actividad = catalogo.get(r.claveActividad);
    const clave = `${persona.id}|${actividad.id}|${r.fecha.toISOString().slice(0, 10)}`;
    if (vistas.has(clave)) {
      duplicadas += 1;
      continue;
    }
    vistas.add(clave);
    nuevasAtenciones.push({
      personaId: persona.id,
      actividadId: actividad.id,
      fecha: r.fecha,
      poblacion: persona.poblacion,
      programa: persona.programa,
      examenLaboral: r.examenLaboral,
      insumo: r.insumo,
      tensionArterial: r.tensionArterial ?? null,
      frecuenciaCardiaca: r.frecuenciaCardiaca ?? null,
      frecuenciaRespiratoria: r.frecuenciaRespiratoria ?? null,
      pesoKg: r.pesoKg ?? null,
      tallaCm: r.tallaCm ?? null,
      glucometria: r.glucometria ?? null,
      descripcion: r.descripcion ?? null,
      remitido: Boolean(r.remitido),
      origen: "importado",
      registradoPorId: usuarioId || null,
    });
  }
  for (let i = 0; i < nuevasAtenciones.length; i += 1000) {
    await prisma.atencionSalud.createMany({ data: nuevasAtenciones.slice(i, i + 1000) });
  }

  return {
    ...vistaPrevia,
    confirmado: true,
    importadas: nuevasAtenciones.length,
    duplicadasOmitidas: duplicadas,
    actividadesCreadas: actividadesNuevas.size,
  };
}

module.exports = { importarExcel, leerFecha, pesoTalla, actividadDestino, extraerRegistros, leerLibro };
