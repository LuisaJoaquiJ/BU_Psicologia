const ExcelJS = require("exceljs");
const { InformePdf } = require("../../salud/archivos/informe/InformePdf");
const { hojaProyecto } = require("../../salud/archivos/informe/hojasProyecto");
const { hojaFotografica } = require("../../salud/archivos/hojasGestion");
const { leerLogo, relleno, encabezadoInstitucional, bloqueTexto } = require("../../salud/archivos/informe/formatoExcel");
const { AZUL, MARFIL, GRIS, BORDES } = require("../../salud/archivos/estiloExcel");
const { num, pct } = require("../../salud/archivos/informe/formatoPdf");

// Informe de gestion de Arte y Cultura en PDF y Excel: mismo formato institucional que el de Salud
// (proyecto, evaluacion, resultados, actividades, relacion de asistentes y registro fotografico).

const COLUMNAS_GRUPO = [
  { titulo: "Grupo o taller", ancho: 2.6, valor: (g) => g.nombre },
  { titulo: "Tipo", ancho: 1.8, valor: (g) => g.categoria },
  { titulo: "Dirige", ancho: 1.8, valor: (g) => g.director || "—" },
  { titulo: "Inscritos", ancho: 0.9, alinear: "right", valor: (g) => num(g.inscritos) },
  { titulo: "Sesiones", ancho: 0.9, alinear: "right", valor: (g) => num(g.sesiones) },
  { titulo: "Asistencias", ancho: 1, alinear: "right", valor: (g) => num(g.asistencias) },
  { titulo: "Prom. por sesión", ancho: 1, alinear: "right", valor: (g) => num(g.promedio) },
  { titulo: "% asistencia", ancho: 1, alinear: "right", valor: (g) => (g.porcentaje === null ? "—" : pct(g.porcentaje)) },
];

class InformePdfCultura extends InformePdf {
  resultadosCultura(cifras) {
    const k = cifras.kpis;
    this.nuevaPagina();
    this.tituloSeccion(`RESULTADOS EN CIFRAS ${cifras.periodo}`, "Calculado con lo registrado en Conecta BU en el periodo.");
    this.tabla(
      [
        { titulo: "Indicador", ancho: 4, valor: (f) => f[0] },
        { titulo: "Valor", ancho: 1, alinear: "right", valor: (f) => num(f[1]) },
      ],
      [
        ["Grupos y talleres del periodo", k.grupos],
        ["   Talleres de formación", k.talleres],
        ["   Grupos representativos", k.representativos],
        ["Inscripciones activas (suma por grupo)", k.inscritos],
        ["Personas distintas que participaron", k.personas],
        ["Sesiones realizadas", k.sesiones],
        ["Asistencias registradas en grupos", k.asistencias],
        ["Eventos y presentaciones", k.eventos],
        ["Asistentes a eventos", k.asistentesEventos],
        ["Asistentes sin cuenta (conteo del personal)", k.asistentesSinCuenta],
        ["Pausas creativas", k.pausas],
        ["Personas alcanzadas en pausas creativas", k.impactoPausas],
        ["Representaciones en redes", k.representaciones],
        ["Evidencias cargadas (fotos y soportes)", k.evidencias],
      ]
    );
    this.subtitulo("Participantes por tipo de persona");
    this.tabla(
      [
        { titulo: "Tipo de persona", ancho: 3, valor: (t) => t.nombre },
        { titulo: "Personas", ancho: 1, alinear: "right", valor: (t) => num(t.personas) },
      ],
      cifras.porTipo
    );
    this.subtitulo("Asistencia por mes");
    this.tabla(
      [
        { titulo: "Mes", ancho: 1.5, valor: (m) => m.mes },
        { titulo: "Sesiones", ancho: 1, alinear: "right", valor: (m) => num(m.sesiones) },
        { titulo: "Asistencias en grupos", ancho: 1.5, alinear: "right", valor: (m) => num(m.asistenciasGrupos) },
        { titulo: "Asistentes a eventos", ancho: 1.5, alinear: "right", valor: (m) => num(m.asistentesEventos) },
      ],
      cifras.mensual
    );
  }

