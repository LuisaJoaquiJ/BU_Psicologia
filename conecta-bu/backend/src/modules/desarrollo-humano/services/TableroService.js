const { EstadisticaRepository } = require("../repositories/EstadisticaRepository");
const { crearPeriodo, variacion, mesActual, aDia, aDiaBogota, iso, hoyUTC } = require("../utils/periodos");

// Tablero de Desarrollo Humano: lo esencial de un vistazo, comparado con el
// periodo anterior de la misma duracion (semana, mes, trimestre o año).

const ESTADOS = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const tasa = (parte, total) => (total ? Math.round((parte / total) * 1000) / 10 : null);
const primerNombre = (n) => String(n || "Un estudiante").split(" ")[0];

function contarEstados(citas) {
  const c = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  for (const x of citas) c[x.estado] = (c[x.estado] || 0) + 1;
  return { ...c, total: citas.length, tasaAsistencia: tasa(c.Atendida, c.Atendida + c.NoAsistio) };
}

class TableroService {
  constructor(repo = new EstadisticaRepository()) {
    this.repo = repo;
  }

  async tablero({ periodo } = {}) {
    const p = crearPeriodo(periodo);
    const { citas, eventos, inscripciones } = await this.repo.datosTablero();
    const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
    const inscritas = inscripciones.filter((i) => eventoPorId.has(i.eventoId));

    const citasAct = citas.filter((c) => p.enActual(c.horario?.fecha));
    const citasAnt = citas.filter((c) => p.enAnterior(c.horario?.fecha));
    const inscAct = inscritas.filter((i) => p.enActual(aDiaBogota(i.fechaInscripcion)));
    const inscAnt = inscritas.filter((i) => p.enAnterior(aDiaBogota(i.fechaInscripcion)));
    const estAct = contarEstados(citasAct);
    const estAnt = contarEstados(citasAnt);

    const personas = (cs, is) =>
      new Set([...cs.filter((c) => c.estado !== "Cancelada").map((c) => c.usuarioId), ...is.map((i) => i.usuarioId)]).size;
    const personasAct = personas(citasAct, inscAct);
    const personasAnt = personas(citasAnt, inscAnt);

    // Serie por cubeta (dia, semana o mes) para las graficas y las mini lineas.
    const serie = p.cubetas.map((c) => ({ ...c, ...Object.fromEntries(ESTADOS.map((e) => [e, 0])), inscritos: 0, personas: 0 }));
    const porClave = new Map(serie.map((s) => [s.clave, s]));
    const personasPorCubeta = new Map();
    for (const c of citasAct) {
      const k = p.cubetaDe(c.horario?.fecha);
      if (!k) continue;
      porClave.get(k)[c.estado] += 1;
      if (c.estado !== "Cancelada") (personasPorCubeta.get(k) || personasPorCubeta.set(k, new Set()).get(k)).add(c.usuarioId);
    }
    for (const i of inscAct) {
      const k = p.cubetaDe(aDiaBogota(i.fechaInscripcion));
      if (!k) continue;
      porClave.get(k).inscritos += 1;
      (personasPorCubeta.get(k) || personasPorCubeta.set(k, new Set()).get(k)).add(i.usuarioId);
    }
    for (const s of serie) s.personas = personasPorCubeta.get(s.clave)?.size || 0;
    const citasSerie = serie.map((s) => s.Atendida + s.NoAsistio + s.Agendada + s.Cancelada);
    const asistSerie = serie.map((s) => tasa(s.Atendida, s.Atendida + s.NoAsistio));

    // Servicios mas pedidos en el periodo.
    const servicios = new Map();
    for (const c of citasAct) {
      const n = c.horario?.servicio?.nombre || "Sin servicio";
      const r = servicios.get(n) || { nombre: n, total: 0, atendidas: 0 };
      r.total += 1;
      if (c.estado === "Atendida") r.atendidas += 1;
      servicios.set(n, r);
    }

    // Calendario del mes en curso: citas y eventos por dia.
    const mes = mesActual();
    const dias = {};
    const marcar = (fecha, campo) => {
      const d = aDia(fecha);
      if (!d || d < mes.desde || d > mes.hasta) return;
      const k = iso(d);
      dias[k] = dias[k] || { citas: 0, eventos: 0 };
      dias[k][campo] += 1;
    };
    for (const c of citas) if (c.estado !== "Cancelada") marcar(c.horario?.fecha, "citas");
    for (const e of eventos) marcar(e.fecha, "eventos");

    // Proximos eventos con su ocupacion.
    const hoy = hoyUTC();
    const inscritosPorEvento = new Map();
    for (const i of inscritas) inscritosPorEvento.set(i.eventoId, (inscritosPorEvento.get(i.eventoId) || 0) + 1);
    const proximos = eventos
      .filter((e) => aDia(e.fecha) >= hoy)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .slice(0, 5)
      .map((e) => ({ id: e.id, nombre: e.nombre, fecha: iso(aDia(e.fecha)), lugar: e.lugar, estado: e.estado, cupos: e.cupos, inscritos: inscritosPorEvento.get(e.id) || 0 }));

    // Actividad reciente: citas agendadas o canceladas e inscripciones.
    const actividad = [
      ...citas.map((c) =>
        c.estado === "Cancelada"
          ? { tipo: "cancelada", fecha: c.fechaActualizacion || c.fechaAgendamiento, texto: `${primerNombre(c.usuario?.nombre)} canceló su cita`, detalle: c.horario?.servicio?.nombre }
          : {
              tipo: "cita",
              fecha: c.fechaAgendamiento,
              texto: `${primerNombre(c.usuario?.nombre)} ${c.horario?.sinCita ? "fue atendido sin cita" : "agendó una cita"}`,
              detalle: c.horario?.servicio?.nombre,
            }
      ),
      ...inscritas.map((i) => ({
        tipo: "inscripcion",
        fecha: i.fechaInscripcion,
        texto: `${primerNombre(i.usuario?.nombre)} se inscribió a un evento`,
        detalle: eventoPorId.get(i.eventoId)?.nombre,
      })),
    ]
      .filter((a) => a.fecha)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 8)
      .map((a) => ({ ...a, fecha: new Date(a.fecha).toISOString() }));

