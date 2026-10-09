const { config } = require("../config/env");

// RF-013: cliente minimo para los webhooks de n8n.
//
// - Nunca bloquea ni hace fallar la operacion principal: si n8n no esta
//   configurado o no responde, la cita/inscripcion ya quedo guardada en la base
//   de datos y aqui solo se registra el fallo (flujo alternativo de RF-013).
// - Guarda en memoria las ultimas ejecuciones (exitosas, omitidas o fallidas)
//   para que el administrador las revise desde el dashboard. Al reiniciar el
//   servidor el registro se vacia; los datos de negocio no se pierden.

const MAX_REGISTROS = 50;
const registros = [];

function registrar(entrada) {
  registros.unshift({ fecha: new Date().toISOString(), ...entrada });
  if (registros.length > MAX_REGISTROS) registros.length = MAX_REGISTROS;
}

function listarEjecuciones() {
  return registros.slice();
}

function limpiarEjecuciones() {
  registros.length = 0;
}

async function postJson(url, cuerpo, timeoutMs = config.n8nTimeoutMs) {
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (config.n8nSecret) headers["X-Conecta-BU-Secret"] = config.n8nSecret;
    const respuesta = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
    });
    if (!respuesta.ok) {
      throw new Error(`n8n respondio HTTP ${respuesta.status}`);
    }
    const texto = await respuesta.text();
    try {
      return texto ? JSON.parse(texto) : {};
    } catch (e) {
      return { respuesta: texto };
    }
  } finally {
    clearTimeout(temporizador);
  }
}

// Dispara un flujo de automatizacion (p. ej. "cita.agendada"). Devuelve el
// resultado, pero quien llama no necesita esperarlo (fire-and-forget).
async function dispararAutomatizacion(tipo, datos) {
  if (!config.n8nWebhookUrl) {
    registrar({ tipo, estado: "omitida", detalle: "N8N_WEBHOOK_URL no esta configurada." });
    return { estado: "omitida" };
  }
  try {
    await postJson(config.n8nWebhookUrl, { tipo, origen: "conecta-bu", fecha: new Date().toISOString(), datos });
    registrar({ tipo, estado: "exitosa" });
    return { estado: "exitosa" };
  } catch (err) {
    const detalle = err.name === "AbortError" ? "Tiempo de espera agotado." : err.message;
    console.error(`[n8n] Fallo la automatizacion "${tipo}": ${detalle}`);
    registrar({ tipo, estado: "fallida", detalle });
    return { estado: "fallida", detalle };
  }
}

// Version "sin esperar": se usa desde los controladores despues de responder.
function notificar(tipo, datos) {
  dispararAutomatizacion(tipo, datos).catch(() => {});
}

module.exports = { dispararAutomatizacion, notificar, postJson, listarEjecuciones, limpiarEjecuciones };