  actividadesCultura(cifras) {
    this.nuevaPagina();
    this.tituloSeccion("GRUPOS Y TALLERES", "Inscritos, sesiones y asistencia de cada grupo en el periodo.");
    this.tabla(COLUMNAS_GRUPO, cifras.grupos, { tam: 8 });
    this.tituloSeccion("EVENTOS Y PRESENTACIONES");
    this.tabla(
      [
        { titulo: "Evento", ancho: 2.6, valor: (e) => e.nombre },
        { titulo: "Tipo", ancho: 1.8, valor: (e) => e.categoria },
        { titulo: "Fecha", ancho: 1.2, valor: (e) => e.fecha },
        { titulo: "Lugar", ancho: 1.8, valor: (e) => e.lugar || "—" },
        { titulo: "Inscritos", ancho: 0.9, alinear: "right", valor: (e) => num(e.inscritos) },
        { titulo: "Asistentes", ancho: 0.9, alinear: "right", valor: (e) => num(e.asistentes.length) },
        { titulo: "Sin cuenta", ancho: 0.9, alinear: "right", valor: (e) => num(e.sinCuenta) },
      ],
      cifras.eventos,
      { tam: 8 }
    );
    this.tituloSeccion("PAUSAS CREATIVAS");
    this.tabla(
      [
        { titulo: "Fecha", ancho: 1.2, valor: (p) => p.fecha },
        { titulo: "Lugar", ancho: 2.4, valor: (p) => p.lugar },
        { titulo: "Técnica", ancho: 2.4, valor: (p) => p.tecnica },
        { titulo: "Personas alcanzadas", ancho: 1.2, alinear: "right", valor: (p) => num(p.impacto) },
      ],
      cifras.pausas,
      { tam: 8 }
    );
    this.tituloSeccion("REPRESENTACIONES EN REDES (ASIES · ASCUN)");
    this.tabla(
      [
        { titulo: "Red", ancho: 1, valor: (r) => r.red },
        { titulo: "Representación", ancho: 3, valor: (r) => r.nombre },
        { titulo: "Fecha", ancho: 1.2, valor: (r) => r.fecha },
        { titulo: "Posición", ancho: 1.4, valor: (r) => r.posicion || "—" },
        { titulo: "Participantes", ancho: 1, alinear: "right", valor: (r) => num(r.participantes.length) },
      ],
      cifras.representaciones,
      { tam: 8 }
    );
  }

  asistentesCultura(cifras) {
    this.nuevaPagina();
    this.tituloSeccion(`RELACIÓN DE ASISTENTES ${cifras.periodo}`, "Quiénes participaron en cada grupo, evento y representación.");
    const columnas = (conSesiones, total) => [
      { titulo: "Nombre", ancho: 3, valor: (p) => p.nombre },
      { titulo: "Programa", ancho: 2.6, valor: (p) => p.programa },
      { titulo: "Tipo", ancho: 1.3, valor: (p) => p.tipo },
      ...(conSesiones ? [{ titulo: `Asistió (de ${total})`, ancho: 1.1, alinear: "right", valor: (p) => num(p.sesiones) }] : []),
    ];
    for (const g of cifras.grupos.filter((x) => x.asistentes.length)) {
      this.subtitulo(`${g.nombre} · ${g.categoria}`);
      this.tabla(columnas(true, g.sesiones), g.asistentes, { tam: 8 });
    }
    for (const e of cifras.eventos.filter((x) => x.asistentes.length)) {
      this.subtitulo(`${e.nombre} · ${e.fecha}`);
      this.tabla(columnas(false), e.asistentes, { tam: 8 });
    }
    for (const r of cifras.representaciones.filter((x) => x.participantes.length)) {
      this.subtitulo(`${r.red} · ${r.nombre} · ${r.fecha}`);
      this.tabla(columnas(false), r.participantes, { tam: 8 });
    }
    if (!cifras.grupos.some((g) => g.asistentes.length) && !cifras.eventos.some((e) => e.asistentes.length)) this.parrafo("", "No hay asistentes registrados en el periodo.");
  }

  async generar(informe, cifras, leerArchivo) {
    this.proyecto(informe);
    this.evaluacion(informe);
    this.resultadosCultura(cifras);
    this.actividadesCultura(cifras);
    this.asistentesCultura(cifras);
    await this.fotos(cifras, leerArchivo);
    this.encabezados(informe, cifras);
    this.doc.end();
    return this.fin;
  }
}

const generarPdf = (informe, cifras, leerArchivo) => new InformePdfCultura(informe).generar(informe, cifras, leerArchivo);

// ---------------------------------------------------------------- Excel
const PAGINA = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

