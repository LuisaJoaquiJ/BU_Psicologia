const { PdfInformeBase } = require("./PdfInformeBase");
const { C, MARGEN, num, pct, maximoEje } = require("./formatoPdf");

// Graficas del informe dibujadas con vectores: columnas, torta, barras
// horizontales y tarjetas de indicadores.
class PdfInformeGraficas extends PdfInformeBase {
  leyenda(items, x, y, maxAncho) {
    this.doc.font("Helvetica").fontSize(7.5);
    let cx = x;
    let cy = y;
    for (const it of items) {
      const w = 12 + this.doc.widthOfString(it.nombre) + 12;
      if (cx + w > x + maxAncho) {
        cx = x;
        cy += 12;
      }
      this.doc.rect(cx, cy + 1, 7, 7).fill(it.color);
      this.doc.fillColor(C.gris).text(it.nombre, cx + 10, cy, { lineBreak: false });
      cx += w;
    }
    return cy + 12;
  }

  columnas(categorias, series, { alto = 170, valores = false } = {}) {
    this.asegurar(alto + 40);
    const x0 = MARGEN + 34;
    const y0 = this.doc.y + 6;
    const w = this.ancho() - 40;
    const h = alto;
    const maximo = maximoEje(Math.max(1, ...series.flatMap((s) => s.valores.map((v) => v || 0))));
    this.doc.font("Helvetica").fontSize(7);
    for (let k = 0; k <= 4; k += 1) {
      const yy = y0 + h - (h * k) / 4;
      this.doc.moveTo(x0, yy).lineTo(x0 + w, yy).lineWidth(0.4).strokeColor(C.grisClaro).stroke();
      this.doc.fillColor(C.gris).text(num((maximo * k) / 4), MARGEN - 4, yy - 4, { width: 36, align: "right", lineBreak: false });
    }
    const grupo = w / Math.max(categorias.length, 1);
    const anchoBarra = Math.max(2, Math.min(22, (grupo * 0.78) / series.length));
    categorias.forEach((cat, i) => {
      const inicio = x0 + i * grupo + (grupo - anchoBarra * series.length) / 2;
      series.forEach((s, j) => {
        const v = s.valores[i] || 0;
        const bh = (v / maximo) * h;
        if (bh > 0) this.doc.rect(inicio + j * anchoBarra, y0 + h - bh, anchoBarra - 0.6, bh).fill(s.color);
        if (valores && v) {
          this.doc.font("Helvetica-Bold").fontSize(6.5).fillColor(C.tinta).text(num(v), inicio + j * anchoBarra - 10, y0 + h - bh - 9, { width: anchoBarra + 20, align: "center", lineBreak: false });
        }
      });
      this.doc.font("Helvetica").fontSize(7).fillColor(C.gris).text(String(cat), x0 + i * grupo, y0 + h + 4, { width: grupo, align: "center", lineBreak: false });
    });
    let y = y0 + h + 16;
    if (series.length > 1) y = this.leyenda(series, x0, y, w);
    this.doc.y = y + 6;
  }

  torta(items, { radio = 70 } = {}) {
    this.asegurar(radio * 2 + 30);
    const total = items.reduce((s, it) => s + it.total, 0);
    const cx = MARGEN + radio + 20;
    const cy = this.doc.y + radio + 8;
    if (!total) {
      this.doc.circle(cx, cy, radio).fill(C.grisClaro);
    } else {
      let angulo = -Math.PI / 2;
      for (const it of items) {
        if (!it.total) continue;
        const a = (it.total / total) * Math.PI * 2;
        if (a >= Math.PI * 2 - 1e-6) this.doc.circle(cx, cy, radio).fill(it.color);
        else {
          this.doc.path(`M ${cx} ${cy} L ${cx + radio * Math.cos(angulo)} ${cy + radio * Math.sin(angulo)} A ${radio} ${radio} 0 ${a > Math.PI ? 1 : 0} 1 ${cx + radio * Math.cos(angulo + a)} ${cy + radio * Math.sin(angulo + a)} Z`).fill(it.color);
        }
        angulo += a;
      }
      this.doc.circle(cx, cy, radio * 0.52).fill("#FFFFFF");
      this.doc.font("Times-Bold").fontSize(16).fillColor(C.azul).text(num(total), cx - 40, cy - 10, { width: 80, align: "center", lineBreak: false });
      this.doc.font("Helvetica").fontSize(7).fillColor(C.gris).text("atenciones", cx - 40, cy + 8, { width: 80, align: "center", lineBreak: false });
    }
    let y = cy - radio + 6;
    const xl = cx + radio + 30;
    for (const it of items) {
      this.doc.rect(xl, y + 2, 9, 9).fill(it.color);
      this.doc.font("Helvetica-Bold").fontSize(9).fillColor(C.tinta).text(it.nombre, xl + 15, y, { width: 150, lineBreak: false });
      this.doc.font("Helvetica").fontSize(9).fillColor(C.gris).text(`${num(it.total)} · ${total ? pct((it.total / total) * 100) : "0 %"}`, xl + 160, y, { width: 120, lineBreak: false });
      y += 18;
    }
    this.doc.y = Math.max(cy + radio, y) + 12;
  }

  barrasHorizontales(items, color = C.azulSuave, anchoEtiqueta = 210) {
    const maximo = Math.max(1, ...items.map((i) => i.total));
    const anchoBarra = this.ancho() - anchoEtiqueta - 46;
    for (const it of items) {
      this.asegurar(16);
      const y = this.doc.y;
      this.doc.font("Helvetica").fontSize(8).fillColor(C.tinta).text(it.nombre, MARGEN, y + 1, { width: anchoEtiqueta - 8, ellipsis: true, lineBreak: false });
      this.doc.rect(MARGEN + anchoEtiqueta, y + 1, anchoBarra, 9).fill(C.grisClaro);
      if (it.total) this.doc.rect(MARGEN + anchoEtiqueta, y + 1, Math.max(1.5, (it.total / maximo) * anchoBarra), 9).fill(color);
      this.doc.font("Helvetica-Bold").fontSize(8).fillColor(C.tinta).text(num(it.total), MARGEN + anchoEtiqueta + anchoBarra + 6, y + 1, { width: 40, lineBreak: false });
      this.doc.y = y + 14;
    }
    this.doc.moveDown(0.5);
  }

  tarjetas(items) {
    const por = 3;
    const w = (this.ancho() - (por - 1) * 8) / por;
    const h = 52;
    for (let i = 0; i < items.length; i += por) {
      this.asegurar(h + 8);
      const y = this.doc.y;
      items.slice(i, i + por).forEach((it, j) => {
        const x = MARGEN + j * (w + 8);
        this.doc.roundedRect(x, y, w, h, 6).fill(i === 0 && j === 0 ? C.azul : C.marfil);
        const claro = i === 0 && j === 0;
        this.doc.font("Helvetica").fontSize(8).fillColor(claro ? "#D6DDEC" : C.gris).text(it.titulo, x + 10, y + 8, { width: w - 20, lineBreak: false });
        this.doc.font("Times-Bold").fontSize(20).fillColor(claro ? C.dorado : C.azul).text(it.valor, x + 10, y + 20, { width: w - 20, lineBreak: false });
        if (it.detalle) this.doc.font("Helvetica").fontSize(7).fillColor(claro ? "#D6DDEC" : C.gris).text(it.detalle, x + 10, y + 41, { width: w - 20, lineBreak: false });
      });
      this.doc.y = y + h + 8;
    }
    this.doc.moveDown(0.3);
  }
}

module.exports = { PdfInformeGraficas };
