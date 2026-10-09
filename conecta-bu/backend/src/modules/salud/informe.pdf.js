// Informe de gestion en PDF con el formato INFBI-002: encabezado
// institucional en cada pagina (codigo, version, fecha, pagina X de Y),
// proyecto, evaluacion, resultados con graficas dibujadas con vectores,
// relacion de atendidos, avances por actividad y registro fotografico.
// Usa las fuentes estandar de PDF (Helvetica y Times), que ya traen tildes y ñ.
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { FORMATO, NOMBRE_PROYECTO } = require("./informe.plantilla");
const { dimensiones } = require("./reportes.excel");

const C = {
  azul: "#0B2A5B",
  azulSuave: "#163F86",
  dorado: "#E8B23A",
  doradoTexto: "#9A6B07",
  marfil: "#FBF7EE",
  borde: "#E5E0D2",
  tinta: "#0E1726",
  gris: "#5B6478",
  grisClaro: "#EDEFF4",
  verde: "#C8EBD9",
  amarillo: "#FBE6B0",
  rojo: "#F6CACA",
};
const POBLACION = {
  Estudiante: { nombre: "Estudiantes", color: "#163F86" },
  Docente: { nombre: "Docentes", color: "#0D9488" },
  Administrativo: { nombre: "Administrativos", color: "#D97706" },
  Externo: { nombre: "Externos", color: "#9CA3AF" },
  Egresado: { nombre: "Egresados", color: "#7C3AED" },
};
const ORDEN = ["Estudiante", "Docente", "Administrativo", "Externo", "Egresado"];
const ESTADO_TEXTO = { Borrador: "BORRADOR", Enviado: "Enviado", Devuelto: "Devuelto para ajustes", Aprobado: "Aprobado" };

const MARGEN = 40;
const ALTO_ENCABEZADO = 74;
const ALTO_PIE = 26;
const RUTA_LOGO = path.join(__dirname, "..", "..", "..", "assets", "logo-uniautonoma.png");

const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("es-CO"));
const pct = (x) => (x === null || x === undefined ? "—" : `${Number(x).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`);
const fechaTexto = (iso) =>
  iso
    ? new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "—";

// Maximo "redondo" para los ejes.
function maximoEje(valor) {
  if (valor <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(valor));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * exp >= valor) return m * exp;
  return 10 * exp;
}

