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
const { TITULO_ALERTA, ACCION_ALERTA, textoObligatorio, detectarCrisis, extraerAlerta, limpiarAlertasCrisis } = require("../src/modules/desarrollo-humano/utils/asistenteCrisis");
const { detectarAnimo } = require("../src/modules/desarrollo-humano/utils/asistenteAnimo");
const { normalizar } = require("../src/modules/desarrollo-humano/utils/asistenteSeguridad");
const { NOTA_CONFIDENCIALIDAD } = require("../src/modules/desarrollo-humano/utils/asistenteRespuestas");
const { limiteAsistente } = require("../src/common/middlewares/rateLimit.middleware");

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
  limpiarAlertasCrisis();
  limiteAsistente.reiniciar(); // los ids de usuario se repiten entre pruebas
  global.fetch = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
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
    // Nunca va al agente ni a Gemini (solo puede salir el aviso a n8n con datos minimos).
    expect(global.fetch.mock.calls.map(([url]) => url)).not.toContain("http://n8n.test/webhook/asistente");
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

describe("Protocolo de emergencia y riesgo vital", () => {
  const preguntar = (token, pregunta, historial) =>
    request(app).post("/api/v1/asistente/consultas").set(auth(token)).send({ pregunta, historial });
  const urlsLlamadas = () => global.fetch.mock.calls.map(([url]) => String(url));
  const avisosDe = async (quien) => (await request(app).get("/api/v1/notificaciones").set(auth(quien.token))).body.items;
  const OBLIGATORIO = "Por favor, comunícate ahora mismo a nuestra línea de apoyo urgente: 123 o acércate al área de Psicología. Hay profesionales listos para escucharte y acompañarte en este preciso momento. No estás solo/a.";
  const conversacion = [
    { autor: "estudiante", texto: "¿Qué eventos hay?" },
    { autor: "asistente", texto: "Hay un taller el lunes." },
  ];

  test("el texto obligatorio es literal y la línea sale de LINEA_APOYO_URGENTE (por defecto 123)", () => {
    expect(textoObligatorio()).toBe(OBLIGATORIO);
    process.env.LINEA_APOYO_URGENTE = "+57 300 000 0000";
    try {
      expect(textoObligatorio()).toContain("línea de apoyo urgente: +57 300 000 0000 o acércate");
    } finally {
      delete process.env.LINEA_APOYO_URGENTE;
    }
  });

  test.each([
    "me quiero matar",
    "Ya no quiero vivir",
    "quiero hacerme daño",
    "siento que no puedo más",
    "ME KIERO MORIR",
    "quiero desaparecer",
    "a veces pienso en cortarme",
    "pienso en suicidarme",
    "no le veo sentido a la vida",
    "nadie me extrañaría",
  ])("detecta «%s» y responde con contención empática y el texto obligatorio", async (frase) => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await preguntar(token, frase, conversacion);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ origen: "seguridad", crisis: true, lineaApoyo: "123", sugerencias: [] });
    expect(res.body.respuesta).toContain(OBLIGATORIO);
    expect(res.body.respuesta).toContain("psicologoinstitucional@uniautonoma.edu.co");
    expect(res.body.respuesta).not.toMatch(/ALERTA|Motivo detectado|Acción requerida/);
    expect(res.body.respuesta).not.toContain("Tus mensajes son confidenciales"); // no es la primera respuesta
    expect(urlsLlamadas()).not.toContain("http://n8n.test/webhook/asistente");
  });

  test.each(["me mata de risa", "este parcial me va a matar", "quiero cortarme el pelo", "me muero de risa con ese profe", "no puedo más con este parcial", "quiero agendar una cita"])(
    "no confunde «%s» con una crisis",
    (frase) => {
      expect(detectarCrisis(frase)).toBeNull();
    },
  );

  test("la crisis se atiende antes que cualquier otra consulta del mismo mensaje", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    prisma.__seedHorario({ fecha: diasDesdeHoy(2) });
    const res = await preguntar(token, "Quiero agendar una cita, ya no quiero vivir");
    expect(res.body.respuesta).toContain(OBLIGATORIO);
    expect(res.body.opciones).toBeUndefined();
  });

  test("si la crisis es la primera respuesta, el aviso de privacidad va al final en cursiva", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await preguntar(token, "me quiero morir", []);
    expect(res.body.respuesta).toContain(OBLIGATORIO);
    expect(res.body.respuesta.endsWith(`\n\n_${NOTA_CONFIDENCIALIDAD}_`)).toBe(true);
  });

  test("la notificación al personal de DH trae el bloque de ALERTA ROJA con el motivo, nunca el historial", async () => {
    const psico = crearUsuario("Administrador", "psico@uniautonoma.edu.co", "Psicóloga");
    const ana = crearUsuario("Estudiante", "ana@uniautonoma.edu.co", "Ana Pérez");
    const historial = [
      { autor: "estudiante", texto: "Perdí cálculo y mi familia no lo sabe" },
      { autor: "asistente", texto: "Te entiendo." },
    ];
    const res = await preguntar(ana.token, "Hola, siento que ya no quiero vivir", historial);
    expect(res.body.respuesta).toContain(OBLIGATORIO);
    expect(res.body.respuesta).not.toContain("ALERTA ROJA");

    const avisos = await avisosDe(psico);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ modulo: "desarrollo-humano", tipo: "alerta-crisis", titulo: "🚨 ALERTA ROJA: POSIBLE RIESGO VITAL 🚨" });
    const lineas = avisos[0].mensaje.split("\n");
    expect(lineas[0]).toBe("Estudiante: Ana Pérez (ana@uniautonoma.edu.co)");
    expect(lineas[1]).toBe("🛑 Acción requerida: Intervención inmediata de Psicología.");
    expect(lineas[2]).toMatch(/^📌 Motivo detectado: .*no quiero vivir/);
    expect(avisos[0].mensaje.length).toBeLessThanOrEqual(500);
    expect(avisos[0].mensaje).not.toMatch(/c[aá]lculo|familia|Te entiendo/);
    expect(await avisosDe(ana)).toHaveLength(0);

    const bloque = console.warn.mock.calls.map((c) => String(c[0])).find((t) => t.startsWith(TITULO_ALERTA));
    expect(bloque).toContain(ACCION_ALERTA);
    expect(bloque).toContain("📌 Motivo detectado:");
    expect(bloque).not.toMatch(/c[aá]lculo/);
  });

  test("cada mensaje de riesgo genera su alerta; solo se agrupa el mismo mensaje repetido en menos de 1 minuto", async () => {
    const psico = crearUsuario("Administrador", "psico@uniautonoma.edu.co");
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const inicio = Date.now();
    const reloj = jest.spyOn(Date, "now").mockReturnValue(inicio);
    const primera = await preguntar(token, "me quiero morir");
    const segunda = await preguntar(token, "de verdad me quiero morir");
    const repetida = await preguntar(token, "me quiero morir"); // doble envio: no se duplica
    for (const r of [primera, segunda, repetida]) expect(r.body.respuesta).toContain(OBLIGATORIO);
    expect(await avisosDe(psico)).toHaveLength(2);
    // Pasados 10 minutos (antes era el limite), otra alerta llega siempre, y lo mismo pasado 1 minuto.
    reloj.mockReturnValue(inicio + 61 * 1000);
    await preguntar(token, "me quiero morir");
    reloj.mockReturnValue(inicio + 3 * 60 * 1000);
    await preguntar(token, "me quiero matar");
    expect(await avisosDe(psico)).toHaveLength(4);
  });

  test.each([
    ["el bloque de ALERTA ROJA", `${TITULO_ALERTA}\n${ACCION_ALERTA}\n📌 Motivo detectado: Dice que todo le sale mal y se siente sin salida`],
    ["la etiqueta antigua", "[ALERTA_CRISIS_PSICOLOGICA] | Motivo: Dice que todo le sale mal y se siente sin salida"],
  ])("si Gemini responde con %s, se quita del texto y se dispara la alerta", async (_nombre, bloque) => {
    process.env.GEMINI_API_KEY = "clave-de-prueba";
    global.fetch.mockImplementation((url) =>
      String(url).includes("generativelanguage")
        ? respuestaJson({ candidates: [{ content: { parts: [{ text: `Lamento mucho lo que sientes.\n\n\n${bloque}` }] } }] })
        : respuestaJson({ ok: true }),
    );
    const psico = crearUsuario("Administrador", "psico@uniautonoma.edu.co");
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Luis Gómez");
    try {
      const res = await preguntar(token, "todo me sale mal últimamente");
      expect(res.body).toMatchObject({ origen: "seguridad", crisis: true, sugerencias: [] });
      expect(res.body.respuesta).toContain(OBLIGATORIO);
      expect(res.body.respuesta).not.toMatch(/ALERTA|Motivo/);
      const avisos = await avisosDe(psico);
      expect(avisos).toHaveLength(1);
      expect(avisos[0].mensaje).toContain("📌 Motivo detectado: Dice que todo le sale mal y se siente sin salida");
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });

  test("extraerAlerta quita el bloque y une un motivo de dos líneas", () => {
    const r = extraerAlerta(`Texto para el estudiante.\n\n${TITULO_ALERTA}\n${ACCION_ALERTA}\n📌 Motivo detectado: Dice que no quiere seguir\ny que nadie lo entiende.`);
    expect(r.texto).toBe("Texto para el estudiante.");
    expect(r.motivo).toBe("Dice que no quiere seguir y que nadie lo entiende.");
  });

  test("el prompt de Gemini trae motivación contextual, aviso de privacidad, protocolo de crisis y flujo con negritas", async () => {
    process.env.GEMINI_API_KEY = "clave-de-prueba";
    global.fetch.mockReturnValueOnce(respuestaJson({ candidates: [{ content: { parts: [{ text: "1. Entra a «Agendar cita»." }] } }] }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    try {
      await preguntar(token, "¿Cómo agendo una cita?", []);
      const cuerpo = JSON.parse(global.fetch.mock.calls[0][1].body);
      const sistema = cuerpo.systemInstruction.parts[0].text;
      expect(sistema).toMatch(/MOTIVACIÓN CONTEXTUAL/);
      expect(sistema).toContain(NOTA_CONFIDENCIALIDAD);
      expect(sistema).toContain(OBLIGATORIO);
      expect(sistema).toContain(`${TITULO_ALERTA}\n${ACCION_ALERTA}\n📌 Motivo detectado:`);
      expect(sistema).toMatch(/negritas/);
      expect(cuerpo.contents.at(-1).parts[0].text).toContain("Primera respuesta: sí");
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });
});

describe("Saludo, motivación contextual y aviso de privacidad", () => {
  const preguntar = (token, cuerpo) => request(app).post("/api/v1/asistente/consultas").set(auth(token)).send(cuerpo);
  const NOTA_CURSIVA = `_${NOTA_CONFIDENCIALIDAD}_`;
  const yaConverso = [
    { autor: "estudiante", texto: "Hola" },
    { autor: "asistente", texto: "¡Hola! ¿En qué te ayudo?" },
  ];

  test("el aviso de privacidad tiene el texto nuevo", () => {
    expect(NOTA_CONFIDENCIALIDAD).toBe("Nota: Tus mensajes son confidenciales, salvo que el sistema detecte un riesgo para tu salud o seguridad, en cuyo caso buscaremos ayuda para ti.");
  });

  test.each(["Hola", "buenos días!", "Buenas tardes, ¿cómo estás?"])("al saludo «%s» da una bienvenida proactiva y, por ser la primera, el aviso en cursiva", async (saludo) => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    prisma.__seedHorario({ fecha: diasDesdeHoy(2) });
    const res = await preguntar(token, { pregunta: saludo, historial: [] });
    expect(res.body.origen).toBe("local");
    expect(res.body.respuesta).toMatch(/^¡(Buenos días|Buenas tardes|Buenas noches|Hola|Qué gusto leerte), Ana!/);
    expect(res.body.respuesta).toContain("**1 horario libre**");
    expect(res.body.respuesta.endsWith(`\n\n${NOTA_CURSIVA}`)).toBe(true);
    expect(res.body.sugerencias.length).toBeGreaterThan(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("la bienvenida no es estática: cambia entre variantes", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    const azar = jest.spyOn(Math, "random").mockReturnValue(0);
    const a = (await preguntar(token, { pregunta: "hola", historial: [] })).body.respuesta;
    azar.mockReturnValue(0.99);
    const b = (await preguntar(token, { pregunta: "hola", historial: [] })).body.respuesta;
    expect(a).not.toBe(b);
  });

  test("en las respuestas siguientes no aparece el aviso", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await preguntar(token, { pregunta: "hola", historial: yaConverso });
    expect(res.body.respuesta).not.toContain("Tus mensajes son confidenciales");
  });

  test("sin historial, usa el indicador «primera» del frontend", async () => {
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const conIndicador = await preguntar(token, { pregunta: "hola", primera: true });
    expect(conIndicador.body.respuesta.endsWith(NOTA_CURSIVA)).toBe(true);
    const sinIndicador = await preguntar(token, { pregunta: "hola", primera: false });
    expect(sinIndicador.body.respuesta).not.toContain("Tus mensajes son confidenciales");
  });

  test("si la IA escribe el aviso en una respuesta posterior, se quita; en la primera queda una sola vez y exacto", async () => {
    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Con gusto.\n\n*Nota: tus mensajes son confidenciales y bla bla.*" }));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const despues = await preguntar(token, { pregunta: "¿Qué servicios hay?", historial: yaConverso });
    expect(despues.body).toMatchObject({ origen: "n8n", respuesta: "Con gusto." });

    global.fetch.mockReturnValueOnce(respuestaJson({ respuesta: "Con gusto.\n\nNota: Tus mensajes son confidenciales (versión de la IA)." }));
    const primera = await preguntar(token, { pregunta: "¿Qué servicios hay?", historial: [] });
    expect(primera.body.respuesta).toBe(`Con gusto.\n\n${NOTA_CURSIVA}`);
  });

  test.each([
    ["estoy muy estresada por los parciales", "examenes"],
    ["tengo mucho trabajo esta semana", "trabajo"],
    ["estoy cansadísimo, no dormí", "cansancio"],
    ["me siento un poco triste", "tristeza"],
    ["¡aprobé cálculo, estoy feliz!", "felicidad"],
    ["sin ganas de estudiar", "desmotivacion"],
    ["no estoy cansado", null],
    ["¿cuándo son los parciales?", null],
  ])("reconoce el ánimo de «%s»", (frase, caso) => {
    expect(detectarAnimo(normalizar(frase))).toBe(caso);
  });

  test("a «estoy muy estresada por los parciales» responde primero con ánimo y luego ofrece ayuda concreta, sin IA", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co", "Ana Pérez");
    const res = await preguntar(token, { pregunta: "estoy muy estresada por los parciales", historial: yaConverso });
    expect(res.body.origen).toBe("local");
    const [animo, ...resto] = res.body.respuesta.split("\n\n");
    expect(animo).toMatch(/parcial|examen/i);
    expect(resto.join("\n\n")).toMatch(/\*\*Agendar una cita de Orientación\*\*/);
    expect(res.body.sugerencias).toEqual(expect.arrayContaining([expect.objectContaining({ ruta: "/estudiante/agendar" })]));
    expect(res.body.respuesta).not.toMatch(/no estoy seguro de haber entendido/);
  });

  test("con ánimo y consulta: primero la frase de ánimo y luego la respuesta", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    prisma.__seedEvento({ nombre: "Taller de manejo del estrés", fecha: diasDesdeHoy(5), fechaLimiteInscripcion: diasDesdeHoy(3) });
    const res = await preguntar(token, { pregunta: "estoy estresada por parciales, ¿qué eventos hay?", historial: yaConverso });
    const partes = res.body.respuesta.split("\n\n");
    expect(partes[0]).toMatch(/parcial|examen/i);
    expect(res.body.respuesta.indexOf("Taller de manejo del estrés")).toBeGreaterThan(partes[0].length);
  });

  test("sin respuesta exacta, ofrece con amabilidad lo que sí puede hacer", async () => {
    global.fetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { token } = crearUsuario("Estudiante", "e@uniautonoma.edu.co");
    const res = await preguntar(token, { pregunta: "¿Cuál es la clave del wifi?", historial: yaConverso });
    expect(res.body.origen).toBe("local");
    expect(res.body.respuesta).toMatch(/quiero ayudarte/);
    expect(res.body.sugerencias.length).toBeGreaterThan(0);
    expect(res.body.generica).toBeUndefined();
  });
});
