// Graficas nativas de Excel (barras, columnas agrupadas, torta y lineas).
// exceljs no escribe graficas, asi que se agregan al .xlsx ya generado:
// xl/charts/chartN.xml + un dibujo (drawing) anclado a la hoja. Las graficas
// apuntan a rangos de celdas, de modo que si alguien corrige un valor en el
// Excel la grafica se actualiza sola, como en el informe original.
const JSZip = require("jszip");

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const REL_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const REL_CHART = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const CT_CHART = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const color = (hex) => String(hex || "163F86").replace("#", "").toUpperCase();

// Referencia absoluta de un rango: hoja, columnas y filas en base 1.
function rango(hoja, col1, fila1, col2, fila2) {
  const letra = (n) => {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  return `'${hoja.replace(/'/g, "''")}'!$${letra(col1)}$${fila1}:$${letra(col2)}$${fila2}`;
}

function texto(titulo, tam = 1300, negrita = true) {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${tam}" b="${negrita ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="es-CO" sz="${tam}" b="${negrita ? 1 : 0}"><a:solidFill><a:srgbClr val="0B2A5B"/></a:solidFill></a:rPr><a:t>${esc(
    titulo
  )}</a:t></a:r></a:p></c:rich></c:tx>`;
}

function cacheTexto(valores) {
  return `<c:strCache><c:ptCount val="${valores.length}"/>${valores.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:strCache>`;
}

function cacheNumeros(valores) {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${valores.length}"/>${valores
    .map((v, i) => (v === null || v === undefined ? "" : `<c:pt idx="${i}"><c:v>${Number(v)}</c:v></c:pt>`))
    .join("")}</c:numCache>`;
}

function relleno(hex) {
  return `<c:spPr><a:solidFill><a:srgbClr val="${color(hex)}"/></a:solidFill></c:spPr>`;
}

function serie(s, i, g, tipo) {
  const nombre = `<c:tx><c:v>${esc(s.nombre)}</c:v></c:tx>`;
  const cat = `<c:cat><c:strRef><c:f>${g.categorias.ref}</c:f>${cacheTexto(g.categorias.valores)}</c:strRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${s.ref}</c:f>${cacheNumeros(s.valores)}</c:numRef></c:val>`;
  if (tipo === "torta") {
    const puntos = g.categorias.valores
      .map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/>${relleno((g.colores || [])[k % (g.colores || [1]).length])}</c:dPt>`)
      .join("");
    const etiquetas =
      '<c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>';
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${nombre}${puntos}${etiquetas}${cat}${val}</c:ser>`;
  }
  if (tipo === "lineas") {
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${nombre}<c:spPr><a:ln w="28575"><a:solidFill><a:srgbClr val="${color(
      s.color
    )}"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/>${relleno(s.color)}</c:marker>${cat}${val}<c:smooth val="0"/></c:ser>`;
  }
  const etiquetas = g.etiquetas
    ? '<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"/></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>'
    : "";
  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${nombre}${relleno(s.color)}<c:invertIfNegative val="0"/>${etiquetas}${cat}${val}</c:ser>`;
}

function ejes(g, horizontal) {
  const gris = '<c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D5DBE8"/></a:solidFill></a:ln></c:spPr>';
  const txt = (sz) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"><a:solidFill><a:srgbClr val="5B6478"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr>`;
  const tituloEje = (t) => (t ? `<c:title>${texto(t, 900, false)}<c:overlay val="0"/></c:title>` : "");
  return (
    `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${
      horizontal ? "l" : "b"
    }"/>${tituloEje(g.ejeX)}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${gris}${txt(
      horizontal ? 800 : 900
    )}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "b" : "l"}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="EDEFF4"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>${tituloEje(
      g.ejeY
    )}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txt(
      900
    )}<c:crossAx val="5001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

function xmlGrafica(g) {
  let trama;
  if (g.tipo === "torta") {
    trama = `<c:pieChart><c:varyColors val="1"/>${g.series.map((s, i) => serie(s, i, g, "torta")).join("")}<c:firstSliceAng val="0"/></c:pieChart>`;
  } else if (g.tipo === "lineas") {
    trama = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${g.series
      .map((s, i) => serie(s, i, g, "lineas"))
      .join("")}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>${ejes(g, false)}`;
  } else {
    const horizontal = g.tipo === "barrasHorizontales";
    trama = `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="${g.apiladas ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${g.series
      .map((s, i) => serie(s, i, g, "barras"))
      .join("")}<c:gapWidth val="${g.series.length > 1 ? 60 : 45}"/>${g.apiladas ? '<c:overlap val="100"/>' : ""}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>${ejes(
      g,
      horizontal
    )}`;
  }
  const leyenda =
    g.leyenda === false
      ? ""
      : `<c:legend><c:legendPos val="${g.tipo === "torta" ? "r" : "b"}"/><c:overlay val="0"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="0E1726"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr></c:legend>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:lang val="es-CO"/><c:roundedCorners val="0"/><c:chart><c:title>${texto(
    g.titulo
  )}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${trama}<c:spPr><a:noFill/></c:spPr></c:plotArea>${leyenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="E5E0D2"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function ancla(g, i, relId) {
  const { desde, hasta } = g;
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${desde.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${desde.fila}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${hasta.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${hasta.fila}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${
    1000 + i
  }" name="${esc(g.titulo)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="${relId}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
}

// Ruta del XML de una hoja a partir de su nombre visible.
async function rutaDeHoja(zip, nombre) {
  const libro = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const hojas = [...libro.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]);
  const desescapar = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const hoja = hojas.find((h) => desescapar(/name="([^"]*)"/.exec(h)[1]) === nombre);
  if (!hoja) throw new Error(`No existe la hoja ${nombre}`);
  const rid = /r:id="([^"]+)"/.exec(hoja)[1];
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`));
  const destino = /Target="([^"]+)"/.exec(rel)[1].replace(/^\/?xl\//, "");
  return `xl/${destino}`;
}

