const { CATEGORIAS, POBLACIONES, rangoDePeriodo } = require("../catalogos");
const datos = require("../reportesDatos");
const { ETIQUETA_POBLACION, ordenPeriodo, porPeriodoDeConecta, seriesComparativas, asistenciaObjeto } = require("./series");

// Cifras del informe de gestion de Salud integral (formato INFBI-002). Todo
// sale de lo registrado en Conecta BU, mas las cifras historicas de años
// anteriores. El resultado es JSON plano: se guarda tal cual cuando el
// informe se envia al superadministrador.
function armarCifras(periodo, { actividades, todas, historicos, evidencias, todasLasActividades }) {
  const rango = rangoDePeriodo(periodo);
  const idsDelPeriodo = new Set(actividades.map((a) => a.id));
  const enPeriodo = todas.filter((a) => idsDelPeriodo.has(a.actividadId) && new Date(a.fecha) >= rango.desde);
  const actividadPorId = new Map(actividades.map((a) => [a.id, a]));
  // Para las series se necesitan las categorias de todas las actividades.
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

module.exports = { armarCifras, revisarInforme };
