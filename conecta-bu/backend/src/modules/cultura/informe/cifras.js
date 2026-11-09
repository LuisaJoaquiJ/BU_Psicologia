const { prisma } = require("../../../config/prisma");
const { rangoDePeriodo } = require("../../salud/utils/catalogos");
const { iso } = require("../periodo");
const { TIPOS, nombreTipo, nombreCategoria } = require("../catalogo");

// Cifras del informe de gestion de Arte y Cultura: todo sale de lo registrado en Conecta BU
// (grupos, sesiones, asistencias, eventos, pausas, redes y evidencias). El resultado es JSON
// plano: se guarda tal cual cuando el informe se envia al superadministrador.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const suma = (fila) => (fila?.conteoEstudiantes || 0) + (fila?.conteoDocentes || 0) + (fila?.conteoAdministrativos || 0) + (fila?.conteoEgresados || 0);
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");

async function armarCifras(periodo) {
  const rango = rangoDePeriodo(periodo);
  const hasta = rango.hasta.getTime() + 864e5 - 1;
  const enRango = (f) => Boolean(f) && new Date(f).getTime() >= rango.desde.getTime() && new Date(f).getTime() <= hasta;

  const [grupos, areas, sesiones, asistencias, inscripciones, eventos, inscEventos, pausas, representaciones, participantes, evidencias, usuarios, perfiles] = await Promise.all([
    prisma.grupoCultural.findMany(),
    prisma.areaCultural.findMany(),
    prisma.sesionCultural.findMany(),
    prisma.asistenciaCultural.findMany(),
    prisma.inscripcionCultural.findMany(),
    prisma.eventoCultural.findMany(),
    prisma.inscripcionEventoCultural.findMany(),
    prisma.pausaCreativa.findMany(),
    prisma.representacionRed.findMany(),
    prisma.participanteRed.findMany(),
    prisma.evidenciaCultural.findMany(),
    prisma.usuario.findMany(),
    prisma.perfilCultural.findMany(),
  ]);
  const usuario = new Map(usuarios.map((u) => [u.id, u]));
  const perfil = new Map(perfiles.map((p) => [p.usuarioId, p]));
  const categoriaDe = new Map(areas.map((a) => [a.id, a.categoria]));
  const persona = (id, tipoSnies) => ({ nombre: usuario.get(id)?.nombre || "—", programa: perfil.get(id)?.programa || "—", tipo: nombreTipo(tipoSnies || perfil.get(id)?.tipoSnies || 1) });
  const tipoDe = (id, tipoSnies) => tipoSnies || perfil.get(id)?.tipoSnies || 1;

  // ---- Grupos y talleres del periodo, con quienes asistieron ----
  const gruposP = grupos.filter((g) => String(g.periodo) === periodo);
  const idsGrupos = new Set(gruposP.map((g) => g.id));
  const sesionesP = sesiones.filter((s) => idsGrupos.has(s.grupoId) && enRango(s.fecha));
  const asistenciasP = asistencias.filter((a) => a.presente && sesionesP.some((s) => s.id === a.sesionId));
  const personasUnicas = new Map(); // id -> tipoSnies

  const filasGrupos = gruposP
    .map((g) => {
      const insc = inscripciones.filter((i) => i.grupoId === g.id && i.estado === "Activa");
      const ses = sesionesP.filter((s) => s.grupoId === g.id);
      const idsSesion = new Set(ses.map((s) => s.id));
      const asis = asistenciasP.filter((a) => idsSesion.has(a.sesionId));
      const porUsuario = new Map();
      for (const a of asis) porUsuario.set(a.usuarioId, (porUsuario.get(a.usuarioId) || 0) + 1);
      const tipoInsc = new Map(insc.map((i) => [i.usuarioId, i.tipoSnies]));
      const ids = new Set([...insc.map((i) => i.usuarioId), ...porUsuario.keys()]);
      const asistentes = [...ids]
        .map((id) => {
          personasUnicas.set(id, tipoDe(id, tipoInsc.get(id)));
          return { ...persona(id, tipoInsc.get(id)), sesiones: porUsuario.get(id) || 0 };
        })
        .sort(porNombre);
      return {
        id: g.id,
        nombre: g.nombre,
        categoria: nombreCategoria(categoriaDe.get(g.areaId) || "taller"),
        esRepresentativo: categoriaDe.get(g.areaId) === "representativo",
        director: g.director || "",
        inscritos: insc.length,
        sesiones: ses.length,
        asistencias: asis.length,
        sinCuenta: ses.reduce((n, s) => n + suma(s), 0),
        promedio: ses.length ? Math.round((asis.length / ses.length) * 10) / 10 : 0,
        porcentaje: insc.length && ses.length ? Math.round((asis.length / (insc.length * ses.length)) * 1000) / 10 : null,
        asistentes,
      };
    })
    .sort(porNombre);

  // ---- Eventos y presentaciones del periodo, con quienes asistieron ----
  const eventosP = eventos.filter((e) => e.estado !== "Borrador" && enRango(e.fecha));
  const filasEventos = eventosP
    .map((e) => {
      const insc = inscEventos.filter((i) => i.eventoId === e.id && i.estado === "Activa");
      const asistentes = insc
        .filter((i) => i.asistio)
        .map((i) => {
          personasUnicas.set(i.usuarioId, tipoDe(i.usuarioId, i.tipoSnies));
          return persona(i.usuarioId, i.tipoSnies);
        })
        .sort(porNombre);
      return { id: e.id, nombre: e.nombre, fecha: iso(e.fecha), horario: `${e.horaInicio}–${e.horaFin}`, lugar: e.lugar || "", categoria: nombreCategoria(e.categoria), inscritos: insc.length, sinCuenta: suma(e), asistentes };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ---- Pausas creativas y representaciones en redes ----
  const pausasP = pausas.filter((p) => enRango(p.fecha));
  const filasPausas = pausasP.map((p) => ({ id: p.id, fecha: iso(p.fecha), lugar: p.lugar, tecnica: p.tecnica, impacto: p.impactoEstimado })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const repsP = representaciones.filter((r) => enRango(r.fecha));
  const filasReps = repsP
    .map((r) => ({ id: r.id, red: r.red, nombre: r.nombre, fecha: iso(r.fecha), posicion: r.posicion || "", participantes: participantes.filter((x) => x.representacionId === r.id).map((x) => persona(x.usuarioId)).sort(porNombre) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ---- Evidencias (registro fotografico y soportes) de lo del periodo ----
  const nombreDe = new Map([...gruposP.map((g) => [`g${g.id}`, g.nombre]), ...eventosP.map((e) => [`e${e.id}`, e.nombre]), ...pausasP.map((p) => [`p${p.id}`, `Pausa creativa · ${p.tecnica}`]), ...repsP.map((r) => [`r${r.id}`, `${r.red} · ${r.nombre}`])]);
  const llave = (e) => (e.grupoId ? `g${e.grupoId}` : e.eventoId ? `e${e.eventoId}` : e.pausaId ? `p${e.pausaId}` : e.representacionId ? `r${e.representacionId}` : "");
  const filasEvidencias = evidencias
    .filter((e) => nombreDe.has(llave(e)))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .map((e) => ({ id: e.id, tipo: e.tipo, tipoMime: e.mime, nombreArchivo: e.nombreOriginal, actividad: nombreDe.get(llave(e)), fecha: iso(e.fecha), descripcion: null }))
    .slice(0, 300);

  // ---- Indicadores, por tipo de persona y por mes ----
  const porTipo = TIPOS.map((t) => ({ clave: t.codigo, nombre: t.nombre, personas: [...personasUnicas.values()].filter((v) => v === t.codigo).length }));
  const inicio = rango.desde.getUTCMonth();
  const mensual = Array.from({ length: 6 }, (_, i) => {
    const mes = inicio + i;
    const delMes = (f) => new Date(f).getUTCMonth() === mes;
    const sesMes = sesionesP.filter((s) => delMes(s.fecha));
    const idsMes = new Set(sesMes.map((s) => s.id));
    return {
      mes: MESES[mes],
      sesiones: sesMes.length,
      asistenciasGrupos: asistenciasP.filter((a) => idsMes.has(a.sesionId)).length,
      asistentesEventos: filasEventos.filter((e) => delMes(`${e.fecha}T12:00:00Z`)).reduce((n, e) => n + e.asistentes.length, 0),
    };
  });
  const kpis = {
    grupos: filasGrupos.length,
    talleres: filasGrupos.filter((g) => !g.esRepresentativo).length,
    representativos: filasGrupos.filter((g) => g.esRepresentativo).length,
    inscritos: filasGrupos.reduce((n, g) => n + g.inscritos, 0),
    personas: personasUnicas.size,
    sesiones: sesionesP.length,
    asistencias: asistenciasP.length,
    asistentesSinCuenta: filasGrupos.reduce((n, g) => n + g.sinCuenta, 0) + filasEventos.reduce((n, e) => n + e.sinCuenta, 0),
    eventos: filasEventos.length,
    asistentesEventos: filasEventos.reduce((n, e) => n + e.asistentes.length, 0),
    pausas: filasPausas.length,
    impactoPausas: filasPausas.reduce((n, p) => n + p.impacto, 0),
    representaciones: filasReps.length,
    evidencias: filasEvidencias.length,
    fotos: filasEvidencias.filter((e) => e.tipo === "fotografia").length,
  };

  return { periodo, generado: new Date().toISOString(), kpis, porTipo, mensual, grupos: filasGrupos, eventos: filasEventos, pausas: filasPausas, representaciones: filasReps, evidencias: filasEvidencias };
}

// Lo que falta para poder enviar el informe al superadministrador.
function revisarInforme(informe, cifras) {
  const faltantes = [];
  if (!String(informe.responsable || "").trim()) faltantes.push("responsable del proyecto");
  if (!String(informe.descripcion || "").trim()) faltantes.push("descripción del proyecto");
  if (!String(informe.justificacion || "").trim()) faltantes.push("justificación");
  if (!(informe.objetivos || []).length) faltantes.push("al menos un objetivo");
  if (!String(informe.logros || "").trim()) faltantes.push("logros significativos");
  if (!String(informe.dificultades || "").trim()) faltantes.push("dificultades presentadas");
  if (!cifras.kpis.grupos && !cifras.kpis.eventos) faltantes.push("actividades del periodo (grupos o eventos)");
  if (!cifras.kpis.fotos) faltantes.push("al menos una foto como evidencia");
  // Avisos: no impiden el envio, pero conviene revisarlos (actividades sin foto, sin asistencia...).
  const conFoto = new Set(cifras.evidencias.map((e) => e.actividad));
  const avisos = [];
  const sinFotos = [...cifras.grupos.filter((g) => g.sesiones > 0), ...cifras.eventos].filter((a) => !conFoto.has(a.nombre)).map((a) => a.nombre);
  if (sinFotos.length) avisos.push({ tipo: "evidencias", texto: `${sinFotos.length} actividad(es) sin registro fotográfico`, actividades: sinFotos });
  const sinAsistencia = cifras.grupos.filter((g) => g.inscritos > 0 && g.sesiones === 0).map((g) => g.nombre);
  if (sinAsistencia.length) avisos.push({ tipo: "asistencia", texto: `${sinAsistencia.length} grupo(s) sin ninguna sesión con asistencia`, actividades: sinAsistencia });
  return { listo: faltantes.length === 0, faltantes, avisos };
}

// Cifras clave que ve el superadministrador en la lista de informes recibidos.
function indicadoresDe(cifras) {
  const k = cifras?.kpis;
  if (!k) return null;
  return [
    { titulo: "Grupos y talleres", valor: k.grupos },
    { titulo: "Personas", valor: k.personas },
    { titulo: "Asistencias", valor: k.asistencias + k.asistentesEventos },
    { titulo: "Eventos", valor: k.eventos },
  ];
}

module.exports = { armarCifras, revisarInforme, indicadoresDe };
