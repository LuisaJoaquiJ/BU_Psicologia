// Excel de salidas institucionales y reportes SST: el consolidado que antes
// se sacaba de las respuestas del formulario de Google, ya ordenado por tipo.
const ExcelJS = require("exceljs");
const cat = require("./sst.catalogos");

const AZUL = "FF0B2A5B";
const GRIS = "FF5B6478";
const BORDE = { style: "thin", color: { argb: "FFD5DBE8" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const COLOR_ESTADO = { Recibido: "FFDCE4F3", Verificado: "FFC8EBD9", RequiereAjustes: "FFFBE6B0", Cerrado: "FFE5E7EB" };

const fecha = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const acompanantes = (lista) => (Array.isArray(lista) ? lista.map((p) => `${p.nombre} (${p.documento})`).join("; ") : "");
const documentos = (r) => r.adjuntos.map((a) => cat.ADJUNTOS[a.tipo] || a.tipo).join("; ");

function hojaTabla(libro, nombre, tituloHoja, columnas, filas) {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 3 }] });
  hoja.mergeCells(1, 1, 1, columnas.length);
  const t = hoja.getCell(1, 1);
  t.value = tituloHoja;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 28;
  hoja.getCell(2, 1).value = `Conecta BU · Salud integral · generado ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })}`;
  hoja.getCell(2, 1).font = { italic: true, size: 9, color: { argb: GRIS } };

  columnas.forEach((c, i) => {
    const celda = hoja.getCell(3, i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    celda.border = BORDES;
    hoja.getColumn(i + 1).width = c.ancho || 16;
  });
  hoja.getRow(3).height = 32;

  filas.forEach((r, n) => {
    const fila = hoja.getRow(4 + n);
    columnas.forEach((c, i) => {
      const celda = fila.getCell(i + 1);
      celda.value = c.valor(r);
      celda.border = BORDES;
      celda.alignment = { vertical: "top", wrapText: Boolean(c.envolver) };
      celda.font = { size: 10 };
      if (c.clave === "estado") celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ESTADO[r.estado] } };
    });
  });
  if (filas.length) hoja.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + filas.length, column: columnas.length } };
  return hoja;
}

const COMUNES_INICIO = [
  { titulo: "CÓDIGO", ancho: 11, valor: (r) => r.codigo },
  { titulo: "ESTADO", clave: "estado", ancho: 15, valor: (r) => cat.ESTADOS[r.estado] },
  { titulo: "FECHA DEL REPORTE", ancho: 13, valor: (r) => fecha(r.fechaCreacion) },
  { titulo: "TIPO", ancho: 30, valor: (r) => r.tipoNombre },
];
const QUIEN_REPORTA = [
  { titulo: "REPORTADO POR", ancho: 26, valor: (r) => r.nombreReporta },
  { titulo: "CORREO", ancho: 30, valor: (r) => r.correo },
  { titulo: "CELULAR", ancho: 14, valor: (r) => r.celular },
  { titulo: "ÁREA", ancho: 24, valor: (r) => r.area },
];
const REVISION = [
  { titulo: "REPORTADA A ARL / ASIST CARD", ancho: 14, valor: (r) => (r.gestion ? (r.gestionExterna ? "Sí" : "No") : "") },
  { titulo: "OBSERVACIÓN DE LA REVISIÓN", ancho: 36, envolver: true, valor: (r) => r.observacionRevision || "" },
  { titulo: "REVISADO POR", ancho: 26, valor: (r) => r.revisadoPor || "" },
];

