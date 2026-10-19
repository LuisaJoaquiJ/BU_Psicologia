const ExcelJS = require("exceljs");
const { AppError } = require("../../../../common/utils/AppError");
const { hoyBogota } = require("../../../../common/utils/fechas");
const { sinTildes, interpretarCargo, interpretarTipoDocumento, interpretarExamenLaboral, normalizarPrograma } = require("../catalogos");
const { limpiarIdentificador, nombrePropio } = require("../texto");
const { FORMATOS } = require("./formatos");
const { textoCelda, valorCelda, leerFecha, entero, textoUtil, pesoTalla } = require("./celdas");

// Ubica la hoja y las columnas del formato y convierte cada fila en un
// registro normalizado (persona, fecha, actividad y datos de la atencion).

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

module.exports = { ubicarColumnas, leerLibro, extraerRegistros };
