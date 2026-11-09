// Asistente de Conecta BU: datos de los otros modulos (Deporte, Salud y Arte y
// Cultura) para responder sobre toda la plataforma, no solo Orientacion.
// Igual que con Orientacion, solo viaja lo que el estudiante ya ve en su area:
// la oferta publicada y sus propias inscripciones, nunca datos de otros.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const RUTAS = {
  deporteOferta: { texto: "Grupos de deporte", ruta: "/mi-deporte/oferta" },
  deporteHoras: { texto: "Mis horas de deporte", ruta: "/mi-deporte/horas" },
  deporteEventos: { texto: "Eventos deportivos", ruta: "/mi-deporte/eventos" },
  saludJornadas: { texto: "Jornadas de salud", ruta: "/mi-salud/jornadas" },
  saludSalidas: { texto: "Salidas", ruta: "/mi-salud/salidas" },
  culturaGrupos: { texto: "Grupos de cultura", ruta: "/mi-cultura/grupos" },
  culturaAgenda: { texto: "Agenda cultural", ruta: "/mi-cultura/agenda" },
  culturaConvocatorias: { texto: "Convocatorias", ruta: "/mi-cultura/convocatorias" },
};

// "2026-11-08" -> "domingo 8 de noviembre" (las fechas llegan como texto ISO).
function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

// [{dia:1, inicio:"16:00", fin:"18:00"}] -> "lunes 16:00-18:00"
function horarioTexto(horario) {
  if (!Array.isArray(horario) || !horario.length) return "horario por definir";
  return horario.map((h) => `${DIAS[h.dia] || ""} ${h.inicio}-${h.fin}`.trim()).join(", ");
}

