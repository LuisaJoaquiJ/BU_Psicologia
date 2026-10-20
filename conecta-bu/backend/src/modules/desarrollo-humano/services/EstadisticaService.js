const { EstadisticaRepository } = require("../repositories/EstadisticaRepository");
const { rangoFechas, armarEstadisticas } = require("../utils/indicadores");
const { construirInforme } = require("../utils/informeDatos");
const { generarExcel } = require("../archivos/InformeExcel");
const { generarPdf } = require("../archivos/InformePdf");
const { AppError } = require("../../../common/utils/AppError");

const FORMATOS = { xlsx: generarExcel, pdf: generarPdf };

// RF-015: panel de estadisticas e informe descargable de Desarrollo Humano.
// Los calculos se hacen en memoria sobre el resultado de la consulta: con el
// volumen de un modulo de Bienestar es simple y suficientemente rapido.
class EstadisticaService {
  constructor(repo = new EstadisticaRepository()) {
    this.repo = repo;
  }

  async obtener({ desde, hasta } = {}) {
    const filas = await this.repo.datosDelPeriodo(rangoFechas({ desde, hasta }));
    return armarEstadisticas(filas, { desde, hasta });
  }

  // Las mismas estadisticas mas el detalle (citas, asistentes, estudiantes).
  async informe({ desde, hasta } = {}) {
    const filas = await this.repo.datosDelPeriodo(rangoFechas({ desde, hasta }));
    return construirInforme(filas, armarEstadisticas(filas, { desde, hasta }));
  }

  // Archivo del informe (xlsx o pdf) con su nombre.
  async archivo({ desde, hasta, formato = "xlsx" } = {}) {
    const generar = FORMATOS[formato];
    if (!generar) throw new AppError(400, "El formato debe ser xlsx o pdf.");
    const informe = await this.informe({ desde, hasta });
    const sufijo = desde || hasta ? `${desde || "inicio"}_a_${hasta || "hoy"}` : informe.generado.toISOString().slice(0, 10);
    return { buffer: Buffer.from(await generar(informe)), nombre: `informe-bienestar-${sufijo}.${formato}` };
  }
}

module.exports = { EstadisticaService, estadisticaService: new EstadisticaService() };