async function agregarGraficas(buffer, graficasPorHoja) {
  const zip = await JSZip.loadAsync(buffer);
  let tipos = await zip.file("[Content_Types].xml").async("string");
  const existentesGraficas = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f)).length;
  const existentesDibujos = Object.keys(zip.files).filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f)).length;
  let nGrafica = existentesGraficas;
  let nDibujo = existentesDibujos;

  for (const [nombreHoja, graficas] of Object.entries(graficasPorHoja)) {
    if (!graficas.length) continue;
    const rutaHoja = await rutaDeHoja(zip, nombreHoja);
    let hojaXml = await zip.file(rutaHoja).async("string");
    if (/<drawing\b/.test(hojaXml)) throw new Error(`La hoja ${nombreHoja} ya tiene un dibujo; no se pueden agregar graficas.`);
    nDibujo += 1;
    const rutaDibujo = `xl/drawings/drawing${nDibujo}.xml`;
    const relsDibujo = [];
    const anclas = graficas.map((g, i) => {
      nGrafica += 1;
      zip.file(`xl/charts/chart${nGrafica}.xml`, xmlGrafica(g));
      tipos = tipos.replace("</Types>", `<Override PartName="/xl/charts/chart${nGrafica}.xml" ContentType="${CT_CHART}"/></Types>`);
      const relId = `rId${i + 1}`;
      relsDibujo.push(`<Relationship Id="${relId}" Type="${REL_CHART}" Target="../charts/chart${nGrafica}.xml"/>`);
      return ancla(g, i, relId);
    });
    zip.file(
      rutaDibujo,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anclas.join("")}</xdr:wsDr>`
    );
    zip.file(
      `xl/drawings/_rels/drawing${nDibujo}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsDibujo.join("")}</Relationships>`
    );
    tipos = tipos.replace("</Types>", `<Override PartName="/${rutaDibujo}" ContentType="${CT_DRAWING}"/></Types>`);

    // Relacion hoja -> dibujo.
    const carpeta = rutaHoja.substring(0, rutaHoja.lastIndexOf("/"));
    const archivo = rutaHoja.substring(rutaHoja.lastIndexOf("/") + 1);
    const rutaRels = `${carpeta}/_rels/${archivo}.rels`;
    let rels = zip.file(rutaRels)
      ? await zip.file(rutaRels).async("string")
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    const idDibujo = "rIdGraficas1";
    rels = rels.replace("</Relationships>", `<Relationship Id="${idDibujo}" Type="${REL_DRAWING}" Target="../drawings/drawing${nDibujo}.xml"/></Relationships>`);
    zip.file(rutaRels, rels);

    // <drawing> va antes de legacyDrawing, tableParts y extLst (orden del esquema).
    if (!/xmlns:r=/.test(hojaXml.slice(0, 600))) hojaXml = hojaXml.replace("<worksheet ", `<worksheet xmlns:r="${NS_R}" `);
    const etiqueta = `<drawing r:id="${idDibujo}"/>`;
    const siguiente = hojaXml.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
    hojaXml = siguiente >= 0 ? hojaXml.slice(0, siguiente) + etiqueta + hojaXml.slice(siguiente) : hojaXml.replace("</worksheet>", `${etiqueta}</worksheet>`);
    zip.file(rutaHoja, hojaXml);
  }
  zip.file("[Content_Types].xml", tipos);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { agregarGraficas, rango, xmlGrafica };
