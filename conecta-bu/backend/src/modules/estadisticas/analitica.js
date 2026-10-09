// Calculos estadisticos del dashboard administrativo (RF-015, ampliado).
// Funciones puras: reciben las filas ya consultadas y devuelven indicadores,
// asi se pueden probar sin base de datos.

const DIA_MS = 24 * 60 * 60 * 1000;
const NOMBRES_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ESTADOS = ["Agendada", "Atendida", "NoAsistio", "Cancelada"];

const redondear = (x) => Math.round(x * 1000) / 10; // proporcion -> % con 1 decimal

// Proporcion con intervalo de confianza de Wilson al 95 %. Es mas honesto que
// "p ± error" cuando hay pocos datos: con 3 citas el intervalo sale ancho y el
// panel lo muestra asi, en vez de presentar un porcentaje como si fuera exacto.
function intervaloWilson(exitos, n, z = 1.96) {
  if (!n) return { probabilidad: null, bajo: null, alto: null, n: 0 };
  const p = exitos / n;
  const z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margen = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return {
    probabilidad: redondear(p),
    bajo: redondear(Math.max(0, centro - margen)),
    alto: redondear(Math.min(1, centro + margen)),
    n,
  };
}

function lunesDe(fecha) {
  const d = new Date(fecha);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dia = new Date(base).getUTCDay(); // 0 = domingo
  return new Date(base - ((dia + 6) % 7) * DIA_MS);
}

// Citas por semana (lunes a domingo) y por estado.
function tendenciaSemanal(citas, { desde, hasta, hoy = new Date() } = {}) {
  let inicio;
  let fin;
  if (desde || hasta) {
    inicio = lunesDe(desde || hasta);
    fin = lunesDe(hasta || desde);
  } else {
    // Sin filtro: 9 semanas atras, la actual y 2 hacia adelante (citas agendadas).
    const actual = lunesDe(hoy);
    inicio = new Date(actual.getTime() - 9 * 7 * DIA_MS);
    fin = new Date(actual.getTime() + 2 * 7 * DIA_MS);
  }
  const semanas = [];
  for (let t = inicio.getTime(); t <= fin.getTime() && semanas.length < 26; t += 7 * DIA_MS) {
    const fila = { semana: new Date(t).toISOString().slice(0, 10), total: 0 };
    ESTADOS.forEach((e) => (fila[e] = 0));
    semanas.push(fila);
  }
  const indice = new Map(semanas.map((s, i) => [s.semana, i]));
  for (const cita of citas) {
    if (!cita.horario?.fecha) continue;
    const clave = lunesDe(cita.horario.fecha).toISOString().slice(0, 10);
    const i = indice.get(clave);
    if (i === undefined) continue;
    semanas[i][cita.estado] = (semanas[i][cita.estado] || 0) + 1;
    semanas[i].total += 1;
  }
  return semanas;
}

// Demanda por dia de la semana y hora de inicio (excluye canceladas).
function mapaDemanda(citas) {
  const dias = [1, 2, 3, 4, 5, 6];
  const horas = [];
  for (let h = 7; h <= 18; h += 1) horas.push(h);
  const celdas = dias.map(() => horas.map(() => 0));
  let maximo = 0;
  for (const cita of citas) {
    if (cita.estado === "Cancelada" || !cita.horario?.fecha || !cita.horario?.horaInicio) continue;
    const dia = new Date(cita.horario.fecha).getUTCDay();
    const hora = new Date(cita.horario.horaInicio).getUTCHours();
    const fila = dias.indexOf(dia);
    const col = horas.indexOf(hora);
    if (fila === -1 || col === -1) continue;
    celdas[fila][col] += 1;
    maximo = Math.max(maximo, celdas[fila][col]);
  }
  return { dias: dias.map((d) => NOMBRES_DIA[d]), horas, celdas, maximo };
}

// Probabilidades estimadas a partir del historico registrado.
function calcularProbabilidades(citas, eventos) {
  const atendidas = citas.filter((c) => c.estado === "Atendida").length;
  const noAsistio = citas.filter((c) => c.estado === "NoAsistio").length;
  const canceladas = citas.filter((c) => c.estado === "Cancelada").length;

  const inscripciones = eventos.flatMap((e) => e.inscripciones || []);
  const conAsistencia = inscripciones.filter((i) => i.asistencia);
  const asistieronEvento = conAsistencia.filter((i) => i.asistencia.asistio === true).length;

  // Asistencia a citas segun el dia de la semana: ayuda a ver en que dias se
  // falta mas y conviene reforzar recordatorios.
  const porDia = [1, 2, 3, 4, 5, 6].map((d) => {
    const delDia = citas.filter((c) => c.horario?.fecha && new Date(c.horario.fecha).getUTCDay() === d);
    const ok = delDia.filter((c) => c.estado === "Atendida").length;
    const falta = delDia.filter((c) => c.estado === "NoAsistio").length;
    return { dia: NOMBRES_DIA[d], ...intervaloWilson(ok, ok + falta) };
  });

  return {
    asistenciaCita: intervaloWilson(atendidas, atendidas + noAsistio),
    cancelacionCita: intervaloWilson(canceladas, citas.length),
    asistenciaEvento: intervaloWilson(asistieronEvento, conAsistencia.length),
    asistenciaCitaPorDia: porDia,
  };
}

// Participacion: estudiantes distintos que usaron citas o eventos, y cuantos repiten.
function calcularParticipacion(citas, eventos, estudiantesRegistrados) {
  const porEstudiante = new Map();
  for (const cita of citas) {
    if (cita.estado === "Cancelada") continue;
    porEstudiante.set(cita.usuarioId, (porEstudiante.get(cita.usuarioId) || 0) + 1);
  }
  const conEvento = new Set(eventos.flatMap((e) => (e.inscripciones || []).map((i) => i.usuarioId)));
  const activos = new Set([...porEstudiante.keys(), ...conEvento]);
  const recurrentes = [...porEstudiante.values()].filter((n) => n >= 2).length;
  return {
    estudiantesActivos: activos.size,
    alcance: estudiantesRegistrados ? redondear(activos.size / estudiantesRegistrados) : null,
    recurrentes,
    tasaRecurrencia: porEstudiante.size ? redondear(recurrentes / porEstudiante.size) : null,
  };
}

function calcularOcupacionHorarios(horarios) {
  const total = horarios.length;
  const ocupados = horarios.filter((h) => h.ocupado).length;
  return { total, ocupados, libres: total - ocupados, porcentaje: total ? redondear(ocupados / total) : null };
}

module.exports = {
  intervaloWilson,
  tendenciaSemanal,
  mapaDemanda,
  calcularProbabilidades,
  calcularParticipacion,
  calcularOcupacionHorarios,
  lunesDe,
};
