const ExcelJS = require("exceljs");
const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { sinTildes, interpretarTipoDocumento, normalizarPrograma } = require("../utils/catalogos");
const { limpiarIdentificador, nombrePropio } = require("../utils/texto");
const { textoCelda, valorCelda, textoUtil } = require("../utils/importacion/celdas");
const { generarListaActivos } = require("../archivos/EstudiantesActivosExcel");

// Lista de estudiantes activos que Salud integral sube cada periodo (la que
// entrega Registro academico). Quedan cargados en Personas para buscarlos al
// registrar atenciones y para llenar sus datos al inscribirse a salidas.
// Primero se muestra una vista previa; solo con confirmar=true se guarda.

// Nombres de columna aceptados (sin tildes, en mayuscula; basta con que empiece igual).
const CABECERAS = {
  tipoDocumento: ["TIPO DE DOCUMENTO", "TIPO DOCUMENTO", "TIPO DOC", "TIPO ID", "TIPO DE IDENTIFICACION"],
  numeroDocumento: ["NUMERO DE DOCUMENTO", "NUMERO DOCUMENTO", "N DE DOCUMENTO", "NO DE DOCUMENTO", "NO. DOCUMENTO", "DOCUMENTO", "CEDULA", "IDENTIFICACION", "NUMERO DE IDENTIFICACION"],
  codigoEstudiantil: ["CODIGO ESTUDIANTIL", "CODIGO"],
  nombres: ["NOMBRES", "NOMBRE"],
  apellidos: ["APELLIDOS", "APELLIDO"],
  programa: ["PROGRAMA", "PROGRAMA ACADEMICO", "CARRERA"],
  correo: ["CORREO INSTITUCIONAL", "CORREO", "EMAIL", "E-MAIL"],
  telefono: ["TELEFONO", "CELULAR", "MOVIL"],
};
const OBLIGATORIAS = ["numeroDocumento", "nombres", "apellidos"];
const TIPOS_VALIDOS = ["CC", "TI", "CE", "PA", "RC"];

function ubicarColumnas(hoja) {
  for (let filaCab = 1; filaCab <= 5; filaCab += 1) {
    const cabeceras = [];
    hoja.getRow(filaCab).eachCell({ includeEmpty: false }, (celda, col) => {
      cabeceras.push({ col, texto: sinTildes(textoUtil(celda.value, 80) || "").replace(/[º°]/g, "") });
    });
    const mapa = {};
    // Primero las columnas mas especificas, para que "DOCUMENTO" no tome "TIPO DE DOCUMENTO".
    for (const [campo, nombres] of Object.entries(CABECERAS)) {
      const libre = cabeceras.filter((c) => !Object.values(mapa).includes(c.col));
      const exacta = libre.find((c) => nombres.includes(c.texto));
      const parcial = libre.find((c) => nombres.some((n) => c.texto.startsWith(n)));
      if (exacta || parcial) mapa[campo] = (exacta || parcial).col;
    }
    if (OBLIGATORIAS.every((c) => mapa[c])) return { mapa, filaCab };
  }
  return null;
}

async function leerLista(buffer) {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw new AppError(400, "No se pudo leer el archivo. Súbelo en formato Excel (.xlsx).");
  }
  let ubicacion = null;
  const hoja = libro.worksheets.find((h) => (ubicacion = ubicarColumnas(h)));
  if (!hoja) throw new AppError(400, "No encontramos las columnas. Usa la plantilla: Número de documento, Nombres y Apellidos son obligatorias.");

  const { mapa, filaCab } = ubicacion;
  const valor = (fila, campo, max) => (mapa[campo] ? textoUtil(fila.getCell(mapa[campo]).value, max) : null);
  const estudiantes = new Map();
  const errores = [];
  let repetidas = 0;
  for (let n = filaCab + 1; n <= hoja.rowCount; n += 1) {
    const fila = hoja.getRow(n);
    const crudo = valorCelda(fila.getCell(mapa.numeroDocumento).value);
    const numeroDocumento = limpiarIdentificador(typeof crudo === "number" ? crudo : textoCelda(crudo));
    const nombres = valor(fila, "nombres", 120);
    const apellidos = valor(fila, "apellidos", 120);
    if (!numeroDocumento && !nombres && !apellidos) continue;
    if (!numeroDocumento) errores.push({ fila: n, motivo: "Sin número de documento" });
    else if (numeroDocumento.length < 5 || numeroDocumento.length > 30) errores.push({ fila: n, motivo: "Número de documento no válido" });
    else if (!nombres || !apellidos) errores.push({ fila: n, motivo: "Faltan nombres o apellidos" });
    else {
      if (estudiantes.has(numeroDocumento)) repetidas += 1;
      const tipo = interpretarTipoDocumento(valor(fila, "tipoDocumento", 40) || "");
      const correo = (valor(fila, "correo", 120) || "").toLowerCase();
      const programaTexto = valor(fila, "programa", 150);
      estudiantes.set(numeroDocumento, {
        numeroDocumento,
        tipoDocumento: TIPOS_VALIDOS.includes(tipo) ? tipo : "CC",
        codigoEstudiantil: limpiarIdentificador(valor(fila, "codigoEstudiantil", 30)) || null,
        nombres: nombrePropio(nombres),
        apellidos: nombrePropio(apellidos),
        programa: normalizarPrograma(programaTexto) || programaTexto,
        correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : null,
        telefono: valor(fila, "telefono", 30),
      });
    }
  }
  return { estudiantes, errores, repetidas };
}

