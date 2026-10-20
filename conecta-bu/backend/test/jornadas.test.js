// Jornadas y campanas de Salud integral: el personal las publica, el
// estudiante se inscribe o cancela y la asistencia queda como participacion.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno();

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { hoyBogota } = require("../src/common/utils/fechas");
const { partirNombre } = require("../src/modules/salud/services/JornadaService");

const dia = (n) => new Date(hoyBogota().getTime() + n * 864e5).toISOString().slice(0, 10);

let salud;
beforeEach(() => {
  prisma.__reset();
  salud = crearUsuario("Salud", "salud@uniautonoma.edu.co");
});

const personal = (metodo, ruta) => request(app)[metodo](`/api/v1/salud${ruta}`).set(auth(salud.token));
const estudiante = (est, metodo, ruta) => request(app)[metodo](`/api/v1/salud/estudiante${ruta}`).set(auth(est.token));

async function jornada(extra = {}) {
  const res = await personal("post", "/actividades").send({
    nombre: "Jornada de vacunación",
    categoria: "CampanaSalud",
    fechaInicio: dia(0),
    fechaFin: dia(0),
    publicada: true,
    lugar: "Bloque A, primer piso",
    horaInicio: "08:00",
    horaFin: "12:00",
    cupos: 2,
    descripcion: "Influenza y tétanos.",
    ...extra,
  });
  if (res.status !== 201) throw new Error(res.body.message);
  return res.body.actividad;
}

describe("Jornadas y campañas para estudiantes", () => {
  test("parte el nombre de la cuenta en nombres y apellidos", () => {
    expect(partirNombre("Luisa Jhulieth Joaqui Jimenez")).toEqual({ nombres: "Luisa Jhulieth", apellidos: "Joaqui Jimenez" });
    expect(partirNombre("Ana Pérez Ruiz")).toEqual({ nombres: "Ana", apellidos: "Pérez Ruiz" });
  });

  test("el estudiante solo ve las publicadas y vigentes", async () => {
    await jornada();
    await jornada({ nombre: "Sin publicar", publicada: false });
    await jornada({ nombre: "Ya pasó", fechaInicio: dia(-5), fechaFin: dia(-4) });
    const est = crearUsuario("Estudiante", "est@uniautonoma.edu.co", "Ana Pérez Ruiz");
    const res = await estudiante(est, "get", "/jornadas");
    expect(res.status).toBe(200);
    expect(res.body.jornadas).toHaveLength(1);
    expect(res.body.jornadas[0]).toMatchObject({ nombre: "Jornada de vacunación", lugar: "Bloque A, primer piso", horaInicio: "08:00", cupos: 2, cuposDisponibles: 2, inscrito: false });
    expect(res.body.registrado).toBe(false);
  });

  test("se inscribe con su documento y autorización, respeta cupos y puede cancelar", async () => {
    const act = await jornada();
    const ana = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez Ruiz");
    expect((await estudiante(ana, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1061700123" })).status).toBe(400); // sin autorizacion
    const ok = await estudiante(ana, "post", `/jornadas/${act.id}/inscripcion`).send({ tipoDocumento: "CC", documento: "1061700123", programa: "Ingeniería Civil", consentimiento: true });
    expect(ok.status).toBe(201);
    const persona = await prisma.personaSalud.findUnique({ where: { numeroDocumento: "1061700123" } });
    expect(persona).toMatchObject({ nombres: "Ana", apellidos: "Pérez Ruiz", correo: "ana@uniautonoma.edu.co", consentimientoDatos: true });
    expect((await estudiante(ana, "post", `/jornadas/${act.id}/inscripcion`).send({})).status).toBe(409); // repetida

    const luis = crearUsuario("Estudiante", "luis@uniautonoma.edu.co", "Luis Gómez");
    expect((await estudiante(luis, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1002003004", consentimiento: true })).status).toBe(201);
    const sara = crearUsuario("Estudiante", "sara@uniautonoma.edu.co", "Sara Díaz");
    const llena = await estudiante(sara, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1002003005", consentimiento: true });
    expect(llena.status).toBe(409);

    expect((await estudiante(luis, "patch", `/jornadas/${act.id}/inscripcion/cancelar`)).status).toBe(200);
    expect((await estudiante(sara, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1002003005", consentimiento: true })).status).toBe(201);
    // Ya registrada en Salud: la siguiente vez se inscribe sin volver a escribir datos.
    const vista = await estudiante(ana, "get", "/jornadas");
    expect(vista.body).toMatchObject({ registrado: true, misDatos: { documento: "1061700123" } });
    expect(vista.body.jornadas[0]).toMatchObject({ inscrito: true, cuposDisponibles: 0 });
  });

  test("el personal marca la asistencia y queda como participación del estudiante", async () => {
    const act = await jornada();
    const ana = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez Ruiz");
    await estudiante(ana, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1061700123", consentimiento: true });
    const lista = await personal("get", `/actividades/${act.id}/inscritos`);
    expect(lista.body.inscritos).toHaveLength(1);
    expect(lista.body.inscritos[0]).toMatchObject({ asistio: false, persona: { numeroDocumento: "1061700123" } });

    const id = lista.body.inscritos[0].id;
    expect((await personal("patch", `/actividades/${act.id}/inscritos/${id}`).send({ asistio: true })).status).toBe(200);
    const part = await estudiante(ana, "get", "/mis-participaciones");
    expect(part.body.participaciones).toHaveLength(1);
    expect(part.body.participaciones[0]).toMatchObject({ actividad: "Jornada de vacunación" });
    expect((await estudiante(ana, "patch", `/jornadas/${act.id}/inscripcion/cancelar`)).status).toBe(409); // ya asistio

    await personal("patch", `/actividades/${act.id}/inscritos/${id}`).send({ asistio: false });
    expect((await estudiante(ana, "get", "/mis-participaciones")).body.participaciones).toHaveLength(0);
  });

  test("no se marca asistencia antes de la jornada, y solo el personal ve los inscritos", async () => {
    const act = await jornada({ fechaInicio: dia(3), fechaFin: dia(3) });
    const ana = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez Ruiz");
    await estudiante(ana, "post", `/jornadas/${act.id}/inscripcion`).send({ documento: "1061700123", consentimiento: true });
    const id = (await personal("get", `/actividades/${act.id}/inscritos`)).body.inscritos[0].id;
    expect((await personal("patch", `/actividades/${act.id}/inscritos/${id}`).send({ asistio: true })).status).toBe(409);
    expect((await request(app).get(`/api/v1/salud/actividades/${act.id}/inscritos`).set(auth(ana.token))).status).toBe(403);
    expect((await personal("post", "/actividades").send({ nombre: "X", horaInicio: "8am" })).status).toBe(400);
  });
});
