// Exporta el informe (RF-015) a Excel: una hoja de resumen y una hoja por
// tabla, con encabezados institucionales, filtros y porcentajes reales
// (numeros con formato %, para que se puedan seguir calculando).
const ExcelJS = require("exceljs");

const AZUL = "FF0B2A5B";
const DORADO = "FFE8B23A";
const MARFIL = "FFFBF7EE";
const GRIS = "FF5B6478";
const FORMATO_PCT = "0.0%";

function textoPeriodo(filtro) {
  if (!filtro.desde && !filtro.hasta) return "Todo el historial";
  return `${filtro.desde || "inicio"} a ${filtro.hasta || "hoy"}`;
}

// Hoja con titulo, subtitulo y una tabla con encabezado, filtro y paneles fijos.
function hojaTabla(libro, nombre, { titulo, nota, columnas, filas, totales }) {
  const hoja = libro.addWorksheet(nombre, { properties: { tabColor: { argb: AZUL } } });
  hoja.columns = columnas.map((c) => ({ key: c.clave, width: c.ancho || 16 }));

  hoja.getCell("A1").value = titulo;
  hoja.getCell("A1").font = { name: "Calibri", size: 14, bold: true, color: { argb: AZUL } };
  if (nota) {
    hoja.getCell("A2").value = nota;
    hoja.getCell("A2").font = { size: 10, italic: true, color: { argb: GRIS } };
  }

  const filaEncabezado = hoja.getRow(4);
  columnas.forEach((c, i) => {
    const celda = filaEncabezado.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", wrapText: true };
  });
  filaEncabezado.height = 30;

  filas.forEach((dato, i) => {
    const fila = hoja.getRow(5 + i);
    columnas.forEach((c, j) => {
      const celda = fila.getCell(j + 1);
      const valor = dato[c.clave];
      celda.value = valor === null || valor === undefined ? (c.pct ? "—" : "") : valor;
      if (c.pct) {
        celda.numFmt = FORMATO_PCT;
        celda.alignment = { horizontal: "right" };
      }
    });
    if (i % 2 === 1) {
      fila.eachCell({ includeEmpty: true }, (celda) => {
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARFIL } };
      });
    }
  });

  if (totales && filas.length) {
    const fila = hoja.getRow(5 + filas.length);
    columnas.forEach((c, j) => {
      const celda = fila.getCell(j + 1);
      const valor = totales[c.clave];
      celda.value = valor === null || valor === undefined ? "" : valor;
      if (c.pct) celda.numFmt = FORMATO_PCT;
      celda.font = { bold: true };
      celda.border = { top: { style: "thin", color: { argb: AZUL } } };
    });
  }

  if (filas.length) {
    hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: columnas.length } };
    // Barra de datos en las columnas de tasa para leerlas de un vistazo.
    columnas.forEach((c, j) => {
      if (!c.barra) return;
      const letra = hoja.getColumn(j + 1).letter;
      hoja.addConditionalFormatting({
        ref: `${letra}5:${letra}${4 + filas.length}`,
        rules: [{ type: "dataBar", minLength: 0, maxLength: 100, cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }], color: { argb: "FF0D9488" } }],
      });
    });
  } else {
    hoja.getCell("A5").value = "Sin datos en el periodo.";
    hoja.getCell("A5").font = { italic: true, color: { argb: GRIS } };
  }
  hoja.views = [{ state: "frozen", ySplit: 4 }];
  return hoja;
}

const COLS_CITAS = [
  { clave: "total", titulo: "Total", ancho: 10 },
  { clave: "atendidas", titulo: "Atendidas", ancho: 11 },
  { clave: "noAsistieron", titulo: "No asistieron", ancho: 13 },
  { clave: "canceladas", titulo: "Canceladas", ancho: 12 },
  { clave: "agendadas", titulo: "Agendadas (pendientes)", ancho: 14 },
  { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 13, pct: true, barra: true },
  { clave: "tasaCancelacion", titulo: "Tasa de cancelación", ancho: 13, pct: true },
];

function totalCitas(filas) {
  const t = { total: 0, atendidas: 0, noAsistieron: 0, canceladas: 0, agendadas: 0 };
  filas.forEach((f) => Object.keys(t).forEach((k) => (t[k] += f[k])));
  t.tasaAsistencia = t.atendidas + t.noAsistieron ? t.atendidas / (t.atendidas + t.noAsistieron) : null;
  t.tasaCancelacion = t.total ? t.canceladas / t.total : null;
  return t;
}