class EstudiantesActivosService {
  constructor(r = repos) {
    this.repos = r;
  }

  async resumen() {
    return { activos: await this.repos.personas.contar({ estudianteActivo: true }) };
  }

  async plantilla() {
    return generarListaActivos([]);
  }

  async exportar() {
    return generarListaActivos(await this.repos.personas.estudiantesActivos());
  }

  async importar(buffer, { confirmar = false } = {}) {
    const { estudiantes, errores, repetidas } = await leerLista(buffer);
    if (!estudiantes.size) throw new AppError(400, errores.length ? "Ninguna fila es válida: revisa documento, nombres y apellidos." : "El archivo no tiene estudiantes. Llena la plantilla con una fila por estudiante (desde la fila 2) y vuelve a subirla.");
    const documentos = [...estudiantes.keys()];
    const existentes = await this.repos.personas.porDocumentos(documentos);
    const yaEstan = new Map(existentes.map((p) => [p.numeroDocumento, p]));
    const salen = await this.repos.personas.contar({ estudianteActivo: true, numeroDocumento: { notIn: documentos } });

    const vistaPrevia = {
      estudiantes: estudiantes.size,
      nuevos: documentos.filter((d) => !yaEstan.has(d)).length,
      actualizados: documentos.filter((d) => yaEstan.has(d)).length,
      dejanDeEstarActivos: salen,
      repetidas,
      filasConError: errores.length,
      errores: errores.slice(0, 30),
    };
    if (!confirmar) return { ...vistaPrevia, confirmado: false };

    // Codigos estudiantiles que ya tiene otra persona: se omiten para no chocar.
    const codigos = [...estudiantes.values()].map((e) => e.codigoEstudiantil).filter(Boolean);
    const duenos = new Map((await this.repos.personas.porCodigos(codigos)).map((p) => [p.codigoEstudiantil, p.numeroDocumento]));
    const vistos = new Set();
    for (const e of estudiantes.values()) {
      const dueno = e.codigoEstudiantil && duenos.get(e.codigoEstudiantil);
      if (e.codigoEstudiantil && ((dueno && dueno !== e.numeroDocumento) || vistos.has(e.codigoEstudiantil))) e.codigoEstudiantil = null;
      if (e.codigoEstudiantil) vistos.add(e.codigoEstudiantil);
    }

    const nuevos = documentos.filter((d) => !yaEstan.has(d)).map((d) => ({ ...estudiantes.get(d), poblacion: "Estudiante", estudianteActivo: true }));
    for (let i = 0; i < nuevos.length; i += 500) await this.repos.personas.crearVarias(nuevos.slice(i, i + 500));
    for (const [doc, actual] of yaEstan) {
      const e = estudiantes.get(doc);
      // Datos de la lista oficial; lo que la lista no trae se conserva.
      const cambios = { tipoDocumento: e.tipoDocumento, nombres: e.nombres, apellidos: e.apellidos, poblacion: "Estudiante", estudianteActivo: true };
      for (const campo of ["codigoEstudiantil", "programa", "correo", "telefono"]) if (e[campo] && e[campo] !== actual[campo]) cambios[campo] = e[campo];
      await this.repos.personas.actualizar(actual.id, cambios);
    }
    await this.repos.personas.desactivarEstudiantesExcepto(documentos);
    return { ...vistaPrevia, confirmado: true };
  }
}

module.exports = { EstudiantesActivosService, estudiantesActivosService: new EstudiantesActivosService(), leerLista };
