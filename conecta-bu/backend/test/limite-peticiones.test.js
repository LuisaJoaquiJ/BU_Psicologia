// Limite de peticiones del login con Google y del asistente.
jest.mock("../src/config/prisma", () => require("./mocks/prisma.mock"));

const { configurarEntorno } = require("./helpers");
configurarEntorno();

const express = require("express");
const request = require("supertest");
const { limitarPeticiones, limiteLogin } = require("../src/common/middlewares/rateLimit.middleware");
const { errorHandler } = require("../src/common/middlewares/error.middleware");
const { app } = require("../src/app");

function appDePrueba(limite) {
  const a = express();
  a.get("/x", limite, (req, res) => res.json({ ok: true }));
  a.use(errorHandler);
  return a;
}

describe("Limite de peticiones", () => {
  test("responde 429 con Retry-After al pasar el maximo y cuenta por clave", async () => {
    const limite = limitarPeticiones({ max: 2, ventanaMs: 60000, clave: (req) => req.get("x-usuario") });
    const a = appDePrueba(limite);
    expect((await request(a).get("/x").set("x-usuario", "ana")).status).toBe(200);
    expect((await request(a).get("/x").set("x-usuario", "ana")).status).toBe(200);
    const bloqueada = await request(a).get("/x").set("x-usuario", "ana");
    expect(bloqueada.status).toBe(429);
    expect(Number(bloqueada.headers["retry-after"])).toBeGreaterThan(0);
    expect(bloqueada.body.error).toBe("Too Many Requests");
    // Otro usuario tiene su propio conteo.
    expect((await request(a).get("/x").set("x-usuario", "luis")).status).toBe(200);
  });

  test("vuelve a permitir cuando pasa la ventana", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    try {
      const a = appDePrueba(limitarPeticiones({ max: 1, ventanaMs: 1000 }));
      expect((await request(a).get("/x")).status).toBe(200);
      expect((await request(a).get("/x")).status).toBe(429);
      jest.advanceTimersByTime(1001);
      expect((await request(a).get("/x")).status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });

  test("el login con Google tiene limite", async () => {
    limiteLogin.reiniciar();
    let ultima;
    for (let i = 0; i < 21; i++) ultima = await request(app).post("/api/v1/auth/google").send({});
    expect(ultima.status).toBe(429);
    limiteLogin.reiniciar();
  });
});
