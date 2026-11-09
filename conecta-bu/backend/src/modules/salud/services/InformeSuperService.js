const { AppError } = require("../../../common/utils/AppError");
const repos = require("../repositories");
const { ESTADOS, texto, serializar } = require("../utils/informe/edicion");
const { informeService } = require("./InformeService");
const { informeArchivoService } = require("./InformeArchivoService");
const notificaciones = require("../../notificaciones/service");

// Informes de gestion que Salud integral envia al superadministrador: los
// lista, los descarga (siempre lo que se envio) y los aprueba o devuelve.
class InformeSuperService {
  constructor(r = repos) {
    this.repos = r;
  }

  async recibidos({ estado } = {}) {
    const where = { estado: { in: ["Enviado", "Devuelto", "Aprobado"] } };
    if (estado && ESTADOS[estado] && estado !== "Borrador") where.estado = estado;
    const informes = await this.repos.informes.recibidos(where);
    return informes.map((i) => {
      const k = i.datosEnviados?.kpis;
      const indicadores =
        i.modulo === "cultura"
          ? require("../../cultura/informe/cifras").indicadoresDe(i.datosEnviados)
          : k
            ? [
                { titulo: "Atenciones", valor: k.atenciones },
                { titulo: "Personas atendidas", valor: k.personas },
                { titulo: "Actividades", valor: k.actividades },
                { titulo: "Cumplimiento de metas", valor: k.cumplimientoPromedio === null || k.cumplimientoPromedio === undefined ? null : `${k.cumplimientoPromedio} %` },
              ]
            : null;
      return { ...serializar(i), indicadores, resumen: i.datosEnviados ? { atenciones: k?.atenciones, personas: k?.personas, actividades: k?.actividades, cumplimientoPromedio: k?.cumplimientoPromedio } : null };
    });
  }

  async obtener(id) {
    const informe = await this.repos.informes.buscarPorId(id);
    if (!informe || informe.estado === "Borrador") throw new AppError(404, "El informe no existe o aún no fue enviado.");
    return informe;
  }

  async revisar(id, { estado, observacion } = {}, usuario) {
    const informe = await this.obtener(id);
    if (!["Aprobado", "Devuelto"].includes(estado)) throw new AppError(400, "Elige aprobar o devolver el informe.");
    if (informe.estado !== "Enviado") throw new AppError(409, "Solo se revisan informes en estado Enviado.");
    if (estado === "Devuelto" && !texto(observacion)) throw new AppError(400, "Escribe qué debe corregir el módulo.");
    await this.repos.informes.actualizar(id, { estado, observacionRevision: texto(observacion, 3000), revisadoPor: usuario.emailInstitucional, fechaRevision: new Date() });
    const revisado = serializar(await this.repos.informes.buscarPorId(id));
    await notificaciones.avisarAlPersonal(informe.modulo, {
      modulo: informe.modulo,
      tipo: "informe",
      titulo: estado === "Aprobado" ? "Informe de gestión aprobado" : "Informe de gestión devuelto",
      mensaje: estado === "Aprobado" ? `El superadministrador aprobó el informe de gestión ${informe.periodo}.` : `El superadministrador devolvió el informe de gestión ${informe.periodo}: ${texto(observacion, 300)}`,
      ruta: informe.modulo === "cultura" ? "/cultura/informes" : "/salud/informe",
    });
    return revisado;
  }

  async descargar(id, formato) {
    const informe = await this.obtener(id);
    if (informe.modulo === "cultura") {
      const { armarCifras } = require("../../cultura/informe/cifras");
      return require("../../cultura/informe/servicio").archivoDe(informe, informe.datosEnviados || (await armarCifras(informe.periodo)), formato);
    }
    const cifras = informe.datosEnviados || (await informeService.cifras(informe.periodo));
    return informeArchivoService.generar(serializar(informe), cifras, formato);
  }
}

module.exports = { InformeSuperService, informeSuperService: new InformeSuperService() };
