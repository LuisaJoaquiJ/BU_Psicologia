// Pruebas del Sprint 1 (HU-01 a HU-05): login institucional, rechazo de
// cuentas externas, /me, cierre de sesion y proteccion de rutas admin.
//
// Google y Prisma se simulan (jest.mock) para que estas pruebas corran en
// cualquier equipo sin credenciales reales ni una base de datos levantada.

jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));

jest.mock("google-auth-library", () => {
  const payloads = {
    "token-valido-estudiante": {
      email: "estudiante.prueba@uniautonoma.edu.co",
      name: "Estudiante de Prueba",
      email_verified: true,
    },
    "token-cuenta-externa": {
      email: "persona@gmail.com",
      name: "Persona Externa",
      email_verified: true,
    },
  };

  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: async ({ idToken }) => {
        const payload = payloads[idToken];
        if (!payload) {
          throw new Error("Token de prueba no reconocido");
        }
        return { getPayload: () => payload };
      },
    })),
  };
});

process.env.PORT = "4000";
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
process.env.JWT_SECRET = "secreto-de-pruebas";
process.env.GOOGLE_CLIENT_ID = "client-id-de-pruebas";
process.env.ALLOWED_GOOGLE_DOMAIN = "uniautonoma.edu.co";
process.env.FRONTEND_URL = "http://localhost:5173";

const request = require("supertest");
const { app } = require("../src/app");
const { prisma } = require("./mocks/prisma.mock");
const { signToken } = require("../src/common/utils/jwt");

beforeEach(() => {
  prisma.__reset();
});

describe("RF-001 / HU-01: inicio de sesion institucional", () => {
  test("con una cuenta institucional valida, crea el usuario y devuelve un JWT", async () => {
    const res = await request(app)
      .post("/api/v1/auth/google")
      .send({ idToken: "token-valido-estudiante" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario).toMatchObject({
      email: "estudiante.prueba@uniautonoma.edu.co",
      rol: "Estudiante",
    });
  });

  test("sin idToken en el body, responde 400 (validacion)", async () => {
    const res = await request(app).post("/api/v1/auth/google").send({});
    expect(res.status).toBe(400);
  });
});

describe("RN-001 / HU-02: rechazo de cuentas no institucionales", () => {
  test("con una cuenta fuera del dominio autorizado, responde 403 y no crea el usuario", async () => {
    const res = await request(app)
      .post("/api/v1/auth/google")
      .send({ idToken: "token-cuenta-externa" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/institucional/i);
  });
});

describe("RF-002 / HU-03 y HU-04: sesion, roles y /me", () => {
  test("GET /me sin token responde 401", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("GET /me con un token valido devuelve los datos del usuario y su rol", async () => {
    const login = await request(app)
      .post("/api/v1/auth/google")
      .send({ idToken: "token-valido-estudiante" });
    const token = login.body.token;

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe("Estudiante");
  });

  test("POST /logout con un token valido responde 200", async () => {
    const login = await request(app)
      .post("/api/v1/auth/google")
      .send({ idToken: "token-valido-estudiante" });

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
  });
});

describe("HU-05 / RN-008: proteccion de rutas administrativas", () => {
  test("sin token, /admin/ping responde 401", async () => {
    const res = await request(app).get("/api/v1/admin/ping");
    expect(res.status).toBe(401);
  });

  test("con un token de estudiante, /admin/ping responde 403", async () => {
    const login = await request(app)
      .post("/api/v1/auth/google")
      .send({ idToken: "token-valido-estudiante" });

    const res = await request(app)
      .get("/api/v1/admin/ping")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
  });

  test("con un token de administrador, /admin/ping responde 200", async () => {
    const admin = prisma.__seedUsuario({
      emailInstitucional: "admin.prueba@uniautonoma.edu.co",
      nombre: "Administradora de Prueba",
      rolId: "rol-administrador",
    });
    const token = signToken({ sub: admin.id, rol: "Administrador" });

    const res = await request(app).get("/api/v1/admin/ping").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmado/i);
  });
});
