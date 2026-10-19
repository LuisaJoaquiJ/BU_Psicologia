// Informe descargable (RF-015): arma, a partir de las filas consultadas y de
// las estadisticas del dashboard, todas las tablas que luego se exportan a
// Excel y a PDF. Funcion pura: se prueba sin base de datos.

const { intervaloWilson } = require("./analitica");

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ESTADO_CITA = { Agendada: "Agendada", Atendida: "Atendida", NoAsistio: "No asistió", Cancelada: "Cancelada" };

const proporcion = (parte, total) => (total > 0 ? parte / total : null);

function fechaISO(valor) {
  return valor ? new Date(valor).toISOString().slice(0, 10) : "";
}

function horaTexto(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function contadorCitas() {
  return { total: 0, atendidas: 0, noAsistieron: 0, canceladas: 0, agendadas: 0 };
}

function sumarCita(grupo, estado) {
  grupo.total += 1;
  if (estado === "Atendida") grupo.atendidas += 1;
  if (estado === "NoAsistio") grupo.noAsistieron += 1;
  if (estado === "Cancelada") grupo.canceladas += 1;
  if (estado === "Agendada") grupo.agendadas += 1;
}

function conTasas(grupo) {
  return {
    ...grupo,
    tasaAsistencia: proporcion(grupo.atendidas, grupo.atendidas + grupo.noAsistieron),
    tasaCancelacion: proporcion(grupo.canceladas, grupo.total),
  };
}

// Agrupa citas por una clave y devuelve filas con totales y tasas.
function agrupar(citas, claveDe, ordenar) {
  const grupos = new Map();
  for (const cita of citas) {
    const clave = claveDe(cita);
    if (clave === null || clave === undefined) continue;
    if (!grupos.has(clave)) grupos.set(clave, contadorCitas());
    sumarCita(grupos.get(clave), cita.estado);
  }
  const filas = [...grupos.entries()].map(([clave, g]) => ({ clave, ...conTasas(g) }));
  return ordenar ? filas.sort(ordenar) : filas;
}

function detalleCitas(citas) {
  return citas
    .map((c) => ({
      fecha: fechaISO(c.horario?.fecha),
      dia: c.horario?.fecha ? DIAS[new Date(c.horario.fecha).getUTCDay()] : "",
      hora: horaTexto(c.horario?.horaInicio),
      servicio: c.horario?.servicio?.nombre || "Sin servicio",
      estudiante: c.usuario?.nombre || "",
      correo: c.usuario?.emailInstitucional || "",
      estado: ESTADO_CITA[c.estado] || c.estado,
      agendadaEl: fechaISO(c.fechaAgendamiento),
    }))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

function asistentesEventos(eventos) {
  const filas = [];
  for (const evento of eventos) {
    for (const ins of evento.inscripciones || []) {
      let asistencia = "Sin registrar";
      if (ins.asistencia?.asistio === true) asistencia = "Asistió";
      if (ins.asistencia?.asistio === false) asistencia = "No asistió";
      filas.push({
        evento: evento.nombre,
        fecha: fechaISO(evento.fecha),
        estudiante: ins.usuario?.nombre || "",
        correo: ins.usuario?.emailInstitucional || "",
        inscritoEl: fechaISO(ins.fechaInscripcion),
        asistencia,
      });
    }
  }
  return filas;
}

// Resumen por estudiante: citas y eventos. Sirve para seguimiento
// (estudiantes con varias inasistencias) y para ver la recurrencia.
function resumenEstudiantes(citas, eventos) {
  const porId = new Map();
  const fila = (usuario, id) => {
    const clave = usuario?.id || id;
    if (!porId.has(clave)) {
      porId.set(clave, {
        estudiante: usuario?.nombre || "",
        correo: usuario?.emailInstitucional || "",
        citas: 0,
        atendidas: 0,
        noAsistieron: 0,
        canceladas: 0,
        eventosInscritos: 0,
        eventosAsistidos: 0,
        eventosNoAsistidos: 0,
      });
    }
    return porId.get(clave);
  };
  for (const c of citas) {
    const f = fila(c.usuario, c.usuarioId);
    f.citas += 1;
    if (c.estado === "Atendida") f.atendidas += 1;
    if (c.estado === "NoAsistio") f.noAsistieron += 1;
    if (c.estado === "Cancelada") f.canceladas += 1;
  }
  for (const e of eventos) {
    for (const ins of e.inscripciones || []) {
      const f = fila(ins.usuario, ins.usuarioId);
      f.eventosInscritos += 1;
      if (ins.asistencia?.asistio === true) f.eventosAsistidos += 1;
      if (ins.asistencia?.asistio === false) f.eventosNoAsistidos += 1;
    }
  }
  return [...porId.values()]
    .map((f) => ({
      ...f,
      inasistencias: f.noAsistieron + f.eventosNoAsistidos,
      tasaAsistencia: proporcion(
        f.atendidas + f.eventosAsistidos,
        f.atendidas + f.noAsistieron + f.eventosAsistidos + f.eventosNoAsistidos
      ),
    }))
    .sort((a, b) => b.citas + b.eventosInscritos - (a.citas + a.eventosInscritos) || a.estudiante.localeCompare(b.estudiante));
}

function ocupacionPorServicio(horarios) {
  const grupos = new Map();
  for (const h of horarios) {
    const nombre = h.servicio?.nombre || "Sin servicio";
    if (!grupos.has(nombre)) grupos.set(nombre, { servicio: nombre, publicados: 0, ocupados: 0 });
    const g = grupos.get(nombre);
    g.publicados += 1;
    if (h.ocupado) g.ocupados += 1;
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, libres: g.publicados - g.ocupados, ocupacion: proporcion(g.ocupados, g.publicados) }))
    .sort((a, b) => b.publicados - a.publicados);
}

