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
  const raw = JSON.stringify(cuerpo);
  return Promise.resolve({
    ok: status < 400,
    status,
    text: () => Promise.resolve(raw),
    json: () => Promise.resolve(cuerpo),
  });
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
    const res = await request(app)
      .post("/api/v1/asistente/consultas")
      .set(auth(token))
      .send({ pregunta: "¿Qué medicamento debo tomar para la ansiedad?" });

    expect(res.status).toBe(200);
    expect(res.body.origen).toBe("seguridad");
    expect(res.body.respuesta).toMatch(/no puedo hacer diagn[oó]sticos/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("ante señales de crisis entrega lineas de ayuda y orienta a Bienestar", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await request(app)
      .post("/api/v1/asistente/consultas")
      .set(auth(token))
      .send({ pregunta: "A veces pienso en quitarme la vida" });

    expect(res.body.origen).toBe("seguridad");
    expect(res.body.respuesta).toMatch(/123/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("usa la respuesta del flujo de n8n cuando esta disponible", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Puedes agendar desde «Agendar cita»." }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");

    const res = await request(app)
      .post("/api/v1/asistente/consultas")
      .set(auth(token))
      .send({ pregunta: "¿Cómo agendo una cita?" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ origen: "n8n", respuesta: "Puedes agendar desde «Agendar cita»." });
    const [url, opciones] = global.fetch.mock.calls[0];
    expect(url).toBe("http://n8n.test/webhook/asistente");
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.pregunta).toBe("¿Cómo agendo una cita?");
    expect(cuerpo.contexto.servicios[0].nombre).toBe("Orientación psicológica individual");
  });

  test("consulta a Gemini cuando hay clave y no envia el correo", async () => {
    process.env.GEMINI_API_KEY = "clave-de-prueba";
    global.fetch.mockReturnValueOnce(
      respuestaJson({ candidates: [{ content: { parts: [{ text: "Entra a Pedir una cita y elige un horario." }] } }] })
    );
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");

    try {
      const res = await request(app)
        .post("/api/v1/asistente/consultas")
        .set(auth(token))
        .send({ pregunta: "¿Cómo agendo una cita?" });

      expect(res.status).toBe(200);
      expect(res.body.origen).toBe("gemini");
      expect(res.body.respuesta).toMatch(/Pedir una cita/);
      const [url, opciones] = global.fetch.mock.calls[0];
      expect(url).toContain("generativelanguage.googleapis.com");
      expect(url).toContain("gemini-flash-latest");
      const cuerpo = JSON.parse(opciones.body);
      expect(cuerpo.contents[0].parts[0].text).toContain("Ana");
      expect(cuerpo.contents[0].parts[0].text).not.toContain("@");
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });

  test("si Gemini falla, sigue con la base local", async () => {
    process.env.GEMINI_API_KEY = "clave-de-prueba";
    global.fetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");

    try {
      const res = await request(app)
        .post("/api/v1/asistente/consultas")
        .set(auth(token))
        .send({ pregunta: "¿Cómo agendo una cita?" });
      expect(res.body.origen).toBe("local");
      expect(res.body.respuesta).toMatch(/horario/);
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });

  test("si n8n falla, responde con la base de conocimiento local", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    prisma.__seedEvento({ nombre: "Taller de mindfulness", fecha: diasDesdeHoy(5), fechaLimiteInscripcion: diasDesdeHoy(3) });

    const res = await request(app)
      .post("/api/v1/asistente/consultas")
      .set(auth(token))
      .send({ pregunta: "¿Qué eventos hay?" });

    expect(res.status).toBe(200);
    expect(res.body.origen).toBe("local");
    expect(res.body.respuesta).toMatch(/Taller de mindfulness/);
    expect(res.body.sugerencias).toEqual([expect.objectContaining({ ruta: "/estudiante/eventos" })]);
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
    expect(listarEjecuciones()[0]).toMatchObject({ tipo: "cita.agendada", estado: "exitosa" });
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

    await request(app)
      .patch(`/api/v1/admin/eventos/${evento.id}/estado`)
      .set(auth(admin.token))
      .send({ estado: "Publicado" });
    await esperar();

    expect(JSON.parse(global.fetch.mock.calls[0][1].body).tipo).toBe("evento.publicado");
  });
});