const COLUMNAS_SALIDAS = [
  ...COMUNES_INICIO,
  { titulo: "NIVEL", ancho: 14, valor: (r) => cat.TIPOS[r.tipo].nivel },
  { titulo: "EVENTO / MOTIVO", ancho: 32, envolver: true, valor: (r) => r.evento || r.motivo || "" },
  { titulo: "PAÍS", ancho: 12, valor: (r) => r.pais || "Colombia" },
  { titulo: "ORIGEN", ancho: 16, valor: (r) => r.ciudadOrigen || "" },
  { titulo: "DESTINO", ancho: 24, valor: (r) => [r.destino, r.lugarDestino].filter(Boolean).join(" · ") },
  { titulo: "FECHA SALIDA", ancho: 12, valor: (r) => fecha(r.fechaSalida) },
  { titulo: "HORA SALIDA", ancho: 9, valor: (r) => r.horaSalida },
  { titulo: "FECHA REGRESO", ancho: 12, valor: (r) => fecha(r.fechaRegreso) },
  { titulo: "HORA LLEGADA", ancho: 9, valor: (r) => r.horaRegreso },
  { titulo: "DÍAS DE ANTICIPACIÓN", ancho: 11, valor: (r) => r.diasAnticipacion },
  { titulo: "A TIEMPO", ancho: 9, valor: (r) => (r.fueraDeTiempo ? "No" : "Sí") },
  { titulo: "RESPONSABLE / DOCENTE A CARGO", ancho: 28, valor: (r) => r.responsableNombre || "" },
  { titulo: "TIPO DOC.", ancho: 8, valor: (r) => r.responsableTipoDoc || "" },
  { titulo: "N° DOCUMENTO", ancho: 14, valor: (r) => r.responsableDocumento || "" },
  { titulo: "OTROS PARTICIPANTES", ancho: 36, envolver: true, valor: (r) => acompanantes(r.acompanantes) },
  { titulo: "N° ESTUDIANTES", ancho: 10, valor: (r) => r.numeroEstudiantes ?? "" },
  { titulo: "TRANSPORTE", ancho: 18, valor: (r) => cat.TRANSPORTES[r.medioTransporte] || "" },
  { titulo: "EMPRESA / CONDUCTOR / PLACA", ancho: 28, valor: (r) => [r.transporteEmpresa, r.conductor, r.placa].filter(Boolean).join(" · ") },
  { titulo: "DOCUMENTOS ADJUNTOS", ancho: 36, envolver: true, valor: documentos },
  { titulo: "DOCUMENTOS FALTANTES", ancho: 28, envolver: true, valor: (r) => r.adjuntosFaltantes.map((t) => cat.ADJUNTOS[t]).join("; ") },
  ...QUIEN_REPORTA,
  ...REVISION,
];

const COLUMNAS_RIESGOS = [
  ...COMUNES_INICIO.filter((c) => c.titulo !== "TIPO"),
  { titulo: "LUGAR", ancho: 26, valor: (r) => r.lugarEvento },
  { titulo: "FECHA", ancho: 12, valor: (r) => fecha(r.fechaEvento) },
  { titulo: "HORA", ancho: 8, valor: (r) => r.horaEvento },
  { titulo: "PERSONA QUE SUFRE EL EVENTO", ancho: 26, valor: (r) => r.afectado },
  { titulo: "CARGO", ancho: 18, valor: (r) => r.cargo },
  { titulo: "DESCRIPCIÓN", ancho: 44, envolver: true, valor: (r) => r.descripcion },
  { titulo: "CLASIFICACIÓN", ancho: 16, valor: (r) => cat.CLASIFICACIONES[r.clasificacion] || "" },
  { titulo: "POTENCIAL", ancho: 10, valor: (r) => r.potencial },
  { titulo: "MEDIDA DE CONTROL", ancho: 40, envolver: true, valor: (r) => r.medidaControl },
  { titulo: "EVIDENCIAS", ancho: 10, valor: (r) => r.adjuntos.length },
  ...QUIEN_REPORTA,
  ...REVISION.filter((c) => !c.titulo.startsWith("REPORTADA")),
];

