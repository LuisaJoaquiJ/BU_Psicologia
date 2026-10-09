// Cifras del informe de gestion de Salud integral (formato INFBI-002). Todo
// sale de lo registrado en Conecta BU, mas las cifras historicas de años
// anteriores (salud_historicos). El resultado es JSON plano: se guarda tal
// cual cuando el informe se envia al superadministrador.
const { prisma } = require("../../config/prisma");
const { CATEGORIAS, POBLACIONES, PROGRAMAS, nivelDePrograma, rangoDePeriodo } = require("./catalogos");
const datos = require("./reportes.datos");

const ETIQUETA_POBLACION = {
  Estudiante: "Estudiantes",
  Docente: "Docentes",
  Administrativo: "Administrativos",
  Egresado: "Egresados",
  Externo: "Externos",
};

// "2025" < "2026-1" < "2026-2": orden de los periodos en las graficas.
function ordenPeriodo(p) {
  const [anio, sem] = String(p).split("-");
  return Number(anio) * 10 + (sem ? Number(sem) : 0);
}

function porPeriodoDeConecta(atenciones, actividadPorId) {
  const mapa = new Map();
  for (const at of atenciones) {
    const f = new Date(at.fecha);
    const periodo = `${f.getUTCFullYear()}-${f.getUTCMonth() < 6 ? 1 : 2}`;
    if (!mapa.has(periodo)) mapa.set(periodo, { ...Object.fromEntries(POBLACIONES.map((p) => [p, 0])), enfermeria: 0 });
    const fila = mapa.get(periodo);
    fila[at.poblacion] += 1;
    if (actividadPorId.get(at.actividadId)?.categoria === "AtencionEnfermeria") fila.enfermeria += 1;
  }
  return mapa;
}

// Series comparativas: años anteriores (historicos) + periodos de Conecta BU
// hasta el periodo del informe. Si un año ya esta en los historicos, no se
// suman sus semestres de Conecta BU (para no contar dos veces).
function seriesComparativas(historicos, conecta, periodo) {
  const aniosHistoricos = new Set(historicos.map((h) => String(h.periodo).split("-")[0]));
  const filas = historicos.map((h) => ({
    periodo: h.periodo,
    fuente: "historico",
    Estudiante: h.estudiantes,
    Docente: h.docentes,
    Administrativo: h.administrativos,
    Externo: h.externos,
    Egresado: h.egresados,
    enfermeria: h.enfermeria,
    poblacionGeneral: h.poblacionGeneral,
  }));
  for (const [p, c] of conecta.entries()) {
    if (aniosHistoricos.has(p.split("-")[0]) || historicos.some((h) => h.periodo === p)) continue;
    if (ordenPeriodo(p) > ordenPeriodo(periodo)) continue;
    filas.push({ periodo: p, fuente: "conecta", ...c, poblacionGeneral: null });
  }
  return filas
    .sort((a, b) => ordenPeriodo(a.periodo) - ordenPeriodo(b.periodo))
    .map((f) => {
      const total = POBLACIONES.reduce((s, p) => s + (f[p] || 0), 0);
      return { ...f, total, poblacionGeneral: f.poblacionGeneral ?? total };
    });
}

// "ASISTENCIA POBLACIÓN OBJETO": grupos y cada programa de pregrado.
function asistenciaObjeto(atenciones) {
  const conteo = new Map([
    ["Administrativos", 0],
    ["Docentes", 0],
    ["Egresados", 0],
    ["Externos o sin especificar", 0],
    ["Especializaciones", 0],
    ...PROGRAMAS.filter((p) => p.nivel === "Pregrado").map((p) => [p.nombre, 0]),
    [datos.SIN_PROGRAMA, 0],
  ]);
  const sumar = (k) => conteo.set(k, conteo.get(k) + 1);
  for (const at of atenciones) {
    if (at.poblacion === "Administrativo") sumar("Administrativos");
    else if (at.poblacion === "Docente") sumar("Docentes");
    else if (at.poblacion === "Egresado") sumar("Egresados");
    else if (at.poblacion === "Externo") sumar("Externos o sin especificar");
    else if (at.programa && nivelDePrograma(at.programa) === "Posgrado") sumar("Especializaciones");
    else if (at.programa && conteo.has(at.programa)) sumar(at.programa);
    else sumar(datos.SIN_PROGRAMA);
  }
  return [...conteo.entries()].map(([nombre, total]) => ({ nombre, total })).filter((x) => x.total > 0 || x.nombre !== datos.SIN_PROGRAMA);
}

