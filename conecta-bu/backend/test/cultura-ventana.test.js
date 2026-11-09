// El codigo de asistencia solo se abre en el horario: desde 15 minutos antes
// de la sesion hasta que termina, y sirve hasta 15 minutos despues del final.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
// Las pruebas mueven el reloj varias horas o dias: la sesion de prueba dura mas.
configurarEntorno({ JWT_EXPIRES_IN: "30d" });
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { periodoActual } = require("../src/modules/cultura/periodo");

afterEach(() => jest.restoreAllMocks());

// Fija el reloj en el proximo viernes (o hoy si es viernes) a la hora de Bogota indicada.
function viernesALas(hora, desfaseDias = 0) {
  const base = new Date(Date.now() - 5 * 3600e3);
  base.setUTCDate(base.getUTCDate() + ((5 - base.getUTCDay() + 7) % 7) + desfaseDias);
  const fecha = base.toISOString().slice(0, 10);
  const [h, m] = hora.split(":").map(Number);
  const instante = Date.parse(`${fecha}T00:00:00.000Z`) + ((h + 5) * 60 + m) * 60000;
  jest.spyOn(Date, "now").mockReturnValue(instante);
  return fecha;
}

describe("Ventana del código de asistencia", () => {
  let personal;
  let ana;
  let grupoId;

  async function preparar() {
    prisma.__reset();
    personal = crearUsuario("Administrador", "cultura.ventana@uniautonoma.edu.co", "Coordinación");
    ana = crearUsuario("Estudiante", "ana.ventana@uniautonoma.edu.co", "Ana Ventana");
    prisma.__darAcceso("cultura.ventana@uniautonoma.edu.co", "cultura");
    const area = await prisma.areaCultural.create({ data: { nombre: "Expresión corporal" } });
    const grupo = await prisma.grupoCultural.create({
      data: { areaId: area.id, periodo: periodoActual(), nombre: "Expresión corporal y oralidad", cupo: 15, horario: [{ dia: 5, inicio: "08:00", fin: "10:00" }], inscripcionesAbiertas: true, activo: true },
    });
    grupoId = grupo.id;
    await request(app).post(`/api/v1/cultura/grupos/${grupoId}/inscripcion`).set(auth(ana.token)).send({});
  }
  const abrir = () => request(app).post(`/api/v1/cultura/admin/grupos/${grupoId}/asistencia/abrir`).set(auth(personal.token));
  const marcar = (codigo) => request(app).post("/api/v1/cultura/asistencia").set(auth(ana.token)).send({ codigo });

  test("durante la sesión se abre y el código sirve hasta 15 minutos después del final", async () => {
    viernesALas("09:00");
    await preparar();
    const r = await abrir();
    expect(r.status).toBe(200);
    const vence = new Date(r.body.abiertaHasta);
    expect(vence.getUTCHours() * 60 + vence.getUTCMinutes()).toBe((10 + 5) * 60 + 15); // 10:15 en Bogota
    expect((await marcar(r.body.codigo)).status).toBe(201);
  });

  test("se puede abrir desde 15 minutos antes de empezar, no antes", async () => {
    viernesALas("07:40");
    await preparar();
    const temprano = await abrir();
    expect(temprano.status).toBe(409);
    expect(temprano.body.message).toBe("La sesión de hoy empieza a las 08:00. Podrás abrir el código desde las 07:45.");
    viernesALas("07:45");
    expect((await abrir()).status).toBe(200);
  });

  test("cuando la sesión ya terminó no se abre y pide marcar a mano", async () => {
    viernesALas("10:58");
    await preparar();
    const tarde = await abrir();
    expect(tarde.status).toBe(409);
    expect(tarde.body.message).toBe("La sesión de hoy terminó a las 10:00. Si alguien asistió, márcalo a mano en la lista.");
  });

  test("un día sin sesión no se abre y dice el horario del grupo", async () => {
    viernesALas("09:00", 1); // sabado
    await preparar();
    const r = await abrir();
    expect(r.status).toBe(409);
    expect(r.body.message).toBe("Expresión corporal y oralidad no tiene sesión hoy. Su horario: viernes 08:00–10:00.");
  });

  test("el código vence a la hora calculada aunque nadie lo cierre", async () => {
    viernesALas("09:50");
    await preparar();
    const { body } = await abrir();
    viernesALas("10:16");
    const vencido = await marcar(body.codigo);
    expect(vencido.status).toBe(409);
    expect(vencido.body.message).toBe("El registro de asistencia de esta sesión ya se cerró.");
  });

  test("un evento solo se abre el día y en la hora del evento", async () => {
    const fecha = viernesALas("15:00");
    await preparar();
    const ev = await request(app)
      .post("/api/v1/cultura/admin/agenda")
      .set(auth(personal.token))
      .send({ nombre: "Global Fest", fecha, fechaLimite: fecha, horaInicio: "18:00", horaFin: "21:00", cupo: 50, estado: "Publicado" });
    expect(ev.status).toBe(201);
    const abrirEvento = () => request(app).post(`/api/v1/cultura/admin/agenda/${ev.body.id}/asistencia/abrir`).set(auth(personal.token));
    expect((await abrirEvento()).body.message).toBe("La sesión de hoy empieza a las 18:00. Podrás abrir el código desde las 17:45.");
    viernesALas("19:00");
    expect((await abrirEvento()).status).toBe(200);
    viernesALas("19:00", 1);
    expect((await abrirEvento()).body.message).toBe(`El registro de asistencia se abre el día del evento (${fecha}).`);
  });
});
