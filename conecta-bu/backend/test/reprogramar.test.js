// El personal reprograma una cita agendada que aun no empieza, al mismo
// horario libre que veria el estudiante, del mismo servicio.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario } = require("./helpers");
configurarEntorno();

const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");
const { agendaService } = require("../src/modules/desarrollo-humano/services/AgendaService");

const dia = (n) => new Date(hoyBogota().getTime() + n * 864e5);
const hora = (h, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));

beforeEach(() => prisma.__reset());

describe("Reprogramar una cita", () => {
  test("la mueve a un horario libre del mismo servicio y libera el anterior", async () => {
    const { usuario } = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const admin = crearUsuario("Administrador", "psico@uniautonoma.edu.co");
    const actual = prisma.__seedHorario({ fecha: dia(2), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const libre = prisma.__seedHorario({ fecha: dia(3), horaInicio: hora(15), horaFin: hora(16), ocupado: false });
    const cita = await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: actual.id, estado: "Agendada" } });

    const movida = await agendaService.reprogramar(admin.usuario.id, cita.id, libre.id);
    expect(movida.horarioId).toBe(libre.id);
    expect(movida.estado).toBe("Agendada");
    expect((await prisma.horarioDesarrollo.findUnique({ where: { id: actual.id } })).ocupado).toBe(false);
    expect((await prisma.horarioDesarrollo.findUnique({ where: { id: libre.id } })).ocupado).toBe(true);
    const historial = await prisma.historialEstado.findMany({ where: { citaId: cita.id } });
    expect(historial).toEqual([expect.objectContaining({ estadoAnterior: "Agendada", estadoNuevo: "Reprogramada", usuarioId: admin.usuario.id })]);
  });

  test("no reprograma una cita que ya empezó, ni una que no sigue agendada, ni un horario de otro servicio u ocupado", async () => {
    const { usuario } = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const admin = crearUsuario("Administrador", "psico@uniautonoma.edu.co");
    const pasada = prisma.__seedHorario({ fecha: dia(-1), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const citaPasada = await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: pasada.id, estado: "Agendada" } });
    const libre = prisma.__seedHorario({ fecha: dia(3), horaInicio: hora(15), horaFin: hora(16) });
    await expect(agendaService.reprogramar(admin.usuario.id, citaPasada.id, libre.id)).rejects.toThrow(/ya empezó/);

    const futura = prisma.__seedHorario({ fecha: dia(2), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const atendida = await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: futura.id, estado: "Atendida" } });
    await expect(agendaService.reprogramar(admin.usuario.id, atendida.id, libre.id)).rejects.toThrow(/agendada/);

    const agendada = await prisma.citaDesarrollo.create({
      data: { usuarioId: usuario.id, horarioId: prisma.__seedHorario({ fecha: dia(4), horaInicio: hora(9), horaFin: hora(10), ocupado: true }).id, estado: "Agendada" },
    });
    const otroServicio = prisma.__seedServicio({ nombre: "Otro servicio" });
    const deOtro = prisma.__seedHorario({ fecha: dia(5), horaInicio: hora(9), horaFin: hora(10), servicioId: otroServicio.id });
    await expect(agendaService.reprogramar(admin.usuario.id, agendada.id, deOtro.id)).rejects.toThrow(/mismo servicio/);

    const ocupado = prisma.__seedHorario({ fecha: dia(5), horaInicio: hora(11), horaFin: hora(12), ocupado: true });
    await expect(agendaService.reprogramar(admin.usuario.id, agendada.id, ocupado.id)).rejects.toThrow(/no está disponible/);
    expect((await prisma.citaDesarrollo.findUnique({ where: { id: agendada.id } })).horarioId).not.toBe(ocupado.id);
  });
});
