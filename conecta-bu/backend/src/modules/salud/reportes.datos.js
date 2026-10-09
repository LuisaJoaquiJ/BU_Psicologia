// Calculos de los reportes de Salud integral (funciones puras: reciben las
// filas consultadas y devuelven tablas). Replican la estructura de los
// formatos actuales: matriz "ATENDIDOS" del informe de gestion INFBI-002,
// plantilla SNIES "Actividad de bienestar" (codigo 92) y registro general.

const { PROGRAMAS, CATEGORIAS, SNIES_TIPO_BENEFICIARIO, POBLACIONES, nivelDePrograma } = require("./catalogos");

const fechaISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const PREGRADO = PROGRAMAS.filter((p) => p.nivel === "Pregrado").map((p) => p.nombre);
const POSGRADO = PROGRAMAS.filter((p) => p.nivel === "Posgrado").map((p) => p.nombre);
const SIN_PROGRAMA = "Sin programa registrado";

// Columnas de la matriz de atendidos, agrupadas como en el informe.
const COLUMNAS_MATRIZ = [
  { grupo: "ADMIN", clave: "Administrativo", titulo: "Administrativos" },
  { grupo: "DOCENTES", clave: "Docente", titulo: "Docentes" },
  { grupo: "EGRESADOS", clave: "Egresado", titulo: "Egresados" },
  { grupo: "EXTERNOS", clave: "Externo", titulo: "Externos" },
  ...POSGRADO.map((p) => ({ grupo: "ESTUDIANTES POSGRADO", clave: `pos:${p}`, titulo: p })),
  ...PREGRADO.map((p) => ({ grupo: "ESTUDIANTES PREGRADO", clave: `pre:${p}`, titulo: p })),
  { grupo: "ESTUDIANTES PREGRADO", clave: `pre:${SIN_PROGRAMA}`, titulo: SIN_PROGRAMA },
];

// Columna de la matriz en la que cuenta una atencion.
function columnaDe(atencion) {
  if (atencion.poblacion !== "Estudiante") return atencion.poblacion;
  const programa = atencion.programa;
  if (programa && nivelDePrograma(programa) === "Posgrado") return `pos:${programa}`;
  if (programa && nivelDePrograma(programa) === "Pregrado") return `pre:${programa}`;
  return `pre:${SIN_PROGRAMA}`;
}

function conteoVacio() {
  return Object.fromEntries(COLUMNAS_MATRIZ.map((c) => [c.clave, 0]));
}

function semaforo(cumplimiento) {
  if (cumplimiento === null || cumplimiento === undefined) return null;
  if (cumplimiento >= 90) return "verde";
  if (cumplimiento >= 60) return "amarillo";
  return "rojo";
}

// Matriz de atendidos: una fila por jornada (fecha) en las actividades
// puntuales y una fila por actividad en los servicios permanentes.
function matrizGestion(actividades, atenciones) {
  const porActividad = new Map(actividades.map((a) => [a.id, []]));
  for (const at of atenciones) porActividad.get(at.actividadId)?.push(at);

  const filas = [];
  const ordenCategorias = Object.keys(CATEGORIAS);
  const ordenadas = [...actividades].sort(
    (a, b) => ordenCategorias.indexOf(a.categoria) - ordenCategorias.indexOf(b.categoria) || a.codigo - b.codigo
  );

  for (const actividad of ordenadas) {
    const lista = porActividad.get(actividad.id) || [];
    if (!lista.length) continue;
    const grupos = new Map();
    for (const at of lista) {
      const clave = actividad.permanente ? "permanente" : fechaISO(at.fecha);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(at);
    }
    const jornadas = actividad.permanente ? 1 : grupos.size;
    const cumplimiento = actividad.meta ? Math.round((jornadas / actividad.meta) * 1000) / 10 : null;
    [...grupos.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([clave, delGrupo], i) => {
        const conteo = conteoVacio();
        for (const at of delGrupo) conteo[columnaDe(at)] += 1;
        filas.push({
          categoria: CATEGORIAS[actividad.categoria],
          actividadId: actividad.id,
          codigo: actividad.codigo,
          actividad: actividad.nombre,
          fecha:
            clave === "permanente"
              ? `${fechaISO(actividad.fechaInicio)} a ${fechaISO(actividad.fechaFin)}`
              : clave,
          conteo,
          total: delGrupo.length,
          primeraFila: i === 0,
          meta: i === 0 ? actividad.meta : null,
          logro: i === 0 ? jornadas : null,
          cumplimiento: i === 0 ? cumplimiento : null,
          semaforo: i === 0 ? semaforo(cumplimiento) : null,
          avances: i === 0 ? actividad.avances : null,
          dificultades: i === 0 ? actividad.dificultades : null,
          aprendizajes: i === 0 ? actividad.aprendizajes : null,
          presupuesto: i === 0 ? actividad.presupuesto : null,
          pendientes: i === 0 ? actividad.pendientes || null : null,
          observaciones: i === 0 ? actividad.observaciones : null,
        });
      });
  }

  const totales = conteoVacio();
  for (const f of filas) for (const c of COLUMNAS_MATRIZ) totales[c.clave] += f.conteo[c.clave];
  return { columnas: COLUMNAS_MATRIZ, filas, totales, total: filas.reduce((a, f) => a + f.total, 0) };
}