// Hoja sencilla con titulo, encabezado de columnas y filas.
function hojaTabla(libro, nombre, titulo, secciones) {
  const hoja = libro.addWorksheet(nombre, { pageSetup: PAGINA });
  hoja.mergeCells(1, 1, 1, 8);
  const t = hoja.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 13, color: { argb: AZUL } };
  let fila = 3;
  for (const { subtitulo, columnas, filas } of secciones) {
    if (subtitulo) {
      hoja.getCell(fila, 1).value = subtitulo;
      hoja.getCell(fila, 1).font = { bold: true, size: 11, color: { argb: AZUL } };
      fila += 1;
    }
    columnas.forEach((c, i) => {
      const celda = hoja.getCell(fila, i + 1);
      celda.value = c.titulo;
      celda.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      celda.fill = relleno(AZUL);
      celda.alignment = { horizontal: c.numero ? "right" : "left", vertical: "middle", wrapText: true };
      celda.border = BORDES;
      hoja.getColumn(i + 1).width = Math.max(hoja.getColumn(i + 1).width || 0, c.ancho || 18);
    });
    fila += 1;
    if (!filas.length) {
      hoja.getCell(fila, 1).value = "Sin datos en el periodo.";
      hoja.getCell(fila, 1).font = { italic: true, color: { argb: GRIS } };
      fila += 1;
    }
    filas.forEach((f, j) => {
      columnasValor(columnas, f).forEach((v, i) => {
        const celda = hoja.getCell(fila, i + 1);
        celda.value = v;
        celda.font = { size: 10 };
        celda.border = BORDES;
        celda.alignment = { horizontal: columnas[i].numero ? "right" : "left", vertical: "top", wrapText: true };
        if (j % 2 === 1) celda.fill = relleno(MARFIL);
      });
      fila += 1;
    });
    fila += 1;
  }
  return hoja;
}
const columnasValor = (columnas, fila) => columnas.map((c) => c.valor(fila));

