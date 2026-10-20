const { prisma } = require("../../../../config/prisma");
const { hoyBogota } = require("../../../../common/utils/fechas");
const { inicioDeCita, finDeCita } = require("../utils/agenda");

// Citas de Salud integral que nadie registro: pasan a "No asistio" un dia
// despues (el personal aun puede corregirlo registrando la asistencia).
const HORAS_PARA_REGISTRAR_CITA = 24;

class CierreService {
  async citasSinRegistrar(ahora = new Date()) {
    const limite = ahora.getTime() - HORAS_PARA_REGISTRAR_CITA * 3600e3;
    const agendadas = await prisma.citaSalud.findMany({ where: { estado: "Agendada", horario: { fecha: { lte: hoyBogota() } } }, include: { horario: true } });
    const vencidas = agendadas.filter((c) => c.horario && (c.horario.horaFin ? finDeCita(c.horario) : inicioDeCita(c.horario)).getTime() <= limite);
    for (const c of vencidas) await prisma.citaSalud.update({ where: { id: c.id }, data: { estado: "NoAsistio" } });
    return vencidas.length;
  }
}

module.exports = { CierreService, cierreService: new CierreService() };