    return {
      periodo: p.periodo,
      texto: p.texto,
      textoAnterior: p.textoAnterior,
      desde: p.desde,
      hasta: p.hasta,
      kpis: [
        { id: "citas", titulo: "Citas", valor: estAct.total, anterior: estAnt.total, variacion: variacion(estAct.total, estAnt.total), serie: citasSerie },
        {
          id: "asistencia",
          titulo: "Asistencia a citas",
          valor: estAct.tasaAsistencia,
          anterior: estAnt.tasaAsistencia,
          unidad: "%",
          // En porcentajes la comparacion va en puntos (81 % -> 85 % = +4 puntos).
          puntos: estAct.tasaAsistencia !== null && estAnt.tasaAsistencia !== null ? Math.round((estAct.tasaAsistencia - estAnt.tasaAsistencia) * 10) / 10 : null,
          serie: asistSerie,
        },
        { id: "inscritos", titulo: "Inscripciones a eventos", valor: inscAct.length, anterior: inscAnt.length, variacion: variacion(inscAct.length, inscAnt.length), serie: serie.map((s) => s.inscritos) },
        { id: "personas", titulo: "Estudiantes atendidos", valor: personasAct, anterior: personasAnt, variacion: variacion(personasAct, personasAnt), serie: serie.map((s) => s.personas) },
      ],
      serie,
      estados: estAct,
      servicios: [...servicios.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      calendario: { mes: mes.clave, hoy: mes.hoy, dias },
      proximosEventos: proximos,
      actividad,
    };
  }
}

module.exports = { TableroService, tableroService: new TableroService(), contarEstados };