async function generarExcel(informe, cifras, leerArchivo) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU";
  libro.created = new Date();
  const logo = leerLogo();
  const idLogo = logo ? libro.addImage({ buffer: logo, extension: "png" }) : null;
  const k = cifras.kpis;

  hojaProyecto(libro, informe, idLogo);

  // Evaluacion + indicadores del periodo
  const evaluacion = libro.addWorksheet("INFORME - EVALUACIÓN", { pageSetup: { ...PAGINA, orientation: "portrait" } });
  encabezadoInstitucional(libro, evaluacion, informe, `INFORME DE GESTIÓN · EVALUACIÓN ${informe.periodo}`, idLogo);
  let fila = 10;
  fila = bloqueTexto(evaluacion, fila, "LOGROS SIGNIFICATIVOS", informe.logros);
  fila = bloqueTexto(evaluacion, fila, "DIFICULTADES PRESENTADAS", informe.dificultades);
  fila = bloqueTexto(evaluacion, fila, "ACCIONES DE MEJORA", informe.accionesMejora);
  evaluacion.mergeCells(fila, 1, fila, 18);
  const cab = evaluacion.getCell(fila, 1);
  cab.value = `INDICADORES DEL PERIODO ${informe.periodo} (registrados en Conecta BU)`;
  cab.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  cab.fill = relleno(AZUL);
  cab.alignment = { horizontal: "center" };
  [
    ["Grupos y talleres", k.grupos],
    ["Personas que participaron", k.personas],
    ["Sesiones realizadas", k.sesiones],
    ["Asistencias en grupos", k.asistencias],
    ["Eventos y presentaciones", k.eventos],
    ["Asistentes a eventos", k.asistentesEventos],
  ].forEach(([nombre, v], i) => {
    const col = 1 + (i % 3) * 6;
    const f = fila + 1 + Math.floor(i / 3) * 2;
    evaluacion.mergeCells(f, col, f, col + 5);
    evaluacion.mergeCells(f + 1, col, f + 1, col + 5);
    const n = evaluacion.getCell(f, col);
    n.value = nombre;
    n.font = { size: 9, color: { argb: GRIS } };
    n.alignment = { horizontal: "center" };
    const c = evaluacion.getCell(f + 1, col);
    c.value = v;
    c.numFmt = "#,##0";
    c.font = { bold: true, size: 16, color: { argb: AZUL } };
    c.alignment = { horizontal: "center" };
    for (let x = col; x <= col + 5; x += 1) {
      evaluacion.getCell(f, x).fill = relleno(MARFIL);
      evaluacion.getCell(f + 1, x).fill = relleno(MARFIL);
    }
    evaluacion.getRow(f + 1).height = 26;
  });

  const texto = (x) => ({ ancho: 34, valor: x });
  hojaTabla(libro, "ACTIVIDADES", `ACTIVIDADES · ARTE Y CULTURA · ${cifras.periodo}`, [
    {
      subtitulo: "Grupos y talleres",
      columnas: [
        { ...texto((g) => g.nombre), titulo: "Grupo o taller" },
        { ancho: 22, titulo: "Tipo", valor: (g) => g.categoria },
        { ancho: 24, titulo: "Dirige", valor: (g) => g.director || "" },
        { ancho: 11, numero: true, titulo: "Inscritos", valor: (g) => g.inscritos },
        { ancho: 11, numero: true, titulo: "Sesiones", valor: (g) => g.sesiones },
        { ancho: 12, numero: true, titulo: "Asistencias", valor: (g) => g.asistencias },
        { ancho: 14, numero: true, titulo: "Prom. por sesión", valor: (g) => g.promedio },
        { ancho: 13, numero: true, titulo: "% asistencia", valor: (g) => (g.porcentaje === null ? "" : g.porcentaje) },
      ],
      filas: cifras.grupos,
    },
    {
      subtitulo: "Eventos y presentaciones",
      columnas: [
        { ...texto((e) => e.nombre), titulo: "Evento" },
        { titulo: "Tipo", valor: (e) => e.categoria },
        { titulo: "Fecha", valor: (e) => e.fecha },
        { numero: true, titulo: "Inscritos", valor: (e) => e.inscritos },
        { numero: true, titulo: "Asistentes", valor: (e) => e.asistentes.length },
        { numero: true, titulo: "Sin cuenta", valor: (e) => e.sinCuenta },
        { titulo: "Lugar", valor: (e) => e.lugar },
      ],
      filas: cifras.eventos,
    },
    {
      subtitulo: "Pausas creativas",
      columnas: [
        { titulo: "Fecha", valor: (p) => p.fecha },
        { titulo: "Lugar", valor: (p) => p.lugar },
        { titulo: "Técnica", valor: (p) => p.tecnica },
        { numero: true, titulo: "Personas alcanzadas", valor: (p) => p.impacto },
      ],
      filas: cifras.pausas,
    },
    {
      subtitulo: "Representaciones en redes",
      columnas: [
        { titulo: "Red", valor: (r) => r.red },
        { titulo: "Representación", valor: (r) => r.nombre },
        { titulo: "Fecha", valor: (r) => r.fecha },
        { titulo: "Posición", valor: (r) => r.posicion },
        { numero: true, titulo: "Participantes", valor: (r) => r.participantes.length },
      ],
      filas: cifras.representaciones,
    },
  ]);

  // Relacion de asistentes: una fila por persona y actividad
  const filasAsistentes = [
    ...cifras.grupos.flatMap((g) => g.asistentes.map((p) => ({ actividad: g.nombre, clase: "Grupo", fecha: "", ...p, detalle: `${p.sesiones} de ${g.sesiones} sesiones` }))),
    ...cifras.eventos.flatMap((e) => e.asistentes.map((p) => ({ actividad: e.nombre, clase: "Evento", fecha: e.fecha, ...p, detalle: "Asistió" }))),
    ...cifras.representaciones.flatMap((r) => r.participantes.map((p) => ({ actividad: `${r.red} · ${r.nombre}`, clase: "Representación", fecha: r.fecha, ...p, detalle: "Participó" }))),
  ];
  hojaTabla(libro, "ASISTENTES", `RELACIÓN DE ASISTENTES · ARTE Y CULTURA · ${cifras.periodo}`, [
    {
      columnas: [
        { ancho: 34, titulo: "Actividad", valor: (f) => f.actividad },
        { ancho: 16, titulo: "Clase", valor: (f) => f.clase },
        { ancho: 13, titulo: "Fecha", valor: (f) => f.fecha },
        { ancho: 34, titulo: "Nombre", valor: (f) => f.nombre },
        { ancho: 34, titulo: "Programa", valor: (f) => f.programa },
        { ancho: 16, titulo: "Tipo", valor: (f) => f.tipo },
        { ancho: 22, titulo: "Participación", valor: (f) => f.detalle },
      ],
      filas: filasAsistentes,
    },
  ]);

  hojaTabla(libro, "ESTADÍSTICAS", `ESTADÍSTICAS · ARTE Y CULTURA · ${cifras.periodo}`, [
    {
      subtitulo: "Participantes por tipo de persona",
      columnas: [
        { ancho: 34, titulo: "Tipo de persona", valor: (t) => t.nombre },
        { ancho: 14, numero: true, titulo: "Personas", valor: (t) => t.personas },
      ],
      filas: cifras.porTipo,
    },
    {
      subtitulo: "Asistencia por mes",
      columnas: [
        { titulo: "Mes", valor: (m) => m.mes },
        { numero: true, titulo: "Sesiones", valor: (m) => m.sesiones },
        { numero: true, titulo: "Asistencias en grupos", valor: (m) => m.asistenciasGrupos },
        { numero: true, titulo: "Asistentes a eventos", valor: (m) => m.asistentesEventos },
      ],
      filas: cifras.mensual,
    },
  ]);

  await hojaFotografica(libro, cifras.periodo, cifras.evidencias, leerArchivo, "ARTE Y CULTURA");
  return Buffer.from(await libro.xlsx.writeBuffer());
}

module.exports = { generarPdf, generarExcel };