async function calcularDatos(periodo) {
  const rango = rangoDePeriodo(periodo);
  const [actividades, todas, historicos, evidencias] = await Promise.all([
    prisma.actividadSalud.findMany({ where: { periodo } }),
    prisma.atencionSalud.findMany({
      where: { fecha: { lte: rango.hasta } },
      select: { id: true, fecha: true, poblacion: true, programa: true, actividadId: true, personaId: true, remitido: true },
    }),
    prisma.historicoSalud.findMany(),
    prisma.evidenciaSalud.findMany({
      where: { fecha: { gte: rango.desde, lte: rango.hasta } },
      include: { actividad: true },
      orderBy: { fecha: "asc" },
    }),
  ]);
  const idsDelPeriodo = new Set(actividades.map((a) => a.id));
  const enPeriodo = todas.filter((a) => idsDelPeriodo.has(a.actividadId) && new Date(a.fecha) >= rango.desde);
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
  // Para las series se necesitan las categorias de todas las actividades.
  const todasLasActividades = await prisma.actividadSalud.findMany({ select: { id: true, categoria: true } });
  const categoriaPorId = new Map(todasLasActividades.map((a) => [a.id, a]));

  const matriz = datos.matrizGestion(actividades, enPeriodo);
  const conMeta = matriz.filas.filter((f) => f.primeraFila && f.cumplimiento !== null);
  const total = enPeriodo.length;
  const series = seriesComparativas(historicos, porPeriodoDeConecta(todas, categoriaPorId), periodo);

  const kpis = {
    atenciones: total,
    personas: new Set(enPeriodo.map((a) => a.personaId)).size,
    actividades: new Set(enPeriodo.map((a) => a.actividadId)).size,
    actividadesProgramadas: actividades.filter((a) => a.activa !== false).length,
    jornadas: matriz.filas.filter((f) => f.primeraFila).reduce((s, f) => s + (f.logro || 0), 0),
    cumplimientoPromedio: conMeta.length
      ? Math.round((conMeta.reduce((s, f) => s + Math.min(f.cumplimiento, 100), 0) / conMeta.length) * 10) / 10
      : null,
    metasCumplidas: conMeta.filter((f) => f.cumplimiento >= 90).length,
    actividadesConMeta: conMeta.length,
    remisiones: enPeriodo.filter((a) => a.remitido).length,
    enfermeria: enPeriodo.filter((a) => actividadPorId.get(a.actividadId)?.categoria === "AtencionEnfermeria").length,
    evidencias: evidencias.length,
  };

  // Se compara solo semestre con semestre (los historicos anuales no son comparables).
  const anterior = series.filter((s) => String(s.periodo).includes("-") && ordenPeriodo(s.periodo) < ordenPeriodo(periodo)).pop() || null;

  return {
    periodo,
    generado: new Date().toISOString(),
    kpis,
    comparacion: anterior ? { periodo: anterior.periodo, total: anterior.poblacionGeneral } : null,
    matriz,
    porPoblacion: POBLACIONES.map((p) => {
      const n = enPeriodo.filter((a) => a.poblacion === p).length;
      return { clave: p, nombre: ETIQUETA_POBLACION[p], total: n, porcentaje: total ? n / total : 0 };
    }),
    impacto: series.map((s) => ({
      periodo: s.periodo,
      fuente: s.fuente,
      Estudiante: s.Estudiante,
      Docente: s.Docente,
      Administrativo: s.Administrativo,
      Externo: s.Externo,
      Egresado: s.Egresado,
      total: s.total,
    })),
    enfermeria: series.filter((s) => s.enfermeria !== null && s.enfermeria !== undefined).map((s) => ({ periodo: s.periodo, total: s.enfermeria })),
    poblacionGeneral: series.map((s) => ({ periodo: s.periodo, total: s.poblacionGeneral })),
    asistenciaObjeto: asistenciaObjeto(enPeriodo),
    porCategoria: datos.contarPor(enPeriodo, (a) => CATEGORIAS[actividadPorId.get(a.actividadId)?.categoria]),
    porPrograma: datos.contarPor(
      enPeriodo.filter((a) => a.poblacion === "Estudiante"),
      (a) => a.programa || datos.SIN_PROGRAMA
    ),
    actividades: matriz.filas
      .filter((f) => f.primeraFila)
      .map((f) => ({
        id: f.actividadId,
        codigo: f.codigo,
        nombre: f.actividad,
        categoria: f.categoria,
        meta: f.meta,
        logro: f.logro,
        cumplimiento: f.cumplimiento,
        semaforo: f.semaforo,
        avances: f.avances,
        dificultades: f.dificultades,
        aprendizajes: f.aprendizajes,
        pendientes: actividadPorId.get(f.actividadId)?.pendientes || null,
        presupuesto: f.presupuesto,
        observaciones: f.observaciones,
        atenciones: matriz.filas.filter((x) => x.actividadId === f.actividadId).reduce((s, x) => s + x.total, 0),
      })),
    evidencias: evidencias.map((e) => ({
      id: e.id,
      actividad: e.actividad?.nombre || "",
      fecha: datos.fechaISO(e.fecha),
      descripcion: e.descripcion,
      tipoMime: e.tipoMime,
      nombreArchivo: e.nombreArchivo,
    })),
  };
}

