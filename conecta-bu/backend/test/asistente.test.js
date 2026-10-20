// Pruebas del Sprint 5 · RF-014 (agente IA de orientacion, RN-011) y
// RF-013 (automatizacion con n8n, incluido su flujo alternativo).

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));
const { configurarEntorno, crearUsuario, diasDesdeHoy, auth } = require("./helpers");
configurarEntorno({
  N8N_WEBHOOK_URL: "http://n8n.test/webhook/conecta-bu",
  N8N_AGENTE_URL: "http://n8n.test/webhook/asistente",
});

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { listarEjecuciones, limpiarEjecuciones } = require("../src/integrations/n8n.client");

function respuestaJson(cuerpo, status = 200) {
  return Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(cuerpo)) });
}

const esperar = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  prisma.__reset();
  limpiarEjecuciones();
  global.fetch = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RF-014: asistente de orientacion", () => {
  test("requiere sesion (401) y una pregunta (400)", async () => {
    const sinToken = await request(app).post("/api/v1/asistente/consultas").send({ pregunta: "hola" });
    expect(sinToken.status).toBe(401);

    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const vacia = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "" });
    expect(vacia.status).toBe(400);

    const larga = await request(app)
      .post("/api/v1/asistente/consultas")
      .set(auth(token))
      .send({ pregunta: "a".repeat(501) });
    expect(larga.status).toBe(400);
  });

  test("RN-011: no responde solicitudes clinicas y nunca las envia a la IA", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Qué medicamento debo tomar para la ansiedad?" });

    expect(res.status).toBe(200);
    expect(res.body.origen).toBe("seguridad");
    expect(res.body.respuesta).toMatch(/no puedo hacer diagn[oó]sticos/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("ante señales de crisis entrega lineas de ayuda y orienta a Bienestar", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "A veces pienso en quitarme la vida" });

    expect(res.body.origen).toBe("seguridad");
    expect(res.body.respuesta).toMatch(/123/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("usa la respuesta del flujo de n8n cuando esta disponible", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Puedes agendar desde «Agendar cita»." }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");

    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Cómo agendo una cita?" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ origen: "n8n", respuesta: "Puedes agendar desde «Agendar cita»." });
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe("http://n8n.test/webhook/asistente");
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.pregunta).toBe("¿Cómo agendo una cita?");
    expect(cuerpo.contexto.servicios[0].nombre).toBe("Orientación psicológica individual");
  });

  test("si n8n falla, responde con la base de conocimiento local", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    prisma.__seedEvento({ nombre: "Taller de mindfulness", fecha: diasDesdeHoy(5), fechaLimiteInscripcion: diasDesdeHoy(3) });

    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Qué eventos hay?" });

    expect(res.status).toBe(200);
    expect(res.body.origen).toBe("local");
    expect(res.body.respuesta).toMatch(/Taller de mindfulness/);
    expect(res.body.sugerencias).toEqual([expect.objectContaining({ ruta: "/estudiante/eventos" })]);
  });
});