const dec = (x) => x.toLocaleString("es-CO", { maximumFractionDigits: 1 });
const pct = (x) => `${(x * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

// Conclusiones automaticas, en lenguaje sencillo, para el informe.
function conclusiones({ resumenCitas, resumenEventos, porDia, porServicio, porHora, estudiantes, probabilidades }) {
  const lista = [];
  const conBase = (f) => f.atendidas + f.noAsistieron >= 3;

  if (resumenCitas.total === 0 && resumenEventos.eventos === 0) {
    return ["No hay citas ni eventos en el periodo seleccionado."];
  }
  if (probabilidades.asistenciaCita.probabilidad !== null) {
    const p = probabilidades.asistenciaCita;
    lista.push(
      `De cada 10 citas con asistencia registrada, cerca de ${Math.round(p.probabilidad / 10)} se atendieron ` +
        `(${dec(p.probabilidad)} %; con 95 % de confianza, entre ${dec(p.bajo)} % y ${dec(p.alto)} %).`
    );
  }
  const masDemanda = [...porDia].sort((a, b) => b.total - a.total)[0];
  if (masDemanda && masDemanda.total > 0) {
    lista.push(`El día con más citas es el ${masDemanda.clave.toLowerCase()} (${masDemanda.total} citas).`);
  }
  const dias = porDia.filter(conBase).sort((a, b) => a.tasaAsistencia - b.tasaAsistencia);
  if (dias.length >= 2 && dias[0].tasaAsistencia < dias[dias.length - 1].tasaAsistencia) {
    lista.push(
      `La asistencia más baja se da el ${dias[0].clave.toLowerCase()} (${pct(dias[0].tasaAsistencia)}); ` +
        "conviene reforzar los recordatorios ese día."
    );
  }
  const horaPico = [...porHora].sort((a, b) => b.total - a.total)[0];
  if (horaPico && horaPico.total > 0) lista.push(`La franja más solicitada empieza a las ${horaPico.clave} (${horaPico.total} citas).`);
  if (porServicio[0]) lista.push(`El servicio más solicitado es ${porServicio[0].servicio} (${porServicio[0].total} citas).`);
  if (resumenCitas.agendadas > 0) {
    lista.push(`Hay ${resumenCitas.agendadas} citas agendadas sin asistencia registrada todavía.`);
  }
  if (resumenEventos.eventos > 0) {
    lista.push(
      `En ${resumenEventos.eventos} eventos se inscribieron ${resumenEventos.inscritos} estudiantes: ` +
        `${resumenEventos.asistieron} asistieron, ${resumenEventos.noAsistieron} no asistieron ` +
        `y ${resumenEventos.sinRegistrar} siguen sin registro.`
    );
  }
  const seguimiento = estudiantes.filter((e) => e.inasistencias >= 2).length;
  if (seguimiento > 0) {
    lista.push(`${seguimiento} estudiante(s) acumulan 2 o más inasistencias; se listan para seguimiento.`);
  }
  return lista;
}

function construirInforme({ citas, eventos, horarios }, estadisticas) {
  const porDia = [1, 2, 3, 4, 5, 6].map((d) => {
    const delDia = citas.filter((c) => c.horario?.fecha && new Date(c.horario.fecha).getUTCDay() === d);
    const g = contadorCitas();
    delDia.forEach((c) => sumarCita(g, c.estado));
    const ic = intervaloWilson(g.atendidas, g.atendidas + g.noAsistieron);
    return { clave: DIAS[d], ...conTasas(g), icBajo: ic.bajo, icAlto: ic.alto };
  });

  const porHora = agrupar(
    citas,
    (c) => (c.horario?.horaInicio ? `${String(new Date(c.horario.horaInicio).getUTCHours()).padStart(2, "0")}:00` : null),
    (a, b) => a.clave.localeCompare(b.clave)
  );

  const porMes = agrupar(
    citas,
    (c) => (c.horario?.fecha ? fechaISO(c.horario.fecha).slice(0, 7) : null),
    (a, b) => a.clave.localeCompare(b.clave)
  ).map((f) => ({ ...f, mes: `${MESES[Number(f.clave.slice(5, 7)) - 1]} ${f.clave.slice(0, 4)}` }));

  const porServicio = agrupar(citas, (c) => c.horario?.servicio?.nombre || "Sin servicio", (a, b) => b.total - a.total).map(
    ({ clave, ...resto }) => ({ servicio: clave, ...resto })
  );

  const eventosDetalle = estadisticas.eventosDetalle.map((e) => ({
    ...e,
    fecha: fechaISO(e.fecha),
    ocupacion: e.ocupacion === null ? null : e.ocupacion / 100,
    tasaAsistencia: e.tasaAsistencia === null ? null : e.tasaAsistencia / 100,
  }));

  const resumenCitas = conTasas({
    total: estadisticas.citas.total,
    atendidas: estadisticas.citas.atendidas,
    noAsistieron: estadisticas.citas.noAsistieron,
    canceladas: estadisticas.citas.canceladas,
    agendadas: estadisticas.citas.agendadas,
  });
  const resumenEventos = {
    ...estadisticas.eventos,
    tasaAsistencia: estadisticas.eventos.tasaAsistencia === null ? null : estadisticas.eventos.tasaAsistencia / 100,
  };
  const estudiantes = resumenEstudiantes(citas, eventos);

  return {
    generado: new Date(),
    filtro: estadisticas.filtro,
    hayDatos: estadisticas.hayDatos,
    resumen: {
      citas: resumenCitas,
      eventos: resumenEventos,
      estudiantesRegistrados: estadisticas.estudiantesRegistrados,
      participacion: estadisticas.participacion,
      ocupacionHorarios: estadisticas.ocupacionHorarios,
    },
    probabilidades: estadisticas.probabilidades,
    citasPorServicio: porServicio,
    citasPorDia: porDia,
    citasPorHora: porHora,
    citasPorMes: porMes,
    tendenciaSemanal: estadisticas.tendenciaSemanal,
    ocupacionPorServicio: ocupacionPorServicio(horarios),
    eventos: eventosDetalle,
    asistentesEventos: asistentesEventos(eventos),
    detalleCitas: detalleCitas(citas),
    estudiantes,
    seguimiento: estudiantes.filter((e) => e.inasistencias >= 2).sort((a, b) => b.inasistencias - a.inasistencias),
    conclusiones: conclusiones({
      resumenCitas,
      resumenEventos,
      porDia,
      porServicio,
      porHora,
      estudiantes,
      probabilidades: estadisticas.probabilidades,
    }),
  };
}

module.exports = { construirInforme, fechaISO };