// Lo que conviene revisar antes de enviar el informe.
function revisarInforme(informe, cifras) {
  const obligatorios = [
    ["responsable", "Responsable del proyecto"],
    ["fechaPresentacion", "Fecha de presentación"],
    ["descripcion", "Descripción del proyecto"],
    ["justificacion", "Justificación"],
    ["logros", "Logros significativos"],
    ["dificultades", "Dificultades presentadas"],
    ["accionesMejora", "Acciones de mejora"],
  ];
  const faltantes = obligatorios.filter(([k]) => !String(informe[k] ?? "").trim()).map(([, n]) => n);
  if (!Array.isArray(informe.objetivos) || !informe.objetivos.some((o) => String(o.objetivo || "").trim())) faltantes.push("Al menos un objetivo");

  const fotosPorActividad = new Set(cifras.evidencias.map((e) => e.actividad));
  const avisos = [];
  const sinAvances = cifras.actividades.filter((a) => !String(a.avances || "").trim());
  if (sinAvances.length) avisos.push({ tipo: "avances", texto: `${sinAvances.length} actividad(es) sin avances escritos`, actividades: sinAvances.map((a) => a.nombre) });
  const sinMeta = cifras.actividades.filter((a) => a.meta === null || a.meta === undefined);
  if (sinMeta.length) avisos.push({ tipo: "meta", texto: `${sinMeta.length} actividad(es) sin meta (no se calcula el cumplimiento)`, actividades: sinMeta.map((a) => a.nombre) });
  const sinFotos = cifras.actividades.filter((a) => !fotosPorActividad.has(a.nombre) && a.categoria !== CATEGORIAS.AtencionEnfermeria);
  if (sinFotos.length) avisos.push({ tipo: "evidencias", texto: `${sinFotos.length} actividad(es) sin registro fotográfico`, actividades: sinFotos.map((a) => a.nombre) });
  const bajas = cifras.actividades.filter((a) => a.semaforo === "rojo");
  if (bajas.length) avisos.push({ tipo: "cumplimiento", texto: `${bajas.length} actividad(es) con cumplimiento menor al 60 %`, actividades: bajas.map((a) => a.nombre) });
  if (!cifras.kpis.atenciones) avisos.push({ tipo: "vacio", texto: "No hay atenciones registradas en este periodo", actividades: [] });
  return { faltantes, avisos, listo: faltantes.length === 0 };
}

module.exports = { calcularDatos, revisarInforme, ordenPeriodo, seriesComparativas, ETIQUETA_POBLACION };