// Plantilla SNIES "Actividad de bienestar": actividades ejecutadas,
// beneficiarios por tipo y recurso humano (responsable y dedicacion).
function datosSnies(actividades, atenciones, periodo) {
  const [anio, semestre] = periodo.split("-");
  const textoSemestre = `${semestre} SEMESTRE`;
  const porActividad = new Map();
  for (const at of atenciones) {
    if (!porActividad.has(at.actividadId)) porActividad.set(at.actividadId, []);
    porActividad.get(at.actividadId).push(at);
  }
  const ejecutadas = actividades.filter((a) => porActividad.has(a.id)).sort((a, b) => a.codigo - b.codigo);

  const actividadesSnies = ejecutadas.map((a) => {
    const fechas = porActividad.get(a.id).map((x) => fechaISO(x.fecha)).sort();
    return {
      AÑO: Number(anio),
      SEMESTRE: textoSemestre,
      CODIGO_UNIDAD_ORGANIZACIONAL: "BIENESTAR UNIVERSITARIO",
      CODIGO_ACTIVIDAD: a.codigo,
      DESCRIPCION_ACTIVIDAD: a.nombre.toUpperCase(),
      ID_TIPO_ACTIVIDAD_BIENESTAR: a.tipoSnies || 1,
      FECHA_INICIO: a.permanente ? fechaISO(a.fechaInicio) : fechas[0],
      FECHA_FINAL: a.permanente ? fechaISO(a.fechaFin) : fechas[fechas.length - 1],
    };
  });

  const beneficiarios = [];
  for (const a of ejecutadas) {
    const porTipo = new Map();
    for (const at of porActividad.get(a.id)) {
      const tipo = SNIES_TIPO_BENEFICIARIO[at.poblacion];
      porTipo.set(tipo, (porTipo.get(tipo) || 0) + 1);
    }
    [...porTipo.entries()]
      .sort(([x], [y]) => x - y)
      .forEach(([tipo, cantidad]) =>
        beneficiarios.push({
          AÑO: Number(anio),
          SEMESTRE: textoSemestre,
          CODIGO_UNIDAD_ORGANIZACIONAL: "BIENESTAR UNIVERSITARIO",
          CODIGO_ACTIVIDAD: a.codigo,
          ID_TIPO_BENEFICIARIO: tipo,
          CANTIDAD_BENEFICIARIOS: cantidad,
        })
      );
  }

  const recursoHumano = ejecutadas
    .filter((a) => a.responsableDocumento)
    .map((a) => ({
      AÑO: Number(anio),
      SEMESTRE: textoSemestre,
      CODIGO_ACTIVIDAD: a.codigo,
      CODIGO_UNIDAD_ORGANIZACIONAL: "BIENESTAR UNIVERSITARIO",
      ID_TIPO_DOCUMENTO: "CEDULA DE CIUDADANIA",
      NUM_DOCUMENTO: a.responsableDocumento,
      DEDICACION: a.horasDedicacion ?? null,
    }));

  const sinResponsable = ejecutadas.filter((a) => !a.responsableDocumento).map((a) => a.nombre);
  return { actividades: actividadesSnies, beneficiarios, recursoHumano, sinResponsable };
}

function contarPor(lista, clave) {
  const mapa = new Map();
  for (const x of lista) {
    const k = typeof clave === "function" ? clave(x) : x[clave];
    if (k === null || k === undefined) continue;
    mapa.set(k, (mapa.get(k) || 0) + 1);
  }
  return [...mapa.entries()].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
}

// "CARGO" del registro general a partir de poblacion y programa.
function cargoRegistro(poblacion, programa) {
  const prog = (programa || "").toUpperCase();
  if (poblacion === "Administrativo") return "ADMINISTRATIVO";
  if (poblacion === "Egresado") return "EGRESADO";
  if (poblacion === "Externo") return "VISITANTE";
  if (poblacion === "Docente") return `DOCENTE ${prog}`.trim();
  return prog || "ESTUDIANTE";
}

module.exports = {
  COLUMNAS_MATRIZ,
  SIN_PROGRAMA,
  fechaISO,
  columnaDe,
  semaforo,
  matrizGestion,
  datosSnies,
  contarPor,
  cargoRegistro,
};
