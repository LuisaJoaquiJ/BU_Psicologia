const { prisma } = require("../../../config/prisma");
const { hoyBogota } = require("../../../common/utils/fechas");
const { inicioDeCita, finDeCita } = require("../utils/agenda");

// Cierres automaticos de Desarrollo Humano (los corre el servidor cada pocos
// minutos): los eventos publicados se cierran al terminar su hora, y las
// citas que nadie registro pasan a "No asistio" un dia despues.
const HORAS_PARA_REGISTRAR_CITA = 24;

class CierreService {
  async cerrarEventosTerminados(ahora = new Date()) {
    const candidatos = await prisma.evento.findMany({ where: { estado: "Publicado", fecha: { lte: hoyBogota() } } });
    const terminados = candidatos.filter((e) => finDeCita(e) <= ahora);
    for (const e of terminados) await prisma.evento.update({ where: { id: e.id }, data: { estado: "Cerrado" } });
    return terminados.length;
  }

  async citasSinRegistrar(ahora = new Date()) {
    const limite = ahora.getTime() - HORAS_PARA_REGISTRAR_CITA * 3600e3;
    const agendadas = await prisma.citaDesarrollo.findMany({ where: { estado: "Agendada", horario: { fecha: { lte: hoyBogota() } } }, include: { horario: true } });
    const vencidas = agendadas.filter((c) => c.horario && (c.horario.horaFin ? finDeCita(c.horario) : inicioDeCita(c.horario)).getTime() <= limite);
    for (const c of vencidas) await prisma.citaDesarrollo.update({ where: { id: c.id }, data: { estado: "NoAsistio" } });
    return vencidas.length;
  }
}

module.exports = { CierreService, cierreService: new CierreService(), HORAS_PARA_REGISTRAR_CITA };
