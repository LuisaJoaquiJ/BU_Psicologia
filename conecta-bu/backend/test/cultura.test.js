jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { configurarEntorno, crearUsuario, auth } = require("./helpers");
const { hoyBogota } = require("../src/common/utils/fechas");
const { periodoActual } = require("../src/modules/cultura/periodo");

configurarEntorno();

function dentroDe(dias) {
  const base = hoyBogota();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dias)).toISOString().slice(0, 10);
}

describe("Arte y Cultura", () => {
  let ana;
  let luis;
  let personal;

  beforeEach(async () => {
    prisma.__reset();
    ana = crearUsuario("Estudiante", "ana.cultura@uniautonoma.edu.co", "Ana Cultura");
    luis = crearUsuario("Estudiante", "luis.cultura@uniautonoma.edu.co", "Luis Cultura");
    personal = crearUsuario("Administrador", "cultura@uniautonoma.edu.co", "Personal Cultura");
    await prisma.usuario.update({ where: { id: personal.usuario.id }, data: {} });
    prisma.__darAcceso("cultura@uniautonoma.edu.co", "cultura");
  });

  function api(token) {
    return {
      get: (ruta) => request(app).get(ruta).set(auth(token)),
      post: (ruta, cuerpo) => request(app).post(ruta).set(auth(token)).send(cuerpo),
      patch: (ruta, cuerpo) => request(app).patch(ruta).set(auth(token)).send(cuerpo),
      del: (ruta) => request(app).delete(ruta).set(auth(token)),
    };
  }

  async function grupo(extra = {}) {
    const area = await prisma.areaCultural.create({ data: { nombre: extra.area || `Danza ${Date.now()}${Math.random()}` } });
    return prisma.grupoCultural.create({
      data: {
        areaId: area.id,
        periodo: periodoActual(),
        nombre: extra.nombre || "Danza folclórica",
        director: "Marta",
        lugar: "Salón de danza",
        cupo: extra.cupo || 10,
        horario: extra.horario || [{ dia: 2, inicio: "14:00", fin: "16:00" }],
        inscripcionesAbiertas: extra.inscripcionesAbiertas !== false,
        activo: true,
      },
    });
  }

  test("el estudiante se inscribe, no repite y se retira", async () => {
    const creado = await grupo();
    const http = api(ana.token);
    const alta = await http.post(`/api/v1/cultura/grupos/${creado.id}/inscripcion`);
    expect(alta.status).toBe(200);
    expect(alta.body.inscritas).toBe(1);
    expect(alta.body.areas[0].grupos[0].inscrito).toBe(true);

    const repetida = await http.post(`/api/v1/cultura/grupos/${creado.id}/inscripcion`);
    expect(repetida.status).toBe(409);

    const baja = await http.del(`/api/v1/cultura/grupos/${creado.id}/inscripcion`);
    expect(baja.status).toBe(200);
    expect(baja.body.inscritas).toBe(0);
  });

  test("no hay cupo ni horario cruzado", async () => {
    const lleno = await grupo({ nombre: "Teatro", cupo: 1, horario: [{ dia: 3, inicio: "10:00", fin: "12:00" }] });
    expect((await api(ana.token).post(`/api/v1/cultura/grupos/${lleno.id}/inscripcion`)).status).toBe(200);
    const sinCupo = await api(luis.token).post(`/api/v1/cultura/grupos/${lleno.id}/inscripcion`);
    expect(sinCupo.status).toBe(409);

    const base = await grupo({ nombre: "Coro", horario: [{ dia: 4, inicio: "15:00", fin: "17:00" }] });
    const cruce = await grupo({ nombre: "Ensamble", horario: [{ dia: 4, inicio: "16:00", fin: "18:00" }] });
    expect((await api(luis.token).post(`/api/v1/cultura/grupos/${base.id}/inscripcion`)).status).toBe(200);
    const cruzado = await api(luis.token).post(`/api/v1/cultura/grupos/${cruce.id}/inscripcion`);
    expect(cruzado.status).toBe(409);
  });

  test("la agenda respeta cupo y fecha límite", async () => {
    const evento = await prisma.eventoCultural.create({
      data: {
        nombre: "Muestra de danza",
        fecha: new Date(`${dentroDe(10)}T00:00:00.000Z`),
        horaInicio: "18:00",
        horaFin: "20:00",
        lugar: "Auditorio",
        cupo: 1,
        fechaLimite: new Date(`${dentroDe(5)}T00:00:00.000Z`),
        estado: "Publicado",
      },
    });
    expect((await api(ana.token).post(`/api/v1/cultura/agenda/${evento.id}/inscripcion`)).status).toBe(200);
    expect((await api(luis.token).post(`/api/v1/cultura/agenda/${evento.id}/inscripcion`)).status).toBe(409);
  });

  test("la convocatoria se postula y el personal la acepta", async () => {
    const convocatoria = await prisma.convocatoriaCultural.create({
      data: { titulo: "Coro institucional", cierra: new Date(`${dentroDe(15)}T00:00:00.000Z`), estado: "Abierta" },
    });
    const corta = await api(ana.token).post(`/api/v1/cultura/convocatorias/${convocatoria.id}/postulacion`, { motivacion: "hola" });
    expect(corta.status).toBe(400);
    const alta = await api(ana.token).post(`/api/v1/cultura/convocatorias/${convocatoria.id}/postulacion`, { motivacion: "Quiero cantar en el coro de la universidad." });
    expect(alta.status).toBe(201);
    expect(alta.body[0].postulacion.estado).toBe("Recibida");

    const ajenos = crearUsuario("Administrador", "otro@uniautonoma.edu.co");
    expect((await api(ajenos.token).get("/api/v1/cultura/admin/convocatorias")).status).toBe(403);

    const lista = await api(personal.token).get("/api/v1/cultura/admin/convocatorias");
    expect(lista.status).toBe(200);
    const decision = await api(personal.token).patch(`/api/v1/cultura/admin/postulaciones/${lista.body[0].postulaciones[0].id}`, { estado: "Aceptada" });
    expect(decision.status).toBe(200);
    expect(decision.body.estado).toBe("Aceptada");
  });

  test("el personal publica un grupo y marca asistencia", async () => {
    const area = await prisma.areaCultural.create({ data: { nombre: "Teatro universitario" } });
    const creado = await api(personal.token).post("/api/v1/cultura/admin/grupos", {
      areaId: area.id,
      nombre: "Club de teatro",
      director: "Elena",
      lugar: "Sala 2",
      cupo: 12,
      horario: [{ dia: 5, inicio: "16:00", fin: "18:00" }],
    });
    expect(creado.status).toBe(201);
    await api(ana.token).post(`/api/v1/cultura/grupos/${creado.body.id}/inscripcion`);
    const asistencia = await api(personal.token).post(`/api/v1/cultura/admin/grupos/${creado.body.id}/asistencia`, {
      fecha: dentroDe(0),
      presentes: [ana.usuario.id],
    });
    expect(asistencia.status).toBe(200);
    expect(asistencia.body.presentes).toBe(1);
  });

  test("la inscripcion y la asistencia guardan tipo, hora e IP", async () => {
    const creado = await grupo({ nombre: "Piano" });
    const alta = await api(ana.token).post(`/api/v1/cultura/grupos/${creado.id}/inscripcion`, { tipoSnies: 2 });
    expect(alta.status).toBe(200);
    const inscripcion = await prisma.inscripcionCultural.findFirst({ where: { grupoId: creado.id, usuarioId: ana.usuario.id } });
    expect(inscripcion.tipoSnies).toBe(2);
    expect(inscripcion.ip).toBeTruthy();
    expect(inscripcion.fechaInscripcion).toBeTruthy();

    const marca = await api(ana.token).post(`/api/v1/cultura/grupos/${creado.id}/asistencia`);
    expect(marca.status).toBe(201);
    expect(marca.body.tipoSnies).toBe(2);
    expect(marca.body.ip).toBeTruthy();
    expect(marca.body.fechaHora).toBeTruthy();
    expect((await api(ana.token).post(`/api/v1/cultura/grupos/${creado.id}/asistencia`)).status).toBe(409);

    const informe = await api(personal.token).get("/api/v1/cultura/admin/informe");
    expect(informe.status).toBe(200);
    expect(informe.headers["content-type"]).toMatch(/spreadsheet/);
  });
});
