const { prisma } = require("../../../config/prisma");
const registro = require("./RegistroRepositories");
const informes = require("./InformeRepositories");
const salidas = require("./SalidaRepositories");
const sst = require("./SstRepositories");

// Repositorios de Salud integral para un cliente de Prisma (el normal o el
// de una transaccion: reposCon(tx)).
function reposCon(db) {
  return {
    personas: new registro.PersonaRepository(db),
    actividades: new registro.ActividadRepository(db),
    inscripcionesActividad: new registro.InscripcionActividadRepository(db),
    atenciones: new registro.AtencionRepository(db),
    evidencias: new registro.EvidenciaRepository(db),
    informes: new informes.InformeRepository(db),
    historicos: new informes.HistoricoRepository(db),
    cifras: new informes.CifrasRepository(db || prisma),
    salidas: new salidas.SalidaRepository(db),
    inscripcionesSalida: new salidas.InscripcionSalidaRepository(db),
    reportesSst: new sst.ReporteSstRepository(db),
    adjuntosSst: new sst.AdjuntoSstRepository(db),
  };
}

module.exports = { ...reposCon(), reposCon };
