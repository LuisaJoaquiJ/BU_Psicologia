const { cierreService: desarrollo } = require("../../modules/desarrollo-humano/services/CierreService");
const { cierreService: deporte } = require("../../modules/deporte/services/CierreService");
const { cierreService: citasSalud } = require("../../modules/salud/agenda/services/CierreService");
const { salidaService } = require("../../modules/salud/services/SalidaService");

// Estados que cambian solos con el tiempo, sin esperar a que alguien los
// cambie a mano. El servidor los revisa al arrancar y cada pocos minutos.
// (Las jornadas de Salud dejan de mostrarse solas al pasar su fecha final.)
const CADA_MS = 5 * 60 * 1000;

async function ejecutarCierres(ahora = new Date()) {
  const tareas = {
    eventosDesarrollo: () => desarrollo.cerrarEventosTerminados(ahora),
    citasDesarrollo: () => desarrollo.citasSinRegistrar(ahora),
    eventosDeporte: () => deporte.finalizarEventosTerminados(ahora),
    salidasSalud: () => salidaService.cerrarVencidas(),
    citasSalud: () => citasSalud.citasSinRegistrar(ahora),
  };
  const resultado = {};
  // Cada tarea por separado: si una falla, las demas igual se ejecutan.
  for (const [nombre, tarea] of Object.entries(tareas)) {
    try {
      resultado[nombre] = await tarea();
    } catch (err) {
      resultado[nombre] = null;
      console.error(`Cierre automatico (${nombre}) fallo:`, err.message);
    }
  }
  return resultado;
}

function iniciarCierresAutomaticos() {
  const correr = () =>
    ejecutarCierres().then((r) => {
      const hechos = Object.entries(r).filter(([, n]) => n > 0);
      if (hechos.length) console.log("Cierres automaticos:", Object.fromEntries(hechos));
    });
  correr();
  const temporizador = setInterval(correr, CADA_MS);
  temporizador.unref();
  return temporizador;
}

module.exports = { ejecutarCierres, iniciarCierresAutomaticos, CADA_MS };
