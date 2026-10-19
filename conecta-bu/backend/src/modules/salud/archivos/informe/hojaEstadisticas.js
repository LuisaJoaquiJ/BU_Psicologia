const { rango } = require("./excelGraficas");
const { titulo } = require("../estiloExcel");
const { COLORES_POBLACION, ETIQUETAS, ORDEN_POBLACION, tabla } = require("./formatoExcel");

// Hoja ESTADÍSTICAS del informe de gestion: tablas y la definicion de las
// graficas nativas de Excel que se agregan al final.

function hojaEstadisticas(libro, cifras) {
  const NOMBRE = "ESTADÍSTICAS";
  const hoja = libro.addWorksheet(NOMBRE, { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  hoja.getColumn(1).width = 3;
  hoja.getColumn(2).width = 34;
  for (let c = 3; c <= 8; c += 1) hoja.getColumn(c).width = 13;
  for (let c = 9; c <= 20; c += 1) hoja.getColumn(c).width = 9.5;
  titulo(hoja, "B1:T1", "ESTADÍSTICAS SALUD INTEGRAL", `Periodo ${cifras.periodo} · años anteriores tomados de los informes históricos · resaltado en amarillo: datos registrados en Conecta BU`);

  const graficas = [];
  const alto = (filasTabla) => Math.max(filasTabla + 3, 18);
  let fila = 4;

  // 1. Impacto poblacional (historico + Conecta BU).
  const impacto = tabla(
    hoja,
    fila,
    "IMPACTO POBLACIONAL",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      ...ORDEN_POBLACION.map((p) => ({ titulo: ETIQUETAS[p], valor: (f) => f[p] || 0, color: COLORES_POBLACION[p] })),
      { titulo: "Total", valor: (f) => f.total, negrita: true },
    ],
    cifras.impacto
  );
  if (cifras.impacto.length) {
    graficas.push({
      tipo: "barras",
      titulo: "Impacto poblacional por periodo",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.impacto.length) },
      categorias: { ref: rango(NOMBRE, 2, impacto.desde, 2, impacto.hasta), valores: cifras.impacto.map((f) => String(f.periodo)) },
      series: ORDEN_POBLACION.map((p, i) => ({
        nombre: ETIQUETAS[p],
        ref: rango(NOMBRE, 3 + i, impacto.desde, 3 + i, impacto.hasta),
        valores: cifras.impacto.map((f) => f[p] || 0),
        color: COLORES_POBLACION[p],
      })),
      ejeY: "Personas atendidas",
    });
  }
  fila = Math.max(impacto.siguiente, fila + alto(cifras.impacto.length)) + 1;

  // 2. Poblacion atendida en el periodo (torta).
  const poblacion = tabla(
    hoja,
    fila,
    `POBLACIÓN ATENDIDA ${cifras.periodo}`,
    [
      { titulo: "Población", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
      { titulo: "Porcentaje", valor: (f) => f.porcentaje, pct: true },
    ],
    cifras.porPoblacion
  );
  graficas.push({
    tipo: "torta",
    titulo: `Población atendida ${cifras.periodo}`,
    desde: { col: 9, fila: fila - 1 },
    hasta: { col: 16, fila: fila - 1 + 16 },
    categorias: { ref: rango(NOMBRE, 2, poblacion.desde, 2, poblacion.hasta), valores: cifras.porPoblacion.map((p) => p.nombre) },
    series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, poblacion.desde, 3, poblacion.hasta), valores: cifras.porPoblacion.map((p) => p.total) }],
    colores: cifras.porPoblacion.map((p) => COLORES_POBLACION[p.clave]),
  });
  fila += 18;

  // 3. Atencion servicio de enfermeria por periodo.
  const enf = tabla(
    hoja,
    fila,
    "ATENCIÓN SERVICIO DE ENFERMERÍA",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      { titulo: "Población atendida", valor: (f) => f.total },
    ],
    cifras.enfermeria.map((f) => ({ ...f, resaltar: !/^\d{4}$/.test(String(f.periodo)) }))
  );
  if (cifras.enfermeria.length) {
    graficas.push({
      tipo: "barras",
      titulo: "Atención servicio de enfermería",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.enfermeria.length) },
      categorias: { ref: rango(NOMBRE, 2, enf.desde, 2, enf.hasta), valores: cifras.enfermeria.map((f) => String(f.periodo)) },
      series: [{ nombre: "Población atendida", ref: rango(NOMBRE, 3, enf.desde, 3, enf.hasta), valores: cifras.enfermeria.map((f) => f.total), color: "0D9488" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  fila = Math.max(enf.siguiente, fila + alto(cifras.enfermeria.length)) + 1;

  // 4. Poblacion general por periodo.
  const general = tabla(
    hoja,
    fila,
    "POBLACIÓN GENERAL ATENDIDA",
    [
      { titulo: "Periodo", valor: (f) => String(f.periodo) },
      { titulo: "Población general", valor: (f) => f.total },
    ],
    cifras.poblacionGeneral.map((f) => ({ ...f, resaltar: !/^\d{4}$/.test(String(f.periodo)) }))
  );
  if (cifras.poblacionGeneral.length) {
    graficas.push({
      tipo: "lineas",
      titulo: `Población general frente a años anteriores`,
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + alto(cifras.poblacionGeneral.length) },
      categorias: { ref: rango(NOMBRE, 2, general.desde, 2, general.hasta), valores: cifras.poblacionGeneral.map((f) => String(f.periodo)) },
      series: [{ nombre: "Población general", ref: rango(NOMBRE, 3, general.desde, 3, general.hasta), valores: cifras.poblacionGeneral.map((f) => f.total), color: "163F86" }],
      leyenda: false,
    });
  }
  fila = Math.max(general.siguiente, fila + alto(cifras.poblacionGeneral.length)) + 1;

  // 5. Asistencia poblacion objeto (programas).
  const objeto = tabla(
    hoja,
    fila,
    `ASISTENCIA POBLACIÓN OBJETO ${cifras.periodo}`,
    [
      { titulo: "Población / programa", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
    ],
    cifras.asistenciaObjeto
  );
  if (cifras.asistenciaObjeto.length) {
    graficas.push({
      tipo: "barrasHorizontales",
      titulo: "Asistencia población objeto",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + Math.max(cifras.asistenciaObjeto.length + 4, 18) },
      categorias: { ref: rango(NOMBRE, 2, objeto.desde, 2, objeto.hasta), valores: cifras.asistenciaObjeto.map((f) => f.nombre) },
      series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, objeto.desde, 3, objeto.hasta), valores: cifras.asistenciaObjeto.map((f) => f.total), color: "163F86" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  fila = Math.max(objeto.siguiente, fila + Math.max(cifras.asistenciaObjeto.length + 4, 18)) + 1;

  // 6. Atenciones por linea de accion.
  const lineas = tabla(
    hoja,
    fila,
    `ATENCIONES POR LÍNEA DE ACCIÓN ${cifras.periodo}`,
    [
      { titulo: "Línea de acción", valor: (f) => f.nombre },
      { titulo: "Atenciones", valor: (f) => f.total },
    ],
    cifras.porCategoria
  );
  if (cifras.porCategoria.length) {
    graficas.push({
      tipo: "barrasHorizontales",
      titulo: "Atenciones por línea de acción",
      desde: { col: 9, fila: fila - 1 },
      hasta: { col: 20, fila: fila - 1 + 14 },
      categorias: { ref: rango(NOMBRE, 2, lineas.desde, 2, lineas.hasta), valores: cifras.porCategoria.map((f) => f.nombre) },
      series: [{ nombre: "Atenciones", ref: rango(NOMBRE, 3, lineas.desde, 3, lineas.hasta), valores: cifras.porCategoria.map((f) => f.total), color: "E8B23A" }],
      leyenda: false,
      etiquetas: true,
    });
  }
  return { [NOMBRE]: graficas };
}

module.exports = { hojaEstadisticas };
