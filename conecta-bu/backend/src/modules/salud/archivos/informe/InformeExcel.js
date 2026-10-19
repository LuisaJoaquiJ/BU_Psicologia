const ExcelJS = require("exceljs");
const { agregarGraficas } = require("./excelGraficas");
const { hojaAtendidos, hojaFotografica } = require("../hojasGestion");
const { leerLogo } = require("./formatoExcel");
const { hojaProyecto, hojaEvaluacion } = require("./hojasProyecto");
const { hojaEstadisticas } = require("./hojaEstadisticas");

// Informe de gestion en Excel con el formato INFBI-002 de la Uniautonoma:
// PROYECTO, INFORME - EVALUACIÓN, ATENDIDOS, ESTADÍSTICAS (con graficas
// nativas de Excel) y REGISTRO FOTOGRÁFICO.
class InformeExcel {
  constructor(informe, cifras, leerArchivo) {
    this.informe = informe;
    this.cifras = cifras;
    this.leerArchivo = leerArchivo;
    this.libro = new ExcelJS.Workbook();
    this.libro.creator = "Conecta BU";
    this.libro.created = new Date();
  }

  async generar() {
    const logo = leerLogo();
    const idLogo = logo ? this.libro.addImage({ buffer: logo, extension: "png" }) : null;
    hojaProyecto(this.libro, this.informe, idLogo);
    hojaEvaluacion(this.libro, this.informe, this.cifras, idLogo);
    hojaAtendidos(this.libro, this.cifras.periodo, this.cifras.matriz);
    const graficas = hojaEstadisticas(this.libro, this.cifras);
    await hojaFotografica(this.libro, this.cifras.periodo, this.cifras.evidencias, this.leerArchivo);
    const buffer = await this.libro.xlsx.writeBuffer();
    return agregarGraficas(Buffer.from(buffer), graficas);
  }
}

const generarExcel = (informe, cifras, leerArchivo) => new InformeExcel(informe, cifras, leerArchivo).generar();

module.exports = { InformeExcel, generarExcel };
