// Cierres automaticos: los estados que cambian solos con el tiempo (eventos
// terminados, salidas vencidas y citas que nadie registro).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario } = require("./helpers");
configurarEntorno();

const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");
const { ejecutarCierres } = require("../src/common/jobs/cierresAutomaticos");
const { agendaService } = require("../src/modules/desarrollo-humano/services/AgendaService");

const dia = (n) => new Date(hoyBogota().getTime() + n * 864e5);
const hora = (h, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
// "Ahora" fijo: hoy a las 3:00 p. m. de Bogota (20:00 UTC).
const ahora = new Date(hoyBogota().getTime() + 20 * 3600e3);

beforeEach(() => prisma.__reset());

describe("Cierres automáticos", () => {
  test("Desarrollo Humano: cierra los eventos publicados que ya terminaron", async () => {
    const base = { nombre: "Taller", lugar: "Aula 1", cupo: 20, fechaLimiteInscripcion: dia(-1), estado: "Publicado" };
    const manana = await prisma.evento.create({ data: { ...base, fecha: dia(0), horaInicio: hora(8), horaFin: hora(10) } });
    const tarde = await prisma.evento.create({ data: { ...base, fecha: dia(0), horaInicio: hora(16), horaFin: hora(18) } });
    const ayer = await prisma.evento.create({ data: { ...base, fecha: dia(-1), horaInicio: hora(8), horaFin: hora(10) } });
    const borrador = await prisma.evento.create({ data: { ...base, estado: "Borrador", fecha: dia(-1), horaInicio: hora(8), horaFin: hora(10) } });

    const r = await ejecutarCierres(ahora);
    expect(r.eventosDesarrollo).toBe(2);
    const estado = async (e) => (await prisma.evento.findUnique({ where: { id: e.id } })).estado;
    expect(await estado(manana)).toBe("Cerrado");
    expect(await estado(ayer)).toBe("Cerrado");
    expect(await estado(tarde)).toBe("Publicado"); // aun no termina
    expect(await estado(borrador)).toBe("Borrador");
  });

  test("Deporte: finaliza los eventos publicados que ya terminaron", async () => {
    const base = { nombre: "Torneo", tipo: "Torneo", estado: "Publicado" };
    const terminado = await prisma.eventoDeporte.create({ data: { ...base, fecha: dia(0), horaInicio: "08:00", horaFin: "12:00" } });
    const pendiente = await prisma.eventoDeporte.create({ data: { ...base, fecha: dia(1), horaInicio: "08:00", horaFin: "12:00" } });
    expect((await ejecutarCierres(ahora)).eventosDeporte).toBe(1);
    expect((await prisma.eventoDeporte.findUnique({ where: { id: terminado.id } })).estado).toBe("Finalizado");
    expect((await prisma.eventoDeporte.findUnique({ where: { id: pendiente.id } })).estado).toBe("Publicado");
  });

  test("Salud: cierra las salidas publicadas cuya fecha límite ya pasó", async () => {
    const base = { nombre: "Visita", destino: "Popayán", fechaSalida: dia(5), fechaRegreso: dia(5), cupos: 10 };
    const vencida = await prisma.salidaConvocatoria.create({ data: { ...base, estado: "Publicada", fechaLimiteInscripcion: dia(-1) } });
    const hoy = await prisma.salidaConvocatoria.create({ data: { ...base, estado: "Publicada", fechaLimiteInscripcion: dia(0) } });
    expect((await ejecutarCierres(ahora)).salidasSalud).toBe(1);
    expect((await prisma.salidaConvocatoria.findUnique({ where: { id: vencida.id } })).estado).toBe("Cerrada");
    expect((await prisma.salidaConvocatoria.findUnique({ where: { id: hoy.id } })).estado).toBe("Publicada"); // cierra al terminar el dia
  });

  test("las citas que nadie registró pasan a No asistió un día después, y el personal aún puede corregirlas", async () => {
    const { usuario } = crearUsuario("Estudiante", "est@uniautonoma.edu.co");
    const admin = crearUsuario("Administrador", "psico@uniautonoma.edu.co");
    const vieja = prisma.__seedHorario({ fecha: dia(-2), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const reciente = prisma.__seedHorario({ fecha: dia(0), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    const c1 = await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: vieja.id, estado: "Agendada" } });
    const c2 = await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: reciente.id, estado: "Agendada" } });

    expect((await ejecutarCierres(ahora)).citasDesarrollo).toBe(1);
    expect((await prisma.citaDesarrollo.findUnique({ where: { id: c1.id } })).estado).toBe("NoAsistio");
    expect((await prisma.citaDesarrollo.findUnique({ where: { id: c2.id } })).estado).toBe("Agendada"); // aun dentro de las 24 h

    // El personal registra tarde que si vino: corrige el cierre automatico.
    const corregida = await agendaService.registrarAsistencia(admin.usuario.id, c1.id, true);
    expect(corregida.estado).toBe("Atendida");
    await expect(agendaService.registrarAsistencia(admin.usuario.id, c1.id, false)).rejects.toThrow();
  });
});