function hojaResumen(libro, informe) {
  const hoja = libro.addWorksheet("Resumen", { properties: { tabColor: { argb: DORADO } } });
  hoja.columns = [{ width: 46 }, { width: 18 }, { width: 50 }];

  hoja.mergeCells("A1:C1");
  hoja.getCell("A1").value = "Conecta BU · Informe de Bienestar Universitario";
  hoja.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  hoja.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  hoja.getRow(1).height = 32;
  hoja.getCell("A1").alignment = { vertical: "middle", indent: 1 };

  hoja.getCell("A2").value = `Corporación Universitaria Autónoma del Cauca · Periodo: ${textoPeriodo(informe.filtro)}`;
  hoja.getCell("A3").value = `Generado el ${informe.generado.toLocaleString("es-CO", { timeZone: "America/Bogota" })}`;
  ["A2", "A3"].forEach((c) => (hoja.getCell(c).font = { color: { argb: GRIS } }));

  const { citas, eventos, participacion, ocupacionHorarios } = informe.resumen;
  const p = informe.probabilidades;
  const ic = (x) => (x.probabilidad === null ? "Sin datos" : `IC 95 %: ${x.bajo} % – ${x.alto} % (n = ${x.n})`);
  const secciones = [
    ["Citas", [
      ["Citas en el periodo", citas.total],
      ["Atendidas (asistieron)", citas.atendidas],
      ["No asistieron", citas.noAsistieron],
      ["Canceladas", citas.canceladas],
      ["Agendadas sin registro de asistencia", citas.agendadas],
      ["Tasa de asistencia", citas.tasaAsistencia, true, "Atendidas / (atendidas + no asistieron)"],
      ["Tasa de cancelación", citas.tasaCancelacion, true, "Canceladas / total de citas"],
    ]],
    ["Eventos", [
      ["Eventos publicados o cerrados", eventos.eventos],
      ["Inscritos", eventos.inscritos],
      ["Asistieron", eventos.asistieron],
      ["No asistieron", eventos.noAsistieron],
      ["Sin registro de asistencia", eventos.sinRegistrar],
      ["Tasa de asistencia a eventos", eventos.tasaAsistencia, true],
    ]],
    ["Participación", [
      ["Estudiantes registrados", informe.resumen.estudiantesRegistrados],
      ["Estudiantes activos (citas o eventos)", participacion.estudiantesActivos],
      ["Alcance sobre registrados", participacion.alcance === null ? null : participacion.alcance / 100, true],
      ["Estudiantes que repiten cita", participacion.recurrentes],
      ["Horarios publicados", ocupacionHorarios.total],
      ["Horarios ocupados", ocupacionHorarios.ocupados],
      ["Ocupación de horarios", ocupacionHorarios.porcentaje === null ? null : ocupacionHorarios.porcentaje / 100, true],
    ]],
    ["Probabilidades (histórico del periodo)", [
      ["Probabilidad de asistir a una cita", p.asistenciaCita.probabilidad === null ? null : p.asistenciaCita.probabilidad / 100, true, ic(p.asistenciaCita)],
      ["Probabilidad de cancelar una cita", p.cancelacionCita.probabilidad === null ? null : p.cancelacionCita.probabilidad / 100, true, ic(p.cancelacionCita)],
      ["Probabilidad de asistir a un evento", p.asistenciaEvento.probabilidad === null ? null : p.asistenciaEvento.probabilidad / 100, true, ic(p.asistenciaEvento)],
    ]],
  ];

  let fila = 5;
  for (const [titulo, items] of secciones) {
    const celda = hoja.getCell(`A${fila}`);
    celda.value = titulo;
    celda.font = { bold: true, size: 12, color: { argb: AZUL } };
    hoja.getCell(`A${fila}`).border = { bottom: { style: "medium", color: { argb: DORADO } } };
    fila += 1;
    for (const [etiqueta, valor, esPct, nota] of items) {
      hoja.getCell(`A${fila}`).value = etiqueta;
      const v = hoja.getCell(`B${fila}`);
      v.value = valor === null || valor === undefined ? "Sin datos" : valor;
      v.font = { bold: true };
      v.alignment = { horizontal: "right" };
      if (esPct) v.numFmt = FORMATO_PCT;
      if (nota) {
        hoja.getCell(`C${fila}`).value = nota;
        hoja.getCell(`C${fila}`).font = { size: 9, color: { argb: GRIS } };
      }
      fila += 1;
    }
    fila += 1;
  }

  hoja.getCell(`A${fila}`).value = "Lectura rápida";
  hoja.getCell(`A${fila}`).font = { bold: true, size: 12, color: { argb: AZUL } };
  hoja.getCell(`A${fila}`).border = { bottom: { style: "medium", color: { argb: DORADO } } };
  fila += 1;
  for (const texto of informe.conclusiones) {
    hoja.mergeCells(`A${fila}:C${fila}`);
    hoja.getCell(`A${fila}`).value = `• ${texto}`;
    hoja.getCell(`A${fila}`).alignment = { wrapText: true, vertical: "top" };
    hoja.getRow(fila).height = 30;
    fila += 1;
  }
  fila += 1;
  hoja.mergeCells(`A${fila}:C${fila}`);
  hoja.getCell(`A${fila}`).value =
    "Nota: las probabilidades se estiman con el histórico del periodo. El intervalo de confianza (Wilson, 95 %) indica el rango " +
    "donde probablemente está el valor real; si es ancho, hay pocos datos. Información confidencial de uso interno de Bienestar.";
  hoja.getCell(`A${fila}`).font = { size: 9, italic: true, color: { argb: GRIS } };
  hoja.getCell(`A${fila}`).alignment = { wrapText: true };
  hoja.getRow(fila).height = 42;
}

