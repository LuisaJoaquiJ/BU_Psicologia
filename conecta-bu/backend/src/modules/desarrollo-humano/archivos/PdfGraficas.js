const { PdfDocumento, C, MARGEN } = require("./PdfDocumento");

// Graficas sencillas dibujadas con vectores para los PDF: barras apiladas,
// columnas por semana y probabilidades con su intervalo de confianza.
class PdfGraficas extends PdfDocumento {
  barraApilada(etiqueta, partes, maximo, anchoEtiqueta = 130) {
    this.asegurar(22);
    const y = this.doc.y;
    const anchoBarra = this.ancho - anchoEtiqueta - 40;
    this.doc.font("Helvetica").fontSize(8.5).fillColor(C.tinta).text(etiqueta, MARGEN, y + 2, { width: anchoEtiqueta - 8, ellipsis: true, lineBreak: false });
    let x = MARGEN + anchoEtiqueta;
    const total = partes.reduce((a, p) => a + p.valor, 0);
    if (total === 0) this.doc.rect(x, y, anchoBarra, 12).fill(C.grisClaro);
    for (const p of partes) {
      if (!p.valor) continue;
      const w = (p.valor / maximo) * anchoBarra;
      this.doc.rect(x, y, Math.max(w - 1, 0.5), 12).fill(p.color);
      if (w > 16) {
        this.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(p.color === C.Cancelada || p.color === C.grisClaro ? C.tinta : "#FFFFFF");
        this.doc.text(String(p.valor), x, y + 2.5, { width: w - 1, align: "center", lineBreak: false });
      }
      x += w;
    }
    this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.gris).text(String(total), x + 5, y + 2, { lineBreak: false });
    this.doc.y = y + 19;
  }

  columnasSemanales(semanas) {
    const alto = 150;
    this.asegurar(alto + 50);
    const estados = ["Atendida", "NoAsistio", "Cancelada", "Agendada"];
    this.leyenda(estados, this.doc.y);
    const y0 = this.doc.y + 6;
    const maximo = Math.max(1, ...semanas.map((s) => s.total));
    const paso = Math.max(1, Math.ceil(maximo / 4));
    const tope = paso * 4;
    const ejeX = MARGEN + 22;
    const anchoGraf = this.ancho - 22;

    this.doc.font("Helvetica").fontSize(7).fillColor(C.gris);
    for (let v = 0; v <= tope; v += paso) {
      const y = y0 + alto - (v / tope) * alto;
      this.doc.moveTo(ejeX, y).lineTo(ejeX + anchoGraf, y).lineWidth(0.4).strokeColor(C.borde).stroke();
      this.doc.fillColor(C.gris).text(String(v), MARGEN, y - 3.5, { width: 18, align: "right", lineBreak: false });
    }
    const n = semanas.length || 1;
    const hueco = anchoGraf / n;
    const w = Math.min(26, hueco * 0.62);
    semanas.forEach((s, i) => {
      let y = y0 + alto;
      const x = ejeX + i * hueco + (hueco - w) / 2;
      for (const e of estados) {
        if (!s[e]) continue;
        const h = (s[e] / tope) * alto;
        this.doc.rect(x, y - h, w, Math.max(h - 0.8, 0.5)).fill(C[e]);
        y -= h;
      }
      if (n <= 14 || i % 2 === 0) {
        const f = new Date(`${s.semana}T00:00:00Z`);
        const texto = f.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
        this.doc.font("Helvetica").fontSize(6.5).fillColor(C.gris).text(texto, x - 10, y0 + alto + 4, { width: w + 20, align: "center", lineBreak: false });
      }
    });
    this.doc.y = y0 + alto + 20;
  }

  probabilidad(etiqueta, p, color) {
    this.asegurar(34);
    const y = this.doc.y;
    const anchoEtiqueta = 190;
    const anchoEscala = this.ancho - anchoEtiqueta - 70;
    const x0 = MARGEN + anchoEtiqueta;
    this.doc.font("Helvetica").fontSize(9).fillColor(C.tinta).text(etiqueta, MARGEN, y + 3, { width: anchoEtiqueta - 10 });
    this.doc.rect(x0, y + 6, anchoEscala, 4).fill(C.grisClaro);
    if (p.probabilidad === null) {
      this.doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(C.gris).text("Sin datos", x0 + anchoEscala + 8, y + 3, { lineBreak: false });
    } else {
      const xb = x0 + (p.bajo / 100) * anchoEscala;
      const xa = x0 + (p.alto / 100) * anchoEscala;
      this.doc.save().fillOpacity(0.28).rect(xb, y + 3, Math.max(xa - xb, 1), 10).fill(color).restore();
      this.doc.circle(x0 + (p.probabilidad / 100) * anchoEscala, y + 8, 4.5).fill(color);
      this.doc.font("Helvetica-Bold").fontSize(10).fillColor(C.azul).text(`${p.probabilidad.toLocaleString("es-CO")} %`, x0 + anchoEscala + 8, y + 2, { lineBreak: false });
      this.doc.font("Helvetica").fontSize(7.5).fillColor(C.gris)
        .text(`IC 95 %: ${p.bajo.toLocaleString("es-CO")} – ${p.alto.toLocaleString("es-CO")} %  ·  n = ${p.n}`, x0, y + 16, { lineBreak: false });
    }
    this.doc.y = y + 30;
  }
}

module.exports = { PdfGraficas };
