const { aDia, aDiaBogota } = require("../periodos");
const { contarPor, tasa } = require("../conteos");
const { ESTADOS_CITA } = require("../etiquetas");

// Citas por modulo y estado en el periodo.
function seccionCitas(citas, p) {
  const enRango = citas.filter((c) => p.enActual(c.horario?.fecha));
  const estadosDe = (lista) => {
    const conteo = contarPor(lista, (c) => c.estado);
    const fila = Object.fromEntries(ESTADOS_CITA.map((e) => [e, conteo[e] || 0]));
    return { ...fila, total: lista.length, tasaAsistencia: tasa(fila.Atendida, fila.Atendida + fila.NoAsistio) };
  };
  const dh = enRango.filter((c) => c.modulo === "desarrollo-humano");
  const salud = enRango.filter((c) => c.modulo === "salud");
  return {
    total: dh.length + salud.length,
    anterior: citas.filter((c) => p.enAnterior(c.horario?.fecha)).length,
    porModulo: { "desarrollo-humano": estadosDe(dh), salud: estadosDe(salud) },
  };
}

// Eventos de Desarrollo Humano: inscripciones hechas en el periodo (por la
// fecha en que la persona se inscribio) y eventos del periodo, con
// inscripciones en el o proximos.
function seccionEventos(eventos, inscripciones, p) {
  const publicados = eventos.filter((e) => ["Publicado", "Cerrado"].includes(e.estado));
  const idsPublicados = new Set(publicados.map((e) => e.id));
  const confirmadas = inscripciones.filter((i) => i.estado === "Confirmada" && idsPublicados.has(i.eventoId));
  const inscRango = confirmadas.filter((i) => p.enActual(aDiaBogota(i.fechaInscripcion)));
  const conInscripcion = new Set(inscRango.map((i) => i.eventoId));
  const hoyDia = aDia(new Date(Date.now() - 5 * 3600 * 1000));
  const eventosRango = publicados.filter((e) => p.enActual(e.fecha) || conInscripcion.has(e.id) || aDia(e.fecha) >= hoyDia);
  const idsEventos = new Set(eventosRango.map((e) => e.id));
  const inscEventos = confirmadas.filter((i) => idsEventos.has(i.eventoId));

  const porEvento = new Map();
  for (const i of inscEventos) {
    const r = porEvento.get(i.eventoId) || { inscritos: 0, asistieron: 0, registrados: 0 };
    r.inscritos += 1;
    if (i.asistencia) {
      r.registrados += 1;
      if (i.asistencia.asistio) r.asistieron += 1;
    }
    porEvento.set(i.eventoId, r);
  }
  const detalle = eventosRango
    .map((e) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, cupos: e.cupos, ...(porEvento.get(e.id) || { inscritos: 0, asistieron: 0, registrados: 0 }) }))
    .sort((a, b) => b.inscritos - a.inscritos);
  const suma = (campo) => detalle.reduce((s, e) => s + e[campo], 0);
  const cupos = suma("cupos");
  const inscAnt = inscripciones.filter((i) => i.estado === "Confirmada" && p.enAnterior(aDiaBogota(i.fechaInscripcion))).length;

  return {
    inscritos: inscRango.length,
    inscritosAnterior: inscAnt,
    resumen: {
      total: detalle.length,
      inscritos: inscRango.length,
      cupos,
      ocupacion: tasa(inscEventos.length, cupos),
      tasaAsistencia: tasa(suma("asistieron"), suma("registrados")),
      top: detalle.slice(0, 6).map(({ id, nombre, cupos: c, inscritos, asistieron }) => ({ id, nombre, cupos: c, inscritos, asistieron })),
    },
  };
}

module.exports = { seccionCitas, seccionEventos };
