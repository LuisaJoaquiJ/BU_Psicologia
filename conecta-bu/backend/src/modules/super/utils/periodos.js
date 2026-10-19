// Periodos de los tableros de estadisticas: el periodo actual termina hoy
// (hora de Bogota) y el anterior es uno de la misma duracion justo antes, para
// comparar ("12 % mas que el periodo anterior"). Cada periodo se reparte en
// cubetas para las graficas: dias, semanas o meses.

const DIA = 24 * 3600 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const PERIODOS = {
  semana: { dias: 7, cubeta: "dia", texto: "los últimos 7 días", anterior: "los 7 días anteriores" },
  mes: { dias: 30, cubeta: "dia", texto: "los últimos 30 días", anterior: "los 30 días anteriores" },
  trimestre: { dias: 91, cubeta: "semana", texto: "los últimos 3 meses", anterior: "los 3 meses anteriores" },
  anio: { dias: 365, cubeta: "mes", texto: "el último año", anterior: "el año anterior" },
};

// Fecha de hoy en Bogota (UTC-5) a medianoche UTC, como las columnas @db.Date.
function hoyUTC() {
  const b = new Date(Date.now() - 5 * 3600 * 1000);
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
}

function aDia(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Para marcas de tiempo (fechaAgendamiento, fechaInscripcion...): el dia en Bogota.
function aDiaBogota(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return aDia(new Date(d.getTime() - 5 * 3600 * 1000));
}

const iso = (d) => d.toISOString().slice(0, 10);

function crearPeriodo(nombre = "mes") {
  const def = PERIODOS[nombre] || PERIODOS.mes;
  const clave = PERIODOS[nombre] ? nombre : "mes";
  const hasta = hoyUTC();
  let desde = new Date(hasta.getTime() - (def.dias - 1) * DIA);
  // Por meses: desde el primer dia del mes, 12 meses atras.
  if (def.cubeta === "mes") desde = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth() - 11, 1));
  const duracion = Math.round((hasta - desde) / DIA) + 1;
  const anteriorHasta = new Date(desde.getTime() - DIA);
  const anteriorDesde = new Date(anteriorHasta.getTime() - (duracion - 1) * DIA);

  const cubetas = [];
  if (def.cubeta === "dia") {
    for (let t = desde.getTime(); t <= hasta.getTime(); t += DIA) {
      const d = new Date(t);
      cubetas.push({
        clave: iso(d),
        etiqueta: def.dias <= 7 ? `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}` : `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`,
        desde: d,
        hasta: d,
      });
    }
  } else if (def.cubeta === "semana") {
    for (let t = desde.getTime(); t <= hasta.getTime(); t += 7 * DIA) {
      const d = new Date(t);
      const fin = new Date(Math.min(t + 6 * DIA, hasta.getTime()));
      cubetas.push({ clave: iso(d), etiqueta: `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`, desde: d, hasta: fin });
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + i, 1));
      const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      cubetas.push({ clave: iso(d).slice(0, 7), etiqueta: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, desde: d, hasta: fin });
    }
  }

  const dentro = (fecha, a, b) => {
    const d = aDia(fecha);
    return Boolean(d) && d >= a && d <= b;
  };
  return {
    periodo: clave,
    texto: def.texto,
    textoAnterior: def.anterior,
    desde: iso(desde),
    hasta: iso(hasta),
    cubetas: cubetas.map(({ clave: c, etiqueta }) => ({ clave: c, etiqueta })),
    enActual: (fecha) => dentro(fecha, desde, hasta),
    enAnterior: (fecha) => dentro(fecha, anteriorDesde, anteriorHasta),
    // Clave de la cubeta de una fecha (o null si queda fuera del periodo).
    cubetaDe(fecha) {
      const d = aDia(fecha);
      if (!d || d < desde || d > hasta) return null;
      return cubetas.find((c) => d >= c.desde && d <= c.hasta)?.clave || null;
    },
  };
}

// Variacion porcentual frente al periodo anterior (null si no hay base).
function variacion(actual, anterior) {
  if (!anterior) return actual ? null : 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

// Dias del mes en curso (para el calendario del tablero).
function mesActual() {
  const hoy = hoyUTC();
  const primero = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const ultimo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
  return { hoy: iso(hoy), desde: primero, hasta: ultimo, clave: iso(primero).slice(0, 7) };
}

module.exports = { PERIODOS, crearPeriodo, variacion, mesActual, aDia, aDiaBogota, iso, hoyUTC };