async function generarPdf(informe, cifras, leerArchivo) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGEN + ALTO_ENCABEZADO, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: `Informe de gestión ${NOMBRE_PROYECTO[informe.modulo] || ""} ${informe.periodo}`, Author: "Conecta BU · Uniautónoma del Cauca" },
  });
  const partes = [];
  doc.on("data", (p) => partes.push(p));
  const fin = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(partes))));
  let logo = null;
  try {
    logo = fs.readFileSync(RUTA_LOGO);
  } catch {
    logo = null;
  }

  const ancho = () => doc.page.width - MARGEN * 2;
  const limite = () => doc.page.height - MARGEN - ALTO_PIE;
  const asegurar = (alto) => {
    if (doc.y + alto > limite()) doc.addPage();
  };
  const nuevaPagina = (layout = "portrait") => {
    doc.addPage({ size: "A4", layout, margins: { top: MARGEN + ALTO_ENCABEZADO, bottom: MARGEN + ALTO_PIE, left: MARGEN, right: MARGEN } });
  };

  function tituloSeccion(texto, subtitulo) {
    asegurar(60);
    doc.moveDown(0.4);
    const y = doc.y;
    doc.rect(MARGEN, y, ancho(), 20).fill(C.azul);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text(texto, MARGEN + 8, y + 5.5, { width: ancho() - 16, lineBreak: false });
    doc.y = y + 26;
    if (subtitulo) {
      doc.font("Helvetica").fontSize(8.5).fillColor(C.gris).text(subtitulo, MARGEN, doc.y, { width: ancho() });
      doc.moveDown(0.4);
    }
  }

  // "espacio": alto del contenido que sigue (grafica), para no dejar el titulo solo.
  function subtitulo(texto, espacio = 0) {
    asegurar(40 + espacio);
    doc.moveDown(0.3);
    doc.font("Times-Bold").fontSize(13).fillColor(C.azul).text(texto, MARGEN, doc.y, { width: ancho() });
    const y = doc.y + 2;
    doc.rect(MARGEN, y, 30, 2).fill(C.dorado);
    doc.y = y + 8;
  }

  function parrafo(texto, vacio = "Sin diligenciar.") {
    const t = String(texto || "").trim();
    doc
      .font(t ? "Helvetica" : "Helvetica-Oblique")
      .fontSize(9.5)
      .fillColor(t ? C.tinta : C.gris)
      .text(t || vacio, MARGEN, doc.y, { width: ancho(), align: "justify", lineGap: 2 });
    doc.moveDown(0.6);
  }

  // Tabla generica con alto de fila variable y encabezado repetido.
  function tabla(columnas, filas, { total, tam = 8, estilos } = {}) {
    const anchoTotal = columnas.reduce((a, c) => a + c.ancho, 0);
    const escala = ancho() / anchoTotal;
    const cols = columnas.map((c) => ({ ...c, w: c.ancho * escala }));
    const pad = 4;
    const encabezado = () => {
      doc.font("Helvetica-Bold").fontSize(tam);
      const alto = Math.max(...cols.map((c) => doc.heightOfString(c.titulo, { width: c.w - pad * 2 }))) + pad * 2;
      asegurar(alto + 30);
      const y = doc.y;
      doc.rect(MARGEN, y, ancho(), alto).fill(C.azul);
      let x = MARGEN;
      for (const c of cols) {
        doc.fillColor("#FFFFFF").text(c.titulo, x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      }
      doc.y = y + alto;
    };
    if (!filas.length) {
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(C.gris).text("Sin datos en el periodo.", MARGEN, doc.y);
      doc.moveDown(0.5);
      return;
    }
    encabezado();
    const fila = (f, i, negrita) => {
      doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(tam);
      const textos = cols.map((c) => {
        const v = c.valor(f);
        return v === null || v === undefined ? "" : String(v);
      });
      const alto = Math.max(...cols.map((c, j) => doc.heightOfString(textos[j] || " ", { width: c.w - pad * 2 }))) + pad * 2;
      if (doc.y + alto > limite()) {
        doc.addPage({ size: "A4", layout: doc.page.layout, margins: doc.page.margins });
        encabezado();
        doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(tam);
      }
      const y = doc.y;
      if (negrita || i % 2 === 1) doc.rect(MARGEN, y, ancho(), alto).fill(C.marfil);
      let x = MARGEN;
      cols.forEach((c, j) => {
        const fondo = estilos?.(c, f);
        if (fondo) doc.rect(x, y, c.w, alto).fill(fondo);
        doc.fillColor(C.tinta).text(textos[j], x + pad, y + pad, { width: c.w - pad * 2, align: c.alinear || "left" });
        x += c.w;
      });
      doc.moveTo(MARGEN, y + alto).lineTo(MARGEN + ancho(), y + alto).lineWidth(0.4).strokeColor(negrita ? C.azul : C.borde).stroke();
      doc.y = y + alto;
    };
    filas.forEach((f, i) => fila(f, i, false));
    if (total) fila(total, 0, true);
    doc.moveDown(0.6);
  }

  function leyenda(items, x, y, maxAncho) {
    doc.font("Helvetica").fontSize(7.5);
    let cx = x;
    let cy = y;
    for (const it of items) {
      const w = 12 + doc.widthOfString(it.nombre) + 12;
      if (cx + w > x + maxAncho) {
        cx = x;
        cy += 12;
      }
      doc.rect(cx, cy + 1, 7, 7).fill(it.color);
      doc.fillColor(C.gris).text(it.nombre, cx + 10, cy, { lineBreak: false });
      cx += w;
    }
    return cy + 12;
  }

  // Columnas agrupadas (una o varias series) con eje Y y cuadricula.
  function columnas(categorias, series, { alto = 170, valores = false } = {}) {
    asegurar(alto + 40);
    const x0 = MARGEN + 34;
    const y0 = doc.y + 6;
    const w = ancho() - 40;
    const h = alto;
    const maximo = maximoEje(Math.max(1, ...series.flatMap((s) => s.valores.map((v) => v || 0))));
    doc.font("Helvetica").fontSize(7);
    for (let k = 0; k <= 4; k += 1) {
      const yy = y0 + h - (h * k) / 4;
      doc.moveTo(x0, yy).lineTo(x0 + w, yy).lineWidth(0.4).strokeColor(C.grisClaro).stroke();
      doc.fillColor(C.gris).text(num((maximo * k) / 4), MARGEN - 4, yy - 4, { width: 36, align: "right", lineBreak: false });
    }
    const grupo = w / Math.max(categorias.length, 1);
    const anchoBarra = Math.max(2, Math.min(22, (grupo * 0.78) / series.length));
    categorias.forEach((cat, i) => {
      const inicio = x0 + i * grupo + (grupo - anchoBarra * series.length) / 2;
      series.forEach((s, j) => {
        const v = s.valores[i] || 0;
        const bh = (v / maximo) * h;
        if (bh > 0) doc.rect(inicio + j * anchoBarra, y0 + h - bh, anchoBarra - 0.6, bh).fill(s.color);
        if (valores && v) {
          doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.tinta).text(num(v), inicio + j * anchoBarra - 10, y0 + h - bh - 9, { width: anchoBarra + 20, align: "center", lineBreak: false });
        }
      });
      doc.font("Helvetica").fontSize(7).fillColor(C.gris).text(String(cat), x0 + i * grupo, y0 + h + 4, { width: grupo, align: "center", lineBreak: false });
    });
    let y = y0 + h + 16;
    if (series.length > 1) y = leyenda(series, x0, y, w);
    doc.y = y + 6;
  }

  // Torta con porcentajes y leyenda a la derecha.
  function torta(items, { radio = 70 } = {}) {
    asegurar(radio * 2 + 30);
    const total = items.reduce((s, it) => s + it.total, 0);
    const cx = MARGEN + radio + 20;
    const cy = doc.y + radio + 8;
    if (!total) {
      doc.circle(cx, cy, radio).fill(C.grisClaro);
    } else {
      let angulo = -Math.PI / 2;
      for (const it of items) {
        if (!it.total) continue;
        const a = (it.total / total) * Math.PI * 2;
        if (a >= Math.PI * 2 - 1e-6) doc.circle(cx, cy, radio).fill(it.color);
        else {
          doc.path(`M ${cx} ${cy} L ${cx + radio * Math.cos(angulo)} ${cy + radio * Math.sin(angulo)} A ${radio} ${radio} 0 ${a > Math.PI ? 1 : 0} 1 ${cx + radio * Math.cos(angulo + a)} ${cy + radio * Math.sin(angulo + a)} Z`).fill(it.color);
        }
        angulo += a;
      }
      doc.circle(cx, cy, radio * 0.52).fill("#FFFFFF");
      doc.font("Times-Bold").fontSize(16).fillColor(C.azul).text(num(total), cx - 40, cy - 10, { width: 80, align: "center", lineBreak: false });
      doc.font("Helvetica").fontSize(7).fillColor(C.gris).text("atenciones", cx - 40, cy + 8, { width: 80, align: "center", lineBreak: false });
    }
    let y = cy - radio + 6;
    const xl = cx + radio + 30;
    for (const it of items) {
      doc.rect(xl, y + 2, 9, 9).fill(it.color);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(C.tinta).text(it.nombre, xl + 15, y, { width: 150, lineBreak: false });
      doc.font("Helvetica").fontSize(9).fillColor(C.gris).text(`${num(it.total)} · ${total ? pct((it.total / total) * 100) : "0 %"}`, xl + 160, y, { width: 120, lineBreak: false });
      y += 18;
    }
    doc.y = Math.max(cy + radio, y) + 12;
  }

  // Barras horizontales con valor.
  function barrasHorizontales(items, color = C.azulSuave, anchoEtiqueta = 210) {
    const maximo = Math.max(1, ...items.map((i) => i.total));
    const anchoBarra = ancho() - anchoEtiqueta - 46;
    for (const it of items) {
      asegurar(16);
      const y = doc.y;
      doc.font("Helvetica").fontSize(8).fillColor(C.tinta).text(it.nombre, MARGEN, y + 1, { width: anchoEtiqueta - 8, ellipsis: true, lineBreak: false });
      doc.rect(MARGEN + anchoEtiqueta, y + 1, anchoBarra, 9).fill(C.grisClaro);
      if (it.total) doc.rect(MARGEN + anchoEtiqueta, y + 1, Math.max(1.5, (it.total / maximo) * anchoBarra), 9).fill(color);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(num(it.total), MARGEN + anchoEtiqueta + anchoBarra + 6, y + 1, { width: 40, lineBreak: false });
      doc.y = y + 14;
    }
    doc.moveDown(0.5);
  }

  function tarjetas(items) {
    const por = 3;
    const w = (ancho() - (por - 1) * 8) / por;
    const h = 52;
    for (let i = 0; i < items.length; i += por) {
      asegurar(h + 8);
      const y = doc.y;
      items.slice(i, i + por).forEach((it, j) => {
        const x = MARGEN + j * (w + 8);
        doc.roundedRect(x, y, w, h, 6).fill(i === 0 && j === 0 ? C.azul : C.marfil);
        const claro = i === 0 && j === 0;
        doc.font("Helvetica").fontSize(8).fillColor(claro ? "#D6DDEC" : C.gris).text(it.titulo, x + 10, y + 8, { width: w - 20, lineBreak: false });
        doc.font("Times-Bold").fontSize(20).fillColor(claro ? C.dorado : C.azul).text(it.valor, x + 10, y + 20, { width: w - 20, lineBreak: false });
        if (it.detalle) doc.font("Helvetica").fontSize(7).fillColor(claro ? "#D6DDEC" : C.gris).text(it.detalle, x + 10, y + 41, { width: w - 20, lineBreak: false });
      });
      doc.y = y + h + 8;
    }
    doc.moveDown(0.3);
  }

  // ---- 1. Proyecto ---------------------------------------------------------
  const ficha = [
    ["Nombre del proyecto", NOMBRE_PROYECTO[informe.modulo] || informe.modulo],
    ["Periodo del informe", informe.periodo],
    ["Fecha de presentación", fechaTexto(informe.fechaPresentacion)],
    ["Responsable del proyecto", informe.responsable || "—"],
    [
      "Tipo de acción",
      [
        `${informe.accionMejora ? "[X]" : "[  ]"} Mejora continua`,
        `${informe.accionCorrectiva ? "[X]" : "[  ]"} Correctivo`,
        `${informe.accionPreventiva ? "[X]" : "[  ]"} Preventivo`,
      ].join("     "),
    ],
  ];
  for (const [k, v] of ficha) {
    const y = doc.y;
    doc.rect(MARGEN, y, 150, 20).fill(C.azul);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text(k.toUpperCase(), MARGEN + 6, y + 6, { width: 140, lineBreak: false });
    doc.rect(MARGEN + 150, y, ancho() - 150, 20).lineWidth(0.5).strokeColor(C.borde).stroke();
    doc.font("Helvetica").fontSize(9.5).fillColor(C.tinta).text(String(v), MARGEN + 158, y + 5.5, { width: ancho() - 166, lineBreak: false, ellipsis: true });
    doc.y = y + 22;
  }
  if (informe.estado === "Borrador" || informe.estado === "Devuelto") {
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.doradoTexto).text("Borrador: las cifras se calculan con lo registrado hasta hoy y pueden cambiar.", MARGEN, doc.y, { width: ancho() });
  }
  tituloSeccion("DESCRIPCIÓN DEL PROYECTO");
  parrafo(informe.descripcion);
  tituloSeccion("JUSTIFICACIÓN DEL PROYECTO");
  parrafo(informe.justificacion);
  tituloSeccion("ALINEACIÓN ESTRATÉGICA");
  parrafo(informe.alineacion);
  tituloSeccion("OBJETIVOS, RESULTADOS Y BENEFICIOS ESPERADOS");
  tabla(
    [
      { titulo: "OBJETIVOS", ancho: 1, valor: (o) => o.objetivo },
      { titulo: "RESULTADOS", ancho: 1, valor: (o) => o.resultado },
      { titulo: "BENEFICIOS ESPERADOS", ancho: 1, valor: (o) => o.beneficio },
    ],
    informe.objetivos || [],
    { tam: 8 }
  );

  // ---- 2. Evaluacion -------------------------------------------------------
  nuevaPagina();
  tituloSeccion(`INFORME - EVALUACIÓN ${informe.periodo}`);
  subtitulo("Logros significativos");
  parrafo(informe.logros);
  subtitulo("Dificultades presentadas");
  parrafo(informe.dificultades);
  subtitulo("Acciones de mejora");
  parrafo(informe.accionesMejora);

  // ---- 3. Resultados en cifras --------------------------------------------
  nuevaPagina();
  const k = cifras.kpis;
  tituloSeccion(`ESTADÍSTICAS SALUD INTEGRAL ${cifras.periodo}`, "Calculadas con las atenciones y asistencias registradas en Conecta BU; los años anteriores provienen de los informes históricos.");
  const variacion =
    cifras.comparacion && cifras.comparacion.total
      ? `${k.atenciones >= cifras.comparacion.total ? "+" : ""}${pct(((k.atenciones - cifras.comparacion.total) / cifras.comparacion.total) * 100)} frente a ${cifras.comparacion.periodo}`
      : null;
  tarjetas([
    { titulo: "Atenciones del periodo", valor: num(k.atenciones), detalle: variacion },
    { titulo: "Personas atendidas", valor: num(k.personas), detalle: "personas distintas" },
    { titulo: "Actividades ejecutadas", valor: num(k.actividades), detalle: `${num(k.jornadas)} jornadas` },
    { titulo: "Cumplimiento promedio de metas", valor: pct(k.cumplimientoPromedio), detalle: `${num(k.metasCumplidas)} de ${num(k.actividadesConMeta)} metas en 90 % o más` },
    { titulo: "Atención servicio de enfermería", valor: num(k.enfermeria), detalle: `${num(k.remisiones)} remisiones` },
    { titulo: "Registro fotográfico", valor: num(k.evidencias), detalle: "fotos y soportes" },
  ]);

  subtitulo("Población atendida en el periodo", 160);
  torta(cifras.porPoblacion.map((p) => ({ nombre: p.nombre, total: p.total, color: POBLACION[p.clave]?.color || C.gris })));

  subtitulo("Impacto poblacional por periodo", 200);
  columnas(
    cifras.impacto.map((f) => f.periodo),
    ORDEN.map((p) => ({ nombre: POBLACION[p].nombre, color: POBLACION[p].color, valores: cifras.impacto.map((f) => f[p] || 0) })),
    { alto: 160 }
  );
  tabla(
    [
      { titulo: "Periodo", ancho: 1.1, valor: (f) => f.periodo },
      ...ORDEN.map((p) => ({ titulo: POBLACION[p].nombre, ancho: 1, alinear: "right", valor: (f) => num(f[p] || 0) })),
      { titulo: "Total", ancho: 1, alinear: "right", valor: (f) => num(f.total) },
    ],
    cifras.impacto,
    { tam: 7.5, estilos: (c, f) => (f.fuente === "conecta" ? C.amarillo : null) }
  );

  subtitulo("Atención servicio de enfermería", 150);
  columnas(
    cifras.enfermeria.map((f) => f.periodo),
    [{ nombre: "Población atendida", color: "#0D9488", valores: cifras.enfermeria.map((f) => f.total) }],
    { alto: 120, valores: true }
  );

  subtitulo("Población general frente a años anteriores", 150);
  columnas(
    cifras.poblacionGeneral.map((f) => f.periodo),
    [{ nombre: "Población general", color: C.azulSuave, valores: cifras.poblacionGeneral.map((f) => f.total) }],
    { alto: 120, valores: true }
  );

  subtitulo(`Asistencia población objeto ${cifras.periodo}`, Math.min(cifras.asistenciaObjeto.length * 14, 300));
  barrasHorizontales(cifras.asistenciaObjeto);

  subtitulo(`Atenciones por línea de acción ${cifras.periodo}`, cifras.porCategoria.length * 14);
  barrasHorizontales(cifras.porCategoria, C.dorado);

  // ---- 4. Relacion de atendidos (horizontal) --------------------------------
  nuevaPagina("landscape");
  tituloSeccion(`INFORME RELACIÓN ATENDIDOS ${cifras.periodo}`, "Una fila por jornada (actividades puntuales) o por servicio permanente. El detalle por programa está en el Excel.");
  const grupo = (f, prefijo) => Object.entries(f.conteo).filter(([c]) => c.startsWith(prefijo)).reduce((s, [, v]) => s + v, 0);
  const SEMAFORO = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo };
  const filasMatriz = cifras.matriz.filas;
  tabla(
    [
      { titulo: "Línea de acción", ancho: 2.2, valor: (f) => (f.primeraFila ? f.categoria : "") },
      { titulo: "Actividad / jornada", ancho: 2.6, valor: (f) => f.actividad },
      { titulo: "Fecha de ejecución", ancho: 1.5, valor: (f) => f.fecha },
      { titulo: "Admin.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Administrativo) },
      { titulo: "Docentes", ancho: 0.8, alinear: "right", valor: (f) => num(f.conteo.Docente) },
      { titulo: "Egres.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Egresado) },
      { titulo: "Extern.", ancho: 0.7, alinear: "right", valor: (f) => num(f.conteo.Externo) },
      { titulo: "Posgrado", ancho: 0.8, alinear: "right", valor: (f) => num(grupo(f, "pos:")) },
      { titulo: "Pregrado", ancho: 0.8, alinear: "right", valor: (f) => num(grupo(f, "pre:")) },
      { titulo: "Total", ancho: 0.7, alinear: "right", valor: (f) => num(f.total) },
      { titulo: "Meta", ancho: 0.6, alinear: "right", valor: (f) => (f.primeraFila ? num(f.meta) : "") },
      { titulo: "Logro", ancho: 0.6, alinear: "right", valor: (f) => (f.primeraFila ? num(f.logro) : "") },
      { titulo: "Cumpl.", ancho: 0.8, alinear: "right", valor: (f) => (f.primeraFila && f.cumplimiento !== null ? pct(f.cumplimiento) : "") },
    ],
    filasMatriz,
    {
      tam: 7.5,
      total: filasMatriz.length
        ? {
            primeraFila: true,
            categoria: "TOTAL",
            actividad: "",
            fecha: "",
            conteo: cifras.matriz.totales,
            total: cifras.matriz.total,
            meta: null,
            logro: null,
            cumplimiento: null,
          }
        : null,
      estilos: (c, f) => (c.titulo === "Cumpl." && f.semaforo ? SEMAFORO[f.semaforo] : null),
    }
  );

  // ---- 5. Avances por actividad ----------------------------------------------
  nuevaPagina();
  tituloSeccion("AVANCES, DIFICULTADES Y APRENDIZAJES POR ACTIVIDAD");
  if (!cifras.actividades.length) parrafo("", "No hay actividades con atenciones en el periodo.");
  for (const a of cifras.actividades) {
    asegurar(70);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.azul).text(a.nombre, MARGEN, y, { width: ancho() - 150 });
    const etiqueta = a.cumplimiento === null ? "Sin meta" : `Cumplimiento ${pct(a.cumplimiento)}`;
    const color = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo }[a.semaforo] || C.grisClaro;
    doc.roundedRect(MARGEN + ancho() - 140, y - 1, 140, 15, 7).fill(color);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(etiqueta, MARGEN + ancho() - 140, y + 2.5, { width: 140, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(8).fillColor(C.gris).text(
      `${a.categoria} · ${num(a.atenciones)} atenciones · meta ${num(a.meta)} · logro ${num(a.logro)}${a.presupuesto ? ` · presupuesto ejecutado $${num(a.presupuesto)}` : ""}`,
      MARGEN,
      doc.y + 1,
      { width: ancho() }
    );
    doc.moveDown(0.3);
    for (const [titulo, valor] of [
      ["Avances", a.avances],
      ["Dificultades", a.dificultades],
      ["Aprendizajes", a.aprendizajes],
      ["Pendientes", a.pendientes],
      ["Observaciones", a.observaciones],
    ]) {
      if (!String(valor || "").trim()) continue;
      asegurar(28);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.tinta).text(`${titulo}: `, MARGEN, doc.y, { continued: true });
      doc.font("Helvetica").fillColor(C.tinta).text(String(valor), { width: ancho(), align: "justify" });
    }
    doc.moveDown(0.3);
    doc.moveTo(MARGEN, doc.y).lineTo(MARGEN + ancho(), doc.y).lineWidth(0.4).strokeColor(C.borde).stroke();
    doc.moveDown(0.5);
  }

  // ---- 6. Registro fotografico -------------------------------------------------
  const fotos = cifras.evidencias.filter((e) => ["image/jpeg", "image/png"].includes(e.tipoMime)).slice(0, 48);
  nuevaPagina();
  tituloSeccion(`REGISTRO FOTOGRÁFICO ${cifras.periodo}`, fotos.length ? null : "No hay fotos cargadas como evidencia en este periodo.");
  const anchoFoto = (ancho() - 14) / 2;
  const altoFoto = 190;
  let columna = 0;
  for (const e of fotos) {
    const buffer = await leerArchivo(e).catch(() => null);
    if (!buffer) continue;
    if (columna === 0) asegurar(altoFoto + 34);
    const x = MARGEN + columna * (anchoFoto + 14);
    const y = doc.y;
    doc.rect(x, y, anchoFoto, altoFoto).fill(C.marfil);
    const dim = dimensiones(buffer) || { ancho: 4, alto: 3 };
    const escala = Math.min(anchoFoto / dim.ancho, altoFoto / dim.alto);
    const w = dim.ancho * escala;
    const h = dim.alto * escala;
    try {
      doc.image(buffer, x + (anchoFoto - w) / 2, y + (altoFoto - h) / 2, { width: w, height: h });
    } catch {
      /* imagen danada: se deja el recuadro */
    }
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(e.actividad, x, y + altoFoto + 4, { width: anchoFoto, lineBreak: false, ellipsis: true });
    doc.font("Helvetica").fontSize(7.5).fillColor(C.gris).text(`${fechaTexto(e.fecha)}${e.descripcion ? ` · ${e.descripcion}` : ""}`, x, y + altoFoto + 15, { width: anchoFoto, lineBreak: false, ellipsis: true });
    if (columna === 1) doc.y = y + altoFoto + 34;
    else doc.y = y;
    columna = (columna + 1) % 2;
  }
  if (columna === 1) doc.y += altoFoto + 34;
  const otros = cifras.evidencias.filter((e) => !["image/jpeg", "image/png"].includes(e.tipoMime));
  if (otros.length) {
    subtitulo("Otros soportes (PDF y otros formatos, disponibles en Conecta BU)");
    for (const e of otros) {
      asegurar(14);
      doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(`• ${e.nombreArchivo} — ${e.actividad} (${fechaTexto(e.fecha)})`, MARGEN, doc.y, { width: ancho() });
    }
  }

  // ---- Encabezado y pie en todas las paginas ------------------------------------
  const rango = doc.bufferedPageRange();
  const generado = new Date(cifras.generado || Date.now()).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
  for (let i = rango.start; i < rango.start + rango.count; i += 1) {
    doc.switchToPage(i);
    const anchoPagina = doc.page.width;
    const anchoUtil = anchoPagina - MARGEN * 2;
    const y = MARGEN - 8;
    const h = ALTO_ENCABEZADO - 12;
    const wLogo = 64;
    const wMeta = 130;
    // El encabezado y el pie se dibujan dentro de los margenes: se quitan
    // temporalmente para que pdfkit no agregue paginas.
    const margenes = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    doc.lineWidth(0.6).strokeColor(C.azul);
    doc.rect(MARGEN, y, anchoUtil, h).stroke();
    doc.moveTo(MARGEN + wLogo, y).lineTo(MARGEN + wLogo, y + h).stroke();
    doc.moveTo(MARGEN + anchoUtil - wMeta, y).lineTo(MARGEN + anchoUtil - wMeta, y + h).stroke();
    if (logo) doc.image(logo, MARGEN + 8, y + 4, { fit: [wLogo - 16, h - 8], align: "center", valign: "center" });
    const xc = MARGEN + wLogo;
    const wc = anchoUtil - wLogo - wMeta;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.azul).text("CORPORACIÓN UNIVERSITARIA AUTÓNOMA DEL CAUCA", xc, y + 8, { width: wc, align: "center", lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(`INFORME DE GESTIÓN · ${NOMBRE_PROYECTO[informe.modulo] || ""} · ${informe.periodo}`, xc, y + 22, { width: wc, align: "center", lineBreak: false });
    doc.rect(xc, y + h - 18, wc, 18).fill(C.azul);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF").text(FORMATO.proceso, xc, y + h - 13, { width: wc, align: "center", lineBreak: false });
    const meta = [
      ["Código", FORMATO.codigo],
      ["Versión", String(FORMATO.version)],
      ["Fecha", new Date(`${FORMATO.fecha}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" })],
      ["Página", `${i - rango.start + 1} de ${rango.count}`],
    ];
    const xm = MARGEN + anchoUtil - wMeta;
    meta.forEach(([kk, v], j) => {
      const yy = y + (h / 4) * j;
      if (j) doc.moveTo(xm, yy).lineTo(xm + wMeta, yy).lineWidth(0.4).strokeColor(C.borde).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(C.gris).text(kk, xm + 6, yy + h / 8 - 4, { width: 50, lineBreak: false });
      doc.font("Helvetica").fontSize(7.5).fillColor(C.tinta).text(v, xm + 54, yy + h / 8 - 4, { width: wMeta - 60, lineBreak: false });
    });
    // Pie.
    const yp = doc.page.height - MARGEN - ALTO_PIE + 10;
    doc.moveTo(MARGEN, yp).lineTo(MARGEN + anchoUtil, yp).lineWidth(0.4).strokeColor(C.borde).stroke();
    doc.font("Helvetica").fontSize(7).fillColor(C.gris).text(
      `Conecta BU · Bienestar Universitario · generado el ${generado}`,
      MARGEN,
      yp + 6,
      { width: anchoUtil / 2, lineBreak: false }
    );
    const estado = `${ESTADO_TEXTO[informe.estado] || informe.estado}${informe.version ? ` · versión ${informe.version}` : ""}`;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(informe.estado === "Borrador" ? C.doradoTexto : C.azul).text(estado, MARGEN + anchoUtil / 2, yp + 6, {
      width: anchoUtil / 2,
      align: "right",
      lineBreak: false,
    });
    doc.page.margins = margenes;
  }
  doc.end();
  return fin;
}

module.exports = { generarPdf };