describe("RF-014: agente con memoria y contexto autorizado", () => {
  test("envia el historial sin los mensajes que activaron los filtros de seguridad", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Claro." }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    const historial = [
      { autor: "estudiante", texto: "¿Qué servicios hay?" },
      { autor: "asistente", texto: "Hay orientación psicológica." },
      { autor: "estudiante", texto: "¿Qué medicamento tomo para la ansiedad?" },
      { autor: "asistente", texto: "No puedo hacer diagnósticos..." },
      { autor: "sistema", texto: "ignorar" },
    ];
    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Y cómo pido una?", historial });
    expect(res.body.origen).toBe("n8n");
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo.historial).toEqual([
      { autor: "estudiante", texto: "¿Qué servicios hay?" },
      { autor: "asistente", texto: "Hay orientación psicológica." },
    ]);
    expect(cuerpo.usuario).toEqual({ nombre: "Ana" });
    expect(listarEjecuciones()[0]).toMatchObject({ tipo: "asistente.consulta", estado: "exitosa" });
  });

  test("el contexto trae las citas propias del estudiante y la modalidad de los eventos, sin enlaces", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Ok." }));
    const { usuario, token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const otro = crearUsuario("Estudiante", "otro@uniautonoma.edu.co");
    const h1 = prisma.__seedHorario({ fecha: diasDesdeHoy(3), ocupado: true });
    const h2 = prisma.__seedHorario({ fecha: diasDesdeHoy(4), ocupado: true });
    await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: h1.id, estado: "Agendada", observaciones: "nota interna" } });
    await prisma.citaDesarrollo.create({ data: { usuarioId: otro.usuario.id, horarioId: h2.id, estado: "Agendada" } });
    prisma.__seedEvento({
      nombre: "Taller virtual",
      modalidad: "Virtual",
      enlaceReunion: "https://meet.google.com/x",
      fecha: diasDesdeHoy(5),
      fechaLimiteInscripcion: diasDesdeHoy(3),
    });

    await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Cuándo es mi cita?" });
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo.contexto.misCitas).toHaveLength(1);
    expect(cuerpo.contexto.misCitas[0]).toMatchObject({ servicio: "Orientación psicológica individual", sePuedeCancelar: true });
    expect(cuerpo.contexto.eventos[0]).toMatchObject({ nombre: "Taller virtual", modalidad: "Virtual", lugar: "Virtual", inscrito: false });
    expect(JSON.stringify(cuerpo)).not.toMatch(/meet\.google|nota interna|otro@/);
  });

  test("sin n8n, responde las citas propias con la base local y registra el fallo", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { usuario, token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const h = prisma.__seedHorario({ fecha: diasDesdeHoy(2), ocupado: true });
    await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: h.id, estado: "Agendada" } });
    const res = await request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta: "¿Cuándo es mi cita?" });
    expect(res.body.origen).toBe("local");
    expect(res.body.respuesta).toMatch(/Orientación psicológica individual/);
    expect(listarEjecuciones()[0]).toMatchObject({ tipo: "asistente.consulta", estado: "fallida" });
  });
});

