const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { rangoDePeriodo } = require("../utils/catalogos");
const { armarCifras, revisarInforme } = require("../utils/informe/cifras");
const { ordenPeriodo } = require("../utils/informe/series");
const { PLANTILLA_SALUD } = require("../utils/informe/plantilla");
const { MODULO, EDITABLES, serializar, datosEditables } = require("../utils/informe/edicion");
const { reporteService } = require("./ReporteService");
const { informeArchivoService } = require("./InformeArchivoService");

// Informe de gestion (INFBI-002): el modulo lo prepara por periodo y lo envia
// al superadministrador. Mientras es borrador las cifras se calculan en vivo;
// al enviarlo se guarda una foto de las cifras (datosEnviados), que es lo que
// descarga el superadministrador aunque despues se sigan registrando datos.
class InformeService {
  constructor(r = repos, archivos = informeArchivoService) {
    this.repos = r;
    this.archivos = archivos;
  }

  async cifras(periodo) {
    return armarCifras(periodo, await this.repos.cifras.delPeriodo(periodo, rangoDePeriodo(periodo)));
  }

  periodoValido(periodo) {
    return reporteService.validarPeriodo(periodo).periodo;
  }

  buscar(periodo) {
    return this.repos.informes.dePeriodo(MODULO, periodo);
  }

  // Un informe nuevo copia los textos del ultimo informe del modulo (o la
  // plantilla del formato vigente si es el primero).
  async borradorNuevo(periodo) {
    const anteriores = await this.repos.informes.delModulo(MODULO);
    const ultimo = anteriores.filter((i) => ordenPeriodo(i.periodo) < ordenPeriodo(periodo)).sort((a, b) => ordenPeriodo(b.periodo) - ordenPeriodo(a.periodo))[0];
    const fuente = ultimo || PLANTILLA_SALUD;
    return {
      id: null,
      modulo: MODULO,
      periodo,
      fechaPresentacion: null,
      responsable: ultimo?.responsable || null,
      accionMejora: ultimo ? ultimo.accionMejora : true,
      accionCorrectiva: ultimo ? ultimo.accionCorrectiva : true,
      accionPreventiva: ultimo ? ultimo.accionPreventiva : true,
      descripcion: fuente.descripcion,
      justificacion: fuente.justificacion,
      alineacion: fuente.alineacion,
      objetivos: fuente.objetivos,
      logros: null,
      dificultades: null,
      accionesMejora: null,
      estado: "Borrador",
      version: 0,
      copiadoDe: ultimo ? ultimo.periodo : "plantilla",
    };
  }

  async obtener(periodo) {
    const per = this.periodoValido(periodo);
    const informe = (await this.buscar(per)) || (await this.borradorNuevo(per));
    const cifras = informe.datosEnviados && !EDITABLES.includes(informe.estado) ? informe.datosEnviados : await this.cifras(per);
    return { informe: serializar(informe), cifras, revision: revisarInforme(informe, cifras) };
  }

  async listar() {
    return (await this.repos.informes.delModulo(MODULO)).map(serializar);
  }

  async guardar(periodo, cuerpo) {
    const per = this.periodoValido(periodo);
    const existente = await this.buscar(per);
    if (existente && !EDITABLES.includes(existente.estado)) {
      throw new AppError(409, "El informe ya fue enviado al superadministrador y no se puede editar.", "INFORME_ENVIADO");
    }
    const data = datosEditables(cuerpo);
    if (existente) await this.repos.informes.actualizar(existente.id, data);
    else {
      const { id, copiadoDe, ...base } = await this.borradorNuevo(per);
      await this.repos.informes.crear({ ...base, ...data });
    }
    return this.obtener(per);
  }

  async enviar(periodo, usuario) {
    const per = this.periodoValido(periodo);
    const informe = await this.buscar(per);
    if (!informe) throw new AppError(400, "Guarda el informe antes de enviarlo.");
    if (!EDITABLES.includes(informe.estado)) throw new AppError(409, "Este informe ya fue enviado.", "INFORME_ENVIADO");
    const cifras = await this.cifras(per);
    const revision = revisarInforme(informe, cifras);
    if (!revision.listo) throw new AppError(400, `Completa antes de enviar: ${revision.faltantes.join(", ")}.`, "INFORME_INCOMPLETO");
    await this.repos.informes.actualizar(informe.id, {
      estado: "Enviado",
      version: informe.version + 1,
      enviadoPor: usuario.emailInstitucional,
      fechaEnvio: new Date(),
      datosEnviados: cifras,
    });
    return this.obtener(per);
  }

  // Descarga del modulo: borrador con cifras en vivo, o lo enviado.
  async descargar(periodo, formato) {
    const { informe, cifras } = await this.obtener(periodo);
    return this.archivos.generar(informe, cifras, formato);
  }
}

module.exports = { InformeService, informeService: new InformeService() };
