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

describe("Historias de Cultura", () => {
  let ana;
  let personal;
  let monitor;

  beforeEach(async () => {
    prisma.__reset();
    ana = crearUsuario("Estudiante", "ana.hu@uniautonoma.edu.co", "Ana Hu");
    personal = crearUsuario("Administrador", "cultura.hu@uniautonoma.edu.co", "Personal Hu");
    monitor = crearUsuario("Administrador", "monitor.hu@uniautonoma.edu.co", "Monitor Hu");
    prisma.__darAcceso("cultura.hu@uniautonoma.edu.co", "cultura");
    prisma.__darAcceso("monitor.hu@uniautonoma.edu.co", "cultura");
  });

  function api(token) {
    return {
      get: (ruta) => request(app).get(ruta).set(auth(token)),
      post: (ruta, cuerpo) => request(app).post(ruta).set(auth(token)).send(cuerpo),
      put: (ruta, cuerpo) => request(app).put(ruta).set(auth(token)).send(cuerpo),
    };
  }

  async function grupo(categoria = "representativo") {
    const area = await prisma.areaCultural.create({ data: { nombre: `Band ${Date.now()}${Math.random()}`, categoria } });
    return prisma.grupoCultural.create({
      data: {
        areaId: area.id,
        periodo: periodoActual(),
        nombre: "Uniautónoma Band",
        cupo: 10,
        horario: [{ dia: 2, inicio: "14:00", fin: "16:00" }],
        inscripcionesAbiertas: true,
        activo: true,
      },
    });
  }

  test("el monitor no configura grupos y la delegacion ASIES guarda el reconocimiento", async () => {
    expect((await api(personal.token).put("/api/v1/cultura/admin/equipo", { email: "monitor.hu@uniautonoma.edu.co", rol: "monitor" })).status).toBe(200);
    const area = await prisma.areaCultural.create({ data: { nombre: `Teatro ${Date.now()}` } });
    expect((await api(monitor.token).post("/api/v1/cultura/admin/grupos", { areaId: area.id, nombre: "Synapsis", horario: [{ dia: 3, inicio: "10:00", fin: "12:00" }] })).status).toBe(403);

    const creado = await grupo();
    const red = await api(personal.token).post("/api/v1/cultura/admin/representaciones", {
      red: "ASIES",
      nombre: "Concurso de canto",
      modalidad: "Intérprete solista",
      fecha: dentroDe(10),
      grupoId: creado.id,
      posicion: "3.er lugar en intérprete solista",
      participantes: [ana.usuario.emailInstitucional],
    });
    expect(red.status).toBe(201);
    expect(red.body.posicion).toMatch(/solista/);
    expect(red.body.participantes).toHaveLength(1);

    const historico = await api(personal.token).get(`/api/v1/cultura/admin/representaciones?usuarioId=${ana.usuario.id}`);
    expect(historico.body).toHaveLength(1);
  });

  test("la pausa, el apoyo y la busqueda por cedula quedan registrados", async () => {
    const pausa = await api(personal.token).post("/api/v1/cultura/admin/pausas", {
      fecha: dentroDe(1),
      horaInicio: "10:00",
      horaFin: "11:30",
      lugar: "Cafetería",
      tecnica: "Origami",
      impactoEstimado: 25,
    });
    expect(pausa.status).toBe(201);
    expect(pausa.body).toMatchObject({ horaInicio: "10:00", horaFin: "11:30" });
    const sinHora = await api(personal.token).post("/api/v1/cultura/admin/pausas", { fecha: dentroDe(1), lugar: "Cafetería", tecnica: "Origami", impactoEstimado: 5 });
    expect(sinHora.status).toBe(400);
    const alReves = await api(personal.token).post("/api/v1/cultura/admin/pausas", { fecha: dentroDe(1), horaInicio: "11:00", horaFin: "10:00", lugar: "Cafetería", tecnica: "Origami", impactoEstimado: 5 });
    expect(alReves.body.message).toBe("La hora de fin debe ser posterior a la de inicio.");

    const apoyo = await api(personal.token).post("/api/v1/cultura/admin/apoyo", {
      lugarDestino: "Colegio San José",
      fecha: dentroDe(4),
      hora: "09:00",
      personalAsignado: "Docente OPS y monitor",
    });
    expect(apoyo.status).toBe(201);
    expect(apoyo.body.personalAsignado).toMatch(/monitor/);

    const perfil = await api(ana.token).put("/api/v1/cultura/perfil", { documento: "1061731427", programa: "Derecho", caracterizacion: "Afro" });
    expect(perfil.status).toBe(200);
    const creado = await grupo("taller"); // a los representativos se entra por audicion
    expect((await api(ana.token).post(`/api/v1/cultura/grupos/${creado.id}/inscripcion`)).status).toBe(200);
    const hallados = await api(personal.token).get("/api/v1/cultura/admin/inscritos?q=1061731427");
    expect(hallados.status).toBe(200);
    expect(hallados.body[0].programa).toBe("Derecho");

    await api(personal.token).post(`/api/v1/cultura/admin/grupos/${creado.id}/asistencia`, { fecha: dentroDe(0), presentes: [ana.usuario.id] });
    const registro = await api(personal.token).get("/api/v1/cultura/admin/registro-calificado?programa=Derecho");
    expect(registro.body).toHaveLength(1);
    expect(registro.body[0].asistenciaConfirmada).toBe(true);
    const inclusion = await api(personal.token).get("/api/v1/cultura/admin/inclusion");
    expect(inclusion.body.some((f) => f.caracterizacion === "Afro")).toBe(true);

    const csv = await api(personal.token).get("/api/v1/cultura/admin/informe?formato=csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/csv/);
    expect(csv.text).toMatch(/Derecho/);
  });
});