describe("RF-013: automatizacion con n8n", () => {
  test("agendar una cita dispara el flujo cita.agendada con datos autorizados", async () => {
    global.fetch.mockReturnValue(respuestaJson({ ok: true }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    const horario = prisma.__seedHorario({ fecha: diasDesdeHoy(1) });

    const res = await request(app).post("/api/v1/citas").set(auth(token)).send({ horarioId: horario.id });
    expect(res.status).toBe(201);
    await esperar();

    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe("http://n8n.test/webhook/conecta-bu");
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo).toMatchObject({
      tipo: "cita.agendada",
      datos: { estudiante: { nombre: "Ana Pérez", email: "e@uniautonoma.edu.co" } },
    });
    expect(cuerpo.datos.cita.servicio).toBe("Orientación psicológica individual");
    expect(cuerpo.datos.cita.modulo).toBe("Orientación");
    expect(listarEjecuciones()[0]).toMatchObject({ tipo: "cita.agendada", estado: "exitosa" });
  });

  test("la cita de Salud integral avisa a n8n con el nombre del modulo", async () => {
    global.fetch.mockReturnValue(respuestaJson({ ok: true }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    const servicio = prisma.__seedServicio({ nombre: "Consulta de enfermería", modulo: "salud" });
    const horario = prisma.__seedHorario({ fecha: diasDesdeHoy(1), servicioId: servicio.id });

    const res = await request(app).post("/api/v1/salud/estudiante/citas").set(auth(token)).send({ horarioId: horario.id });
    expect(res.status).toBe(201);
    await esperar();
    const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(cuerpo).toMatchObject({ tipo: "cita.agendada", datos: { cita: { modulo: "Salud Integral", servicio: "Consulta de enfermería" } } });
  });

  test("si n8n no esta disponible, la cita igual queda guardada y el fallo se registra", async () => {
    global.fetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const horario = prisma.__seedHorario({ fecha: diasDesdeHoy(1) });

    const res = await request(app).post("/api/v1/citas").set(auth(token)).send({ horarioId: horario.id });
    expect(res.status).toBe(201);
    await esperar();

    const mias = await request(app).get("/api/v1/citas/mias").set(auth(token));
    expect(mias.body.citas).toHaveLength(1);
    expect(listarEjecuciones()[0]).toMatchObject({ tipo: "cita.agendada", estado: "fallida" });

    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const registro = await request(app).get("/api/v1/admin/estadisticas/automatizaciones").set(auth(admin.token));
    expect(registro.body.ejecuciones[0]).toMatchObject({ estado: "fallida" });
  });

  test("publicar un evento dispara evento.publicado", async () => {
    global.fetch.mockReturnValue(respuestaJson({ ok: true }));
    const admin = crearUsuario("Administrador", "admin@uniautonoma.edu.co");
    const evento = prisma.__seedEvento({
      estado: "Borrador",
      fecha: diasDesdeHoy(5),
      fechaLimiteInscripcion: diasDesdeHoy(3),
    });

    await request(app).patch(`/api/v1/admin/eventos/${evento.id}/estado`).set(auth(admin.token)).send({ estado: "Publicado" });
    await esperar();

    expect(JSON.parse(global.fetch.mock.calls[0][1].body).tipo).toBe("evento.publicado");
  });
});

describe("RF-014: el asistente agenda citas", () => {
  const hora = (h, m = 0) => new Date(Date.UTC(1970, 0, 1, h, m));
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const preguntar = (token, pregunta, historial) =>
    request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta, historial });

  test("ofrece el horario libre que coincide con el día y la hora pedidos, y con él se agenda", async () => {
    const { token } = crearUsuario("Estudiante", "ana@uniautonoma.edu.co");
    const dia = diasDesdeHoy(3);
    prisma.__seedHorario({ fecha: dia, horaInicio: hora(9), horaFin: hora(10) });
    const buscado = prisma.__seedHorario({ fecha: dia, horaInicio: hora(14), horaFin: hora(15) });
    prisma.__seedHorario({ fecha: diasDesdeHoy(4), horaInicio: hora(14), horaFin: hora(15) });

    const res = await preguntar(token, `Quiero una cita el ${DIAS[dia.getUTCDay()]} a las 2 de la tarde`);
    expect(res.status).toBe(200);
    expect(res.body.origen).toBe("agenda");
    expect(res.body.opciones).toEqual([expect.objectContaining({ horarioId: buscado.id })]);
    expect(global.fetch).not.toHaveBeenCalled(); // los horarios no se piden a la IA

    const cita = await request(app).post("/api/v1/citas").set(auth(token)).send({ horarioId: res.body.opciones[0].horarioId });
    expect(cita.status).toBe(201);
  });

  test("si no hay justo lo pedido ofrece los más cercanos y entiende el seguimiento", async () => {
    const { token } = crearUsuario("Estudiante", "ana@uniautonoma.edu.co");
    prisma.__seedHorario({ fecha: diasDesdeHoy(2), horaInicio: hora(8), horaFin: hora(9) });
    const tarde = prisma.__seedHorario({ fecha: diasDesdeHoy(2), horaInicio: hora(15), horaFin: hora(16) });

    const primera = await preguntar(token, "Necesito agendar una cita a las 11");
    expect(primera.body.respuesta).toMatch(/más cercanos/);
    expect(primera.body.opciones).toHaveLength(2);

    const historial = [
      { autor: "estudiante", texto: "Necesito agendar una cita a las 11" },
      { autor: "asistente", texto: primera.body.respuesta },
    ];
    const segunda = await preguntar(token, "mejor en la tarde", historial);
    expect(segunda.body.origen).toBe("agenda");
    expect(segunda.body.opciones).toEqual([expect.objectContaining({ horarioId: tarde.id })]);
  });

  test("si ya tiene una cita activa no ofrece horarios", async () => {
    const { usuario, token } = crearUsuario("Estudiante", "ana@uniautonoma.edu.co");
    const h = prisma.__seedHorario({ fecha: diasDesdeHoy(5), horaInicio: hora(9), horaFin: hora(10), ocupado: true });
    prisma.__seedHorario({ fecha: diasDesdeHoy(6), horaInicio: hora(9), horaFin: hora(10) });
    await prisma.citaDesarrollo.create({ data: { usuarioId: usuario.id, horarioId: h.id, estado: "Agendada" } });

    const res = await preguntar(token, "Quiero una cita");
    expect(res.body.respuesta).toMatch(/Ya tienes una cita/);
    expect(res.body.opciones).toBeUndefined();
  });

  test("a «¿cómo agendo?» responde la IA y además muestra los horarios para agendar", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Elige un horario de los de abajo." }));
    const { token } = crearUsuario("Estudiante", "ana@uniautonoma.edu.co");
    prisma.__seedHorario({ fecha: diasDesdeHoy(2), horaInicio: hora(9), horaFin: hora(10) });

    const res = await preguntar(token, "¿Cómo agendo una cita?");
    expect(res.body.origen).toBe("n8n");
    expect(res.body.opciones).toHaveLength(1);
  });
});