async function generarExcel(informe) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU";
  libro.created = informe.generado;
  libro.title = "Informe de Bienestar Universitario";

  hojaResumen(libro, informe);

  hojaTabla(libro, "Citas por servicio", {
    titulo: "Citas por servicio",
    columnas: [{ clave: "servicio", titulo: "Servicio", ancho: 34 }, ...COLS_CITAS],
    filas: informe.citasPorServicio,
    totales: { servicio: "Total", ...totalCitas(informe.citasPorServicio) },
  });

  hojaTabla(libro, "Citas por día", {
    titulo: "Citas y asistencia según el día de la semana",
    nota: "IC 95 %: intervalo de confianza de la tasa de asistencia (Wilson).",
    columnas: [
      { clave: "clave", titulo: "Día", ancho: 14 },
      ...COLS_CITAS,
      { clave: "icBajo", titulo: "IC bajo (%)", ancho: 11 },
      { clave: "icAlto", titulo: "IC alto (%)", ancho: 11 },
    ],
    filas: informe.citasPorDia,
    totales: { clave: "Total", ...totalCitas(informe.citasPorDia) },
  });

  hojaTabla(libro, "Citas por hora", {
    titulo: "Citas según la hora de inicio",
    columnas: [{ clave: "clave", titulo: "Hora", ancho: 10 }, ...COLS_CITAS],
    filas: informe.citasPorHora,
    totales: { clave: "Total", ...totalCitas(informe.citasPorHora) },
  });

  hojaTabla(libro, "Citas por mes", {
    titulo: "Citas por mes",
    columnas: [{ clave: "mes", titulo: "Mes", ancho: 12 }, ...COLS_CITAS],
    filas: informe.citasPorMes,
    totales: { mes: "Total", ...totalCitas(informe.citasPorMes) },
  });

  hojaTabla(libro, "Tendencia semanal", {
    titulo: "Citas por semana (semana que inicia el lunes)",
    columnas: [
      { clave: "semana", titulo: "Semana (lunes)", ancho: 15 },
      { clave: "total", titulo: "Total", ancho: 10 },
      { clave: "Atendida", titulo: "Atendidas", ancho: 11 },
      { clave: "NoAsistio", titulo: "No asistieron", ancho: 13 },
      { clave: "Cancelada", titulo: "Canceladas", ancho: 12 },
      { clave: "Agendada", titulo: "Agendadas", ancho: 11 },
    ],
    filas: informe.tendenciaSemanal,
  });

  hojaTabla(libro, "Eventos", {
    titulo: "Asistencia por evento",
    columnas: [
      { clave: "nombre", titulo: "Evento", ancho: 36 },
      { clave: "fecha", titulo: "Fecha", ancho: 12 },
      { clave: "estado", titulo: "Estado", ancho: 11 },
      { clave: "cupos", titulo: "Cupos", ancho: 8 },
      { clave: "inscritos", titulo: "Inscritos", ancho: 10 },
      { clave: "asistieron", titulo: "Asistieron", ancho: 11 },
      { clave: "noAsistieron", titulo: "No asistieron", ancho: 13 },
      { clave: "sinRegistrar", titulo: "Sin registrar", ancho: 12 },
      { clave: "ocupacion", titulo: "Ocupación de cupos", ancho: 12, pct: true },
      { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 13, pct: true, barra: true },
    ],
    filas: informe.eventos,
    totales: {
      nombre: "Total",
      cupos: informe.eventos.reduce((a, e) => a + e.cupos, 0),
      inscritos: informe.resumen.eventos.inscritos,
      asistieron: informe.resumen.eventos.asistieron,
      noAsistieron: informe.resumen.eventos.noAsistieron,
      sinRegistrar: informe.resumen.eventos.sinRegistrar,
      tasaAsistencia: informe.resumen.eventos.tasaAsistencia,
    },
  });

  hojaTabla(libro, "Asistentes a eventos", {
    titulo: "Inscritos a eventos y su asistencia",
    columnas: [
      { clave: "evento", titulo: "Evento", ancho: 34 },
      { clave: "fecha", titulo: "Fecha", ancho: 12 },
      { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
      { clave: "correo", titulo: "Correo", ancho: 32 },
      { clave: "inscritoEl", titulo: "Inscrito el", ancho: 12 },
      { clave: "asistencia", titulo: "Asistencia", ancho: 14 },
    ],
    filas: informe.asistentesEventos,
  });

  hojaTabla(libro, "Ocupación horarios", {
    titulo: "Ocupación de horarios por servicio",
    columnas: [
      { clave: "servicio", titulo: "Servicio", ancho: 34 },
      { clave: "publicados", titulo: "Publicados", ancho: 11 },
      { clave: "ocupados", titulo: "Ocupados", ancho: 11 },
      { clave: "libres", titulo: "Libres", ancho: 10 },
      { clave: "ocupacion", titulo: "Ocupación", ancho: 12, pct: true, barra: true },
    ],
    filas: informe.ocupacionPorServicio,
  });

  hojaTabla(libro, "Detalle de citas", {
    titulo: "Detalle de citas",
    nota: "Información confidencial: uso interno de Bienestar Universitario.",
    columnas: [
      { clave: "fecha", titulo: "Fecha", ancho: 12 },
      { clave: "dia", titulo: "Día", ancho: 11 },
      { clave: "hora", titulo: "Hora", ancho: 8 },
      { clave: "servicio", titulo: "Servicio", ancho: 30 },
      { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
      { clave: "correo", titulo: "Correo", ancho: 32 },
      { clave: "estado", titulo: "Estado", ancho: 12 },
      { clave: "agendadaEl", titulo: "Agendada el", ancho: 12 },
    ],
    filas: informe.detalleCitas,
  });

  const COLS_ESTUDIANTE = [
    { clave: "estudiante", titulo: "Estudiante", ancho: 30 },
    { clave: "correo", titulo: "Correo", ancho: 32 },
    { clave: "citas", titulo: "Citas", ancho: 8 },
    { clave: "atendidas", titulo: "Atendidas", ancho: 10 },
    { clave: "noAsistieron", titulo: "No asistió (citas)", ancho: 12 },
    { clave: "canceladas", titulo: "Canceladas", ancho: 11 },
    { clave: "eventosInscritos", titulo: "Eventos inscritos", ancho: 11 },
    { clave: "eventosAsistidos", titulo: "Eventos asistidos", ancho: 11 },
    { clave: "eventosNoAsistidos", titulo: "No asistió (eventos)", ancho: 12 },
    { clave: "inasistencias", titulo: "Inasistencias totales", ancho: 12 },
    { clave: "tasaAsistencia", titulo: "Tasa de asistencia", ancho: 12, pct: true, barra: true },
  ];

  hojaTabla(libro, "Estudiantes", {
    titulo: "Participación por estudiante",
    nota: "Información confidencial: uso interno de Bienestar Universitario.",
    columnas: COLS_ESTUDIANTE,
    filas: informe.estudiantes,
  });

  hojaTabla(libro, "Seguimiento", {
    titulo: "Estudiantes con 2 o más inasistencias (citas + eventos)",
    nota: "Sugerencia: contactar para conocer la causa y ofrecer reagendar. Información confidencial.",
    columnas: COLS_ESTUDIANTE,
    filas: informe.seguimiento,
  });

  return libro.xlsx.writeBuffer();
}

module.exports = { generarExcel, textoPeriodo };