function hojaResumen(libro, reportes, filtros) {
  const hoja = libro.addWorksheet("RESUMEN");
  hoja.getColumn(1).width = 46;
  for (let c = 2; c <= 6; c++) hoja.getColumn(c).width = 14;
  hoja.mergeCells("A1:F1");
  const t = hoja.getCell("A1");
  t.value = "Salidas institucionales y reportes SST";
  t.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 30;
  const rango = filtros.desde || filtros.hasta ? `${filtros.desde || "inicio"} a ${filtros.hasta || "hoy"}` : "todos los registros";
  hoja.getCell("A2").value = `Rango: ${rango} · ${reportes.length} reporte(s)`;
  hoja.getCell("A2").font = { italic: true, size: 9, color: { argb: GRIS } };

  let fila = 4;
  const bloque = (tituloBloque, encabezados, filas) => {
    [tituloBloque, ...encabezados].forEach((texto, i) => {
      const celda = hoja.getCell(fila, i + 1);
      celda.value = texto;
      celda.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
      celda.border = BORDES;
    });
    fila += 1;
    for (const valores of filas) {
      valores.forEach((v, i) => {
        const celda = hoja.getCell(fila, i + 1);
        celda.value = v;
        celda.border = BORDES;
      });
      fila += 1;
    }
    fila += 1;
  };

  const estados = Object.keys(cat.ESTADOS);
  bloque(
    "Tipo de reporte",
    [...estados.map((e) => cat.ESTADOS[e]), "Total"],
    Object.entries(cat.TIPOS).map(([id, def]) => {
      const delTipo = reportes.filter((r) => r.tipo === id);
      return [def.nombre, ...estados.map((e) => delTipo.filter((r) => r.estado === e).length), delTipo.length];
    })
  );

  const salidas = reportes.filter((r) => cat.esSalida(r.tipo));
  bloque("Salidas", ["Total"], [
    ["Reportadas a tiempo", salidas.filter((r) => !r.fueraDeTiempo).length],
    ["Reportadas fuera de tiempo", salidas.filter((r) => r.fueraDeTiempo).length],
    ["Con documentos faltantes", salidas.filter((r) => r.adjuntosFaltantes.length).length],
    ["Estudiantes que salieron (reportados)", salidas.reduce((s, r) => s + (r.numeroEstudiantes || 0), 0)],
  ]);

  const porArea = {};
  for (const r of reportes) porArea[r.area] = (porArea[r.area] || 0) + 1;
  bloque("Área", ["Reportes"], Object.entries(porArea).sort((a, b) => b[1] - a[1]));

  const porTransporte = {};
  for (const r of salidas) porTransporte[cat.TRANSPORTES[r.medioTransporte]] = (porTransporte[cat.TRANSPORTES[r.medioTransporte]] || 0) + 1;
  bloque("Medio de transporte", ["Salidas"], Object.entries(porTransporte).sort((a, b) => b[1] - a[1]));

  const riesgos = reportes.filter((r) => r.tipo === "CondicionInsegura");
  bloque(
    "Condiciones inseguras por potencial",
    ["Reportes"],
    cat.POTENCIALES.map((p) => [p, riesgos.filter((r) => r.potencial === p).length])
  );
}

async function generarExcel(reportes, filtros = {}) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Conecta BU";
  hojaResumen(libro, reportes, filtros);
  hojaTabla(
    libro,
    "SALIDAS",
    "Salidas institucionales y traslados",
    COLUMNAS_SALIDAS,
    reportes.filter((r) => cat.esSalida(r.tipo)).sort((a, b) => String(a.fechaSalida).localeCompare(String(b.fechaSalida)))
  );
  hojaTabla(libro, "CONDICIONES INSEGURAS", "Condiciones inseguras, actos inseguros e incidentes", COLUMNAS_RIESGOS, reportes.filter((r) => r.tipo === "CondicionInsegura"));
  const buffer = await libro.xlsx.writeBuffer();
  const sufijo = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return { buffer, nombre: `salidas-reportes-sst-${sufijo}.xlsx` };
}

module.exports = { generarExcel };
