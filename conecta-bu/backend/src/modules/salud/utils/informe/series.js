const { POBLACIONES, PROGRAMAS, nivelDePrograma } = require("../catalogos");
const datos = require("../reportesDatos");

// Series del informe de gestion: periodos de Conecta BU comparados con las
// cifras historicas y la "asistencia de la poblacion objeto".

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

module.exports = { ETIQUETA_POBLACION, ordenPeriodo, porPeriodoDeConecta, seriesComparativas, asistenciaObjeto };
