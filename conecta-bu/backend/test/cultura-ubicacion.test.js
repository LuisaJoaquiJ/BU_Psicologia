// Asistencia por ubicacion: el estudiante marca desde el sitio, dentro del horario.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ JWT_EXPIRES_IN: "30d" });
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { periodoActual } = require("../src/modules/cultura/periodo");
const { distanciaMetros } = require("../src/modules/cultura/asistencia");

afterEach(() => jest.restoreAllMocks());

// Fija el reloj en el proximo viernes (o hoy si es viernes) a la hora de Bogota indicada.
function viernesALas(hora) {
  const base = new Date(Date.now() - 5 * 3600e3);
  base.setUTCDate(base.getUTCDate() + ((5 - base.getUTCDay() + 7) % 7));
  const fecha = base.toISOString().slice(0, 10);
  const [h, m] = hora.split(":").map(Number);
  jest.spyOn(Date, "now").mockReturnValue(Date.parse(`${fecha}T00:00:00.000Z`) + ((h + 5) * 60 + m) * 60000);
  return fecha;
}

// Sitio de la sesion (Popayan) y un punto a ~0,0009 grados (unos 100 m) de distancia.
const SITIO = { latitud: 2.4448, longitud: -76.6147 };
const aMetros = (norte) => ({ latitud: SITIO.latitud + norte / 111320, longitud: SITIO.longitud });