// Cada modulo se consulta por separado: si uno falla, el asistente sigue
// respondiendo con los demas.
async function intentar(nombre, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[asistente] No se pudo leer ${nombre}: ${err.message}`);
    return null;
  }
}

async function contextoDeporte(usuario) {
  const inscripciones = require("../../deporte/services/InscripcionService");
  const horas = require("../../deporte/services/HorasService");
  const eventos = require("../../deporte/services/EventoEstudianteService");
  const [oferta, progreso, lista] = await Promise.all([inscripciones.oferta(usuario), horas.progresoDe(usuario.id), eventos.listar(usuario)]);
  const grupos = (oferta?.disciplinas || []).flatMap((d) =>
    (d.grupos || []).map((g) => ({
      disciplina: d.nombre,
      grupo: g.nombre,
      horario: g.horarioTexto || horarioTexto(g.horario),
      lugar: g.lugar || "Por definir",
      cuposDisponibles: g.cuposDisponibles,
      inscripcionAbierta: Boolean(g.inscripcionesAbiertas),
      inscrito: Boolean(g.inscrito),
    })),
  );
  return {
    periodo: oferta?.periodo,
    maxGrupos: oferta?.maxGruposPorPeriodo,
    inscritoEn: oferta?.inscritoEn || 0,
    disciplinasSinGrupo: (oferta?.disciplinas || []).filter((d) => !(d.grupos || []).length).map((d) => d.nombre),
    grupos: grupos.slice(0, 12),
    horas: progreso ? { requeridas: progreso.requeridas, cumplidas: progreso.total, faltan: progreso.faltan, cumplido: progreso.cumplido } : null,
    eventos: (lista || [])
      .filter((e) => !e.yaPaso)
      .slice(0, 6)
      .map((e) => ({
        nombre: e.nombre,
        disciplina: e.disciplina,
        fecha: fechaCorta(e.fecha),
        lugar: e.lugar || "Por definir",
        inscripcionAbierta: Boolean(e.inscripcionAbierta),
        inscrito: Boolean(e.inscrito),
      })),
  };
}

async function contextoSalud(usuario) {
  const { jornadaService } = require("../../salud/services/JornadaService");
  const { inscripcionSalidaService } = require("../../salud/services/InscripcionSalidaService");
  const [jornadas, salidas] = await Promise.all([jornadaService.paraEstudiante(usuario), inscripcionSalidaService.paraEstudiante(usuario)]);
  return {
    jornadas: (jornadas?.jornadas || []).slice(0, 6).map((j) => ({
      nombre: j.nombre,
      tipo: j.categoria,
      fecha: j.fechaInicio === j.fechaFin ? fechaCorta(j.fechaInicio) : `${fechaCorta(j.fechaInicio)} al ${fechaCorta(j.fechaFin)}`,
      hora: j.horaInicio && j.horaFin ? `${j.horaInicio} a ${j.horaFin}` : null,
      lugar: j.lugar || "Por definir",
      cuposDisponibles: j.cuposDisponibles,
      inscrito: Boolean(j.inscrito),
    })),
    salidas: (salidas?.salidas || []).slice(0, 6).map((s) => ({
      nombre: s.nombre,
      destino: s.destino,
      fechaSalida: fechaCorta(s.fechaSalida),
      cierraInscripcion: fechaCorta(s.fechaLimiteInscripcion),
      cuposDisponibles: s.cuposDisponibles,
      inscripcionAbierta: Boolean(s.inscripcionAbierta),
      miSolicitud: s.miInscripcion?.estado || null,
    })),
  };
}

async function contextoCultura(usuario) {
  const cultura = require("../../cultura/cultura.service");
  const [oferta, agenda, convocatorias] = await Promise.all([
    cultura.ofertaGrupos(usuario.id),
    cultura.listarAgenda(usuario.id),
    cultura.listarConvocatorias(usuario.id),
  ]);
  const grupos = (oferta?.areas || []).flatMap((a) =>
    (a.grupos || []).map((g) => ({
      nombre: g.nombre,
      tipo: g.ingreso === "audicion" ? "Grupo representativo (se entra por audición)" : "Taller de formación",
      horario: horarioTexto(g.horario),
      lugar: g.lugar || "Por definir",
      director: g.director || null,
      cuposDisponibles: g.ingreso === "audicion" ? null : g.cuposDisponibles,
      audicionAbierta: g.audicion ? `cierra el ${fechaCorta(g.audicion.cierra)}` : null,
      inscrito: Boolean(g.inscrito),
    })),
  );
  return {
    periodo: oferta?.periodo,
    maxTalleres: oferta?.maxGrupos,
    talleresInscritos: oferta?.inscritas || 0,
    grupos: grupos.slice(0, 14),
    agenda: (agenda || []).slice(0, 6).map((e) => ({
      nombre: e.nombre,
      fecha: fechaCorta(e.fecha),
      hora: e.horaInicio && e.horaFin ? `${e.horaInicio} a ${e.horaFin}` : null,
      lugar: e.lugar || "Por definir",
      inscripcionAbierta: Boolean(e.abierta),
      inscrito: Boolean(e.inscrito),
    })),
    convocatorias: (convocatorias || []).slice(0, 4).map((c) => ({
      titulo: c.titulo,
      grupo: c.grupo,
      cierra: fechaCorta(c.cierra),
      yaEresMiembro: Boolean(c.esMiembro),
      miPostulacion: c.postulacion?.estado || null,
    })),
  };
}

async function contextoModulos(usuario) {
  const [deporte, salud, cultura] = await Promise.all([
    intentar("Deporte", () => contextoDeporte(usuario)),
    intentar("Salud", () => contextoSalud(usuario)),
    intentar("Arte y Cultura", () => contextoCultura(usuario)),
  ]);
  return { deporte, salud, cultura };
}

// --- Respuestas locales (sin IA) ---------------------------------------------

const listar = (items) => items.map((x) => `• ${x}`).join("\n");

const PALABRAS = {
  cultura: ["cultura", "cultural", "arte", "artistic", "danza", "baile", "musica", "teatro", "banda", "guitarra", "canto", "coro", "pintura", "audicion", "convocatoria", "casting"],
  deporte: ["deporte", "deportiv", "futbol", "baloncesto", "voleibol", "voley", "ajedrez", "natacion", "gimnasio", "entren", "disciplina", "horas de deporte", "mis horas"],
  salud: ["salud", "jornada", "vacun", "campana", "medic", "enfermer", "odontolog", "tamizaje", "salida", "excursion", "viaje"],
};

// Modulo del que habla la pregunta (o null si es de Orientacion / general).
function moduloDe(textoNormalizado) {
  const puntos = Object.entries(PALABRAS).map(([modulo, palabras]) => [modulo, palabras.filter((p) => textoNormalizado.includes(p)).length]);
  const [modulo, n] = puntos.sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? modulo : null;
}

const sinDatos = (nombre) => ({
  respuesta: `En este momento no pude consultar ${nombre}. Intenta de nuevo en un rato o entra directamente a esa sección.`,
});

function responderCultura(t, c) {
  if (!c) return { ...sinDatos("Arte y Cultura"), sugerencias: [RUTAS.culturaGrupos] };
  const tiene = (...p) => p.some((x) => t.includes(x));
  if (tiene("convocatoria", "audicion", "casting", "postul")) {
    if (!c.convocatorias.length) return { respuesta: "Ahora no hay convocatorias abiertas en Arte y Cultura. Cuando abra una audición la verás en «Convocatorias».", sugerencias: [RUTAS.culturaConvocatorias] };
    return {
      respuesta: `Convocatorias abiertas:\n${listar(
        c.convocatorias.map((x) => `${x.titulo}${x.grupo ? ` (entrada a ${x.grupo})` : ""}, cierra el ${x.cierra}${x.yaEresMiembro ? " · ya eres parte del grupo" : x.miPostulacion ? ` · tu postulación: ${x.miPostulacion}` : ""}`),
      )}\n\nSi te aceptan en una audición, quedas inscrito/a en el grupo automáticamente.`,
      sugerencias: [RUTAS.culturaConvocatorias],
    };
  }
  if (tiene("evento", "agenda", "presentacion", "concierto", "festival", "muestra")) {
    if (!c.agenda.length) return { respuesta: "Por ahora no hay eventos en la agenda cultural.", sugerencias: [RUTAS.culturaAgenda] };
    return {
      respuesta: `Próximos eventos de Arte y Cultura:\n${listar(c.agenda.map((e) => `${e.nombre}: ${e.fecha}${e.hora ? `, ${e.hora}` : ""}, ${e.lugar}${e.inscrito ? " · ya estás inscrito/a" : ""}`))}`,
      sugerencias: [RUTAS.culturaAgenda],
    };
  }
  const mios = c.grupos.filter((g) => g.inscrito);
  if (tiene("mis grupos", "estoy inscrit", "mi grupo", "mis talleres")) {
    return {
      respuesta: mios.length ? `Estás en:\n${listar(mios.map((g) => `${g.nombre}: ${g.horario}, ${g.lugar}`))}` : "Todavía no estás en ningún grupo de Arte y Cultura este periodo.",
      sugerencias: [RUTAS.culturaGrupos],
    };
  }
  const talleres = c.grupos.filter((g) => g.tipo.startsWith("Taller"));
  const representativos = c.grupos.filter((g) => !g.tipo.startsWith("Taller"));
  if (!c.grupos.length) return { respuesta: "Este periodo todavía no hay grupos de Arte y Cultura publicados.", sugerencias: [RUTAS.culturaGrupos] };
  const partes = [];
  if (talleres.length) partes.push(`Talleres de formación (inscripción libre, hasta ${c.maxTalleres} por periodo; llevas ${c.talleresInscritos}):\n${listar(talleres.map((g) => `${g.nombre}: ${g.horario}, ${g.lugar}${g.inscrito ? " · inscrito/a" : g.cuposDisponibles != null ? ` · ${g.cuposDisponibles} cupos` : ""}`))}`);
  if (representativos.length) partes.push(`Grupos representativos (se entra por audición):\n${listar(representativos.map((g) => `${g.nombre}${g.inscrito ? " · ya eres parte" : g.audicionAbierta ? ` · audición abierta, ${g.audicionAbierta}` : ""}`))}`);
  return { respuesta: `Grupos de Arte y Cultura ${c.periodo ? `(${c.periodo})` : ""}:\n\n${partes.join("\n\n")}`, sugerencias: [RUTAS.culturaGrupos, RUTAS.culturaConvocatorias] };
}

function responderDeporte(t, d) {
  if (!d) return { ...sinDatos("Deporte"), sugerencias: [RUTAS.deporteOferta] };
  const tiene = (...p) => p.some((x) => t.includes(x));
  if (tiene("horas")) {
    if (!d.horas) return { respuesta: "No pude leer tus horas de deporte ahora mismo.", sugerencias: [RUTAS.deporteHoras] };
    return {
      respuesta: d.horas.cumplido
        ? `¡Ya cumpliste tus ${d.horas.requeridas} horas de deporte! Llevas ${d.horas.cumplidas}. Puedes descargar la constancia en «Mis horas».`
        : `Llevas ${d.horas.cumplidas} de ${d.horas.requeridas} horas de deporte; te faltan ${d.horas.faltan}. Las horas se suman con la asistencia a tu grupo.`,
      sugerencias: [RUTAS.deporteHoras],
    };
  }
  if (tiene("evento", "torneo", "partido", "competen", "campeonato")) {
    if (!d.eventos.length) return { respuesta: "Por ahora no hay eventos deportivos próximos.", sugerencias: [RUTAS.deporteEventos] };
    return {
      respuesta: `Próximos eventos deportivos:\n${listar(d.eventos.map((e) => `${e.nombre}${e.disciplina ? ` (${e.disciplina})` : ""}: ${e.fecha}, ${e.lugar}${e.inscrito ? " · ya estás inscrito/a" : e.inscripcionAbierta ? "" : " · inscripción cerrada"}`))}`,
      sugerencias: [RUTAS.deporteEventos],
    };
  }
  if (!d.grupos.length) return { respuesta: "Este periodo todavía no hay grupos de deporte abiertos.", sugerencias: [RUTAS.deporteOferta] };
  return {
    respuesta: `Grupos de deporte ${d.periodo ? `(${d.periodo})` : ""} — puedes inscribirte hasta en ${d.maxGrupos} (llevas ${d.inscritoEn}):\n${listar(
      d.grupos.map((g) => `${g.grupo}: ${g.horario}, ${g.lugar}${g.inscrito ? " · inscrito/a" : g.inscripcionAbierta ? ` · ${g.cuposDisponibles} cupos` : " · inscripción cerrada"}`),
    )}`,
    sugerencias: [RUTAS.deporteOferta, RUTAS.deporteHoras],
  };
}

function responderSalud(t, s) {
  if (!s) return { ...sinDatos("Salud"), sugerencias: [RUTAS.saludJornadas] };
  if (["salida", "excursion", "viaje"].some((x) => t.includes(x))) {
    if (!s.salidas.length) return { respuesta: "Ahora no hay salidas publicadas por la Unidad de Salud.", sugerencias: [RUTAS.saludSalidas] };
    return {
      respuesta: `Salidas publicadas:\n${listar(
        s.salidas.map((x) => `${x.nombre} a ${x.destino}: sale el ${x.fechaSalida}${x.miSolicitud ? ` · tu solicitud: ${x.miSolicitud}` : x.inscripcionAbierta ? ` · inscripción hasta el ${x.cierraInscripcion}` : " · inscripción cerrada"}`),
      )}\n\nTu inscripción queda pendiente hasta que Salud la revise; te llega un correo con la respuesta.`,
      sugerencias: [RUTAS.saludSalidas],
    };
  }
  if (!s.jornadas.length) return { respuesta: "Por ahora no hay jornadas o campañas de salud publicadas.", sugerencias: [RUTAS.saludJornadas, RUTAS.saludSalidas] };
  return {
    respuesta: `Jornadas y campañas de salud:\n${listar(s.jornadas.map((j) => `${j.nombre}: ${j.fecha}${j.hora ? `, ${j.hora}` : ""}, ${j.lugar}${j.inscrito ? " · ya estás inscrito/a" : ""}`))}`,
    sugerencias: [RUTAS.saludJornadas, RUTAS.saludSalidas],
  };
}

// Pregunta corta dentro de un modulo («¿qué grupos hay?», «¿qué eventos hay?»): se
// entiende en el contexto de la pagina donde esta el estudiante.
const GENERICAS = /(grupo|evento|taller|inscri|ofrec|hay|horario|convocatoria|hora|jornada|salida|proxim)/;
function moduloEfectivo(textoNormalizado, pagina) {
  const propio = moduloDe(textoNormalizado);
  if (propio) return propio;
  return ["cultura", "deporte", "salud"].includes(pagina) && GENERICAS.test(textoNormalizado) ? pagina : null;
}

// Respuesta local para preguntas de Deporte, Salud o Cultura; null si la
// pregunta no es de esos modulos (la atiende la base de Orientacion).
function responderModulos(textoNormalizado, modulos, pagina) {
  const modulo = moduloEfectivo(textoNormalizado, pagina);
  if (modulo === "cultura") return responderCultura(textoNormalizado, modulos.cultura);
  if (modulo === "deporte") return responderDeporte(textoNormalizado, modulos.deporte);
  if (modulo === "salud") return responderSalud(textoNormalizado, modulos.salud);
  return null;
}

module.exports = { RUTAS, contextoModulos, moduloDe, moduloEfectivo, responderModulos };
