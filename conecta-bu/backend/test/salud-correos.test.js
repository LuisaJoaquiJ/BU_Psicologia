// RF-013 en Salud: avisos por correo (via n8n) al inscribirse o cancelar en
// jornadas y salidas academicas, y cuando Salud aprueba o rechaza una salida.
const os = require("os");
const fs = require("fs");
const path = require("path");
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
jest.mock("../src/integrations/n8n.client", () => ({ ...jest.requireActual("../src/integrations/n8n.client"), notificar: jest.fn() }));
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cbu-salud-correos-"));
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
configurarEntorno({ SALUD_UPLOADS_DIR: carpeta });

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { notificar } = require("../src/integrations/n8n.client");
const { hoyBogota } = require("../src/common/utils/fechas");

afterAll(() => fs.rmSync(carpeta, { recursive: true, force: true }));

const dia = (n) => new Date(hoyBogota().getTime() + n * 864e5).toISOString().slice(0, 10);
const PDF = Buffer.from("%PDF-1.4\n%%EOF");
const DATOS_SALIDA = { tipoDocumento: "CC", documento: "1061700123", programa: "Ingeniería Civil", celular: "3104567890", eps: "Nueva EPS", consentimiento: "true" };

let salud;
let ana;
beforeEach(() => {
  prisma.__reset();
  notificar.mockClear();
  salud = crearUsuario("Salud", "salud@uniautonoma.edu.co");
  ana = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez Ruiz");
});

const comoPersonal = (metodo, ruta) => request(app)[metodo](`/api/v1/salud${ruta}`).set(auth(salud.token));
const comoAna = (metodo, ruta) => request(app)[metodo](`/api/v1/salud/estudiante${ruta}`).set(auth(ana.token));
const avisos = () => notificar.mock.calls.map(([tipo, datos]) => ({ tipo, datos }));

describe("Correos de jornadas y campañas", () => {
  test("avisa al inscribirse y al cancelar, con la fecha, la hora y Salud Integral", async () => {
    const creada = await comoPersonal("post", "/actividades").send({
      nombre: "Jornada de vacunación",
      categoria: "CampanaSalud",
      fechaInicio: dia(1),
      fechaFin: dia(1),
      publicada: true,
      lugar: "Coliseo",
      horaInicio: "08:00",
      horaFin: "12:00",
      cupos: 10,
    });
    const id = creada.body.actividad.id;

    expect((await comoAna("post", `/jornadas/${id}/inscripcion`).send({ documento: "1061700123", consentimiento: true })).status).toBe(201);
    expect(avisos()).toEqual([
      {
        tipo: "evento.inscripcion",
        datos: {
          estudiante: expect.objectContaining({ nombre: "Ana Pérez Ruiz", email: "ana@uniautonoma.edu.co" }),
          evento: expect.objectContaining({ nombre: "Jornada de vacunación", lugar: "Coliseo", horaInicio: "1970-01-01T08:00:00.000Z", modulo: "Salud Integral" }),
        },
      },
    ]);

    expect((await comoAna("patch", `/jornadas/${id}/inscripcion/cancelar`)).status).toBe(200);
    expect(avisos()[1]).toMatchObject({ tipo: "evento.inscripcion_cancelada", datos: { evento: { nombre: "Jornada de vacunación" } } });
  });

  test("si la inscripción falla no se envía correo", async () => {
    const creada = await comoPersonal("post", "/actividades").send({ nombre: "Tamizaje", categoria: "CampanaSalud", fechaInicio: dia(1), fechaFin: dia(1), publicada: true, cupos: 5 });
    expect((await comoAna("post", `/jornadas/${creada.body.actividad.id}/inscripcion`).send({ documento: "1061700123" })).status).toBe(400); // sin autorizacion
    expect(notificar).not.toHaveBeenCalled();
  });
});

describe("Correos de salidas académicas", () => {
  async function salida() {
    const res = await comoPersonal("post", "/salidas-inscripcion").send({
      nombre: "Visita técnica Medellín",
      destino: "Medellín, Antioquia",
      fechaSalida: dia(20),
      fechaRegreso: dia(22),
      horaSalida: "05:00",
      lugarEncuentro: "Portería principal",
      cupos: 5,
      pideComprobante: true,
      fechaLimiteInscripcion: dia(10),
      estado: "Publicada",
    });
    expect(res.status).toBe(201);
    return res.body.salida;
  }
  function inscribir(id) {
    let r = comoAna("post", `/salidas/${id}/inscripcion`);
    for (const [k, v] of Object.entries(DATOS_SALIDA)) r = r.field(k, v);
    return r.attach("comprobante", PDF, { filename: "pago.pdf", contentType: "application/pdf" });
  }

  test("avisa que recibió la inscripción, luego si quedó aprobada, y al cancelar", async () => {
    const s = await salida();
    expect((await inscribir(s.id)).status).toBe(201);
    expect(avisos()[0]).toMatchObject({
      tipo: "salida.inscripcion",
      datos: { estudiante: { email: "ana@uniautonoma.edu.co" }, salida: { nombre: "Visita técnica Medellín", destino: "Medellín, Antioquia", horaSalida: "1970-01-01T05:00:00.000Z" } },
    });

    const { inscripciones } = (await comoPersonal("get", `/salidas-inscripcion/${s.id}/inscripciones`)).body;
    expect((await comoPersonal("patch", `/salidas-inscripcion/${s.id}/inscripciones/${inscripciones[0].id}`).send({ estado: "Aprobada" })).status).toBe(200);
    expect(avisos()[1]).toMatchObject({
      tipo: "salida.revisada",
      datos: { estudiante: { nombre: "Ana Pérez Ruiz", email: "ana@uniautonoma.edu.co" }, salida: { lugarEncuentro: "Portería principal" }, revision: { estado: "Aprobada" } },
    });

    // Volver a guardar la misma decision no repite el correo.
    await comoPersonal("patch", `/salidas-inscripcion/${s.id}/inscripciones/${inscripciones[0].id}`).send({ estado: "Aprobada" });
    expect(avisos()).toHaveLength(2);

    expect((await comoAna("patch", `/salidas/${s.id}/inscripcion/cancelar`)).status).toBe(200);
    expect(avisos()[2]).toMatchObject({ tipo: "salida.inscripcion_cancelada", datos: { salida: { nombre: "Visita técnica Medellín" } } });
  });

  test("el rechazo va al estudiante con el motivo, no al personal que revisa", async () => {
    const s = await salida();
    await inscribir(s.id);
    const { inscripciones } = (await comoPersonal("get", `/salidas-inscripcion/${s.id}/inscripciones`)).body;
    await comoPersonal("patch", `/salidas-inscripcion/${s.id}/inscripciones/${inscripciones[0].id}`).send({ estado: "Rechazada", observacion: "El comprobante no es legible" });
    const revisada = avisos().find((a) => a.tipo === "salida.revisada");
    expect(revisada.datos.estudiante.email).toBe("ana@uniautonoma.edu.co");
    expect(revisada.datos.revision).toEqual({ estado: "Rechazada", observacion: "El comprobante no es legible" });
  });
});
