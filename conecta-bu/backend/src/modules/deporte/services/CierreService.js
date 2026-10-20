const { prisma } = require("../../../config/prisma");
const { hoyBogota } = require("../../../common/utils/fechas");
const { instanteBogota } = require("../utils/ventana");

// Cierre automatico de Deporte: los eventos publicados pasan a "Finalizado"
// al terminar su hora (la asistencia solo se toma mientras transcurren).
class CierreService {
  async finalizarEventosTerminados(ahora = new Date()) {
    const candidatos = await prisma.eventoDeporte.findMany({ where: { estado: "Publicado", fecha: { lte: hoyBogota() } } });
    const terminados = candidatos.filter((e) => instanteBogota(e.fecha, e.horaFin || "23:59") <= ahora);
    for (const e of terminados) await prisma.eventoDeporte.update({ where: { id: e.id }, data: { estado: "Finalizado" } });
    return terminados.length;
  }
}

module.exports = { CierreService, cierreService: new CierreService() };