describe("Asistencia por ubicación", () => {
  let personal;
  let ana;
  let grupoId;

  async function preparar() {
    prisma.__reset();
    personal = crearUsuario("Administrador", "cultura.ubicacion@uniautonoma.edu.co", "Coordinación");
    ana = crearUsuario("Estudiante", "ana.ubicacion@uniautonoma.edu.co", "Ana Ubicación");
    prisma.__darAcceso("cultura.ubicacion@uniautonoma.edu.co", "cultura");
    const area = await prisma.areaCultural.create({ data: { nombre: "Guitarra" } });
    const grupo = await prisma.grupoCultural.create({
      data: { areaId: area.id, periodo: periodoActual(), nombre: "Taller de guitarra", cupo: 15, horario: [{ dia: 5, inicio: "08:00", fin: "10:00" }], inscripcionesAbiertas: true, activo: true },
    });
    grupoId = grupo.id;
    await request(app).post(`/api/v1/cultura/grupos/${grupoId}/inscripcion`).set(auth(ana.token)).send({});
  }
  const guardarSitio = (cuerpo) => request(app).put(`/api/v1/cultura/admin/grupos/${grupoId}/ubicacion`).set(auth(personal.token)).send(cuerpo);
  const marcar = (cuerpo) => request(app).post("/api/v1/cultura/asistencia/ubicacion").set(auth(ana.token)).send(cuerpo);

  test("la distancia entre dos puntos se calcula en metros", () => {
    expect(Math.round(distanciaMetros(SITIO.latitud, SITIO.longitud, SITIO.latitud + 100 / 111320, SITIO.longitud))).toBe(100);
  });

  test("el personal guarda el sitio con un radio válido", async () => {
    viernesALas("09:00");
    await preparar();
    expect((await guardarSitio({ ...SITIO, radioM: 100 })).body).toMatchObject({ ...SITIO, radioM: 100 });
    expect((await guardarSitio({ ...SITIO, radioM: 77 })).status).toBe(400);
    expect((await guardarSitio({ latitud: 123, longitud: 0 })).status).toBe(400);
  });

  test("marca dentro del radio y no se puede marcar dos veces", async () => {
    viernesALas("09:00");
    await preparar();
    await guardarSitio({ ...SITIO, radioM: 100 });
    const r = await marcar({ ...aMetros(40), precision: 12 });
    expect(r.status).toBe(201);
    expect(r.body.actividad).toBe("Taller de guitarra");
    const asistencia = (await prisma.asistenciaCultural.findMany({}))[0];
    expect(asistencia).toMatchObject({ origen: "Ubicacion", distanciaM: 40 });
    expect((await marcar({ ...aMetros(40), precision: 12 })).status).toBe(409);
  });

  test("lejos del sitio dice a cuántos metros está", async () => {
    viernesALas("09:00");
    await preparar();
    await guardarSitio({ ...SITIO, radioM: 100 });
    const r = await marcar({ ...aMetros(500), precision: 10 });
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/^Estás a (499|500) m de Taller de guitarra. Para marcar debes estar a menos de 100 m del sitio.$/);
  });

  test("una lectura muy imprecisa no sirve", async () => {
    viernesALas("09:00");
    await preparar();
    await guardarSitio({ ...SITIO, radioM: 100 });
    const r = await marcar({ ...SITIO, precision: 400 });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("muy imprecisa");
  });

  test("fuera del horario no hay sesión abierta", async () => {
    viernesALas("12:00");
    await preparar();
    await guardarSitio({ ...SITIO, radioM: 100 });
    const r = await marcar({ ...SITIO, precision: 10 });
    expect(r.status).toBe(409);
    expect(r.body.message).toBe("Ahora no tienes una sesión ni un evento abierto para marcar asistencia.");
  });

  test("un evento se publica con su ubicación marcada en el mapa", async () => {
    viernesALas("09:00");
    await preparar();
    const fecha = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const base = { nombre: "Muestra de teatro", fecha, fechaLimite: fecha, horaInicio: "08:00", horaFin: "12:00", cupo: 30, estado: "Publicado" };
    const crear = (extra) => request(app).post("/api/v1/cultura/admin/agenda").set(auth(personal.token)).send({ ...base, ...extra });
    const ok = await crear({ ...SITIO, radioM: 150 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ ...SITIO, radioM: 150 });
    expect((await crear({ latitud: 999, longitud: 0 })).status).toBe(400);
    expect((await crear({ ...SITIO, radioM: 77 })).status).toBe(400);
    expect((await crear({})).body.latitud ?? null).toBe(null); // sin mapa sigue valiendo
  });

  test("desde la tarjeta de un evento se marca ese evento y queda como asistió", async () => {
    viernesALas("09:00");
    await preparar();
    const fecha = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const evento = (await request(app).post("/api/v1/cultura/admin/agenda").set(auth(personal.token)).send({ nombre: "Muestra", fecha, fechaLimite: fecha, horaInicio: "08:30", horaFin: "12:00", cupo: 30, estado: "Publicado", ...SITIO, radioM: 100 })).body;
    await request(app).post(`/api/v1/cultura/agenda/${evento.id}/inscripcion`).set(auth(ana.token)).send({});
    const lejos = await marcar({ ...aMetros(500), precision: 10, eventoId: evento.id });
    expect(lejos.status).toBe(409);
    expect(lejos.body.message).toContain("Muestra");
    expect((await marcar({ ...aMetros(30), precision: 10, eventoId: evento.id })).status).toBe(201);
    const agenda = await request(app).get("/api/v1/cultura/agenda").set(auth(ana.token));
    expect(agenda.body.find((e) => e.id === evento.id)).toMatchObject({ inscrito: true, asistio: true });
    expect((await marcar({ ...SITIO, precision: 10, eventoId: "otro" })).status).toBe(409);
  });

  test("lo que ya terminó pasa al historial de quien se inscribió; para los demás, sale de la agenda", async () => {
    const fecha = viernesALas("15:00");
    await preparar();
    const crear = async (nombre, horaInicio, horaFin) => (await request(app).post("/api/v1/cultura/admin/agenda").set(auth(personal.token)).send({ nombre, fecha, fechaLimite: fecha, horaInicio, horaFin, cupo: 30, estado: "Publicado" })).body;
    const yaPaso = await crear("Ya pasó", "08:00", "10:00");
    await crear("Pasó sin ti", "09:00", "11:00");
    await crear("Recién terminó", "14:00", "14:50"); // a las 15:00 aún está en el margen de 15 minutos
    await crear("Más tarde", "16:00", "18:00");
    await request(app).post(`/api/v1/cultura/agenda/${yaPaso.id}/inscripcion`).set(auth(ana.token)).send({});

    const lista = (await request(app).get("/api/v1/cultura/agenda").set(auth(ana.token))).body;
    const porNombre = Object.fromEntries(lista.map((e) => [e.nombre, e]));
    expect(Object.keys(porNombre).sort()).toEqual(["Recién terminó", "Más tarde", "Ya pasó"].sort());
    expect(porNombre["Ya pasó"]).toMatchObject({ terminado: true, inscrito: true });
    expect(porNombre["Recién terminó"].terminado).toBe(false);
    expect(porNombre["Más tarde"].terminado).toBe(false);
    expect(porNombre["Pasó sin ti"]).toBeUndefined();
  });

  test("si el área no marcó el sitio, avisa", async () => {
    viernesALas("09:00");
    await preparar();
    const r = await marcar({ ...SITIO, precision: 10 });
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("no marcó la ubicación");
  });
});
