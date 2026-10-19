const { PdfInformeGraficas } = require("./PdfInformeGraficas");
const { NOMBRE_PROYECTO } = require("../../utils/informe/plantilla");
const { C, POBLACION, ORDEN, MARGEN, num, pct, fechaTexto } = require("./formatoPdf");

// Primeras secciones del informe: proyecto, evaluacion y resultados en cifras.
class PdfInformeSecciones extends PdfInformeGraficas {
  proyecto(informe) {
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
      const y = this.doc.y;
      this.doc.rect(MARGEN, y, 150, 20).fill(C.azul);
      this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text(k.toUpperCase(), MARGEN + 6, y + 6, { width: 140, lineBreak: false });
      this.doc.rect(MARGEN + 150, y, this.ancho() - 150, 20).lineWidth(0.5).strokeColor(C.borde).stroke();
      this.doc.font("Helvetica").fontSize(9.5).fillColor(C.tinta).text(String(v), MARGEN + 158, y + 5.5, { width: this.ancho() - 166, lineBreak: false, ellipsis: true });
      this.doc.y = y + 22;
    }
    if (informe.estado === "Borrador" || informe.estado === "Devuelto") {
      this.doc.moveDown(0.3);
      this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.doradoTexto).text("Borrador: las cifras se calculan con lo registrado hasta hoy y pueden cambiar.", MARGEN, this.doc.y, { width: this.ancho() });
    }
    this.tituloSeccion("DESCRIPCIÓN DEL PROYECTO");
    this.parrafo(informe.descripcion);
    this.tituloSeccion("JUSTIFICACIÓN DEL PROYECTO");
    this.parrafo(informe.justificacion);
    this.tituloSeccion("ALINEACIÓN ESTRATÉGICA");
    this.parrafo(informe.alineacion);
    this.tituloSeccion("OBJETIVOS, RESULTADOS Y BENEFICIOS ESPERADOS");
    this.tabla(
      [
        { titulo: "OBJETIVOS", ancho: 1, valor: (o) => o.objetivo },
        { titulo: "RESULTADOS", ancho: 1, valor: (o) => o.resultado },
        { titulo: "BENEFICIOS ESPERADOS", ancho: 1, valor: (o) => o.beneficio },
      ],
      informe.objetivos || [],
      { tam: 8 }
    );
  }

  evaluacion(informe) {
    // ---- 2. Evaluacion -------------------------------------------------------
    this.nuevaPagina();
    this.tituloSeccion(`INFORME - EVALUACIÓN ${informe.periodo}`);
    this.subtitulo("Logros significativos");
    this.parrafo(informe.logros);
    this.subtitulo("Dificultades presentadas");
    this.parrafo(informe.dificultades);
    this.subtitulo("Acciones de mejora");
    this.parrafo(informe.accionesMejora);
  }

  resultados(cifras) {
    // ---- 3. Resultados en cifras --------------------------------------------
    this.nuevaPagina();
    const k = cifras.kpis;
    this.tituloSeccion(`ESTADÍSTICAS SALUD INTEGRAL ${cifras.periodo}`, "Calculadas con las atenciones y asistencias registradas en Conecta BU; los años anteriores provienen de los informes históricos.");
    const variacion =
      cifras.comparacion && cifras.comparacion.total
        ? `${k.atenciones >= cifras.comparacion.total ? "+" : ""}${pct(((k.atenciones - cifras.comparacion.total) / cifras.comparacion.total) * 100)} frente a ${cifras.comparacion.periodo}`
        : null;
    this.tarjetas([
      { titulo: "Atenciones del periodo", valor: num(k.atenciones), detalle: variacion },
      { titulo: "Personas atendidas", valor: num(k.personas), detalle: "personas distintas" },
      { titulo: "Actividades ejecutadas", valor: num(k.actividades), detalle: `${num(k.jornadas)} jornadas` },
      { titulo: "Cumplimiento promedio de metas", valor: pct(k.cumplimientoPromedio), detalle: `${num(k.metasCumplidas)} de ${num(k.actividadesConMeta)} metas en 90 % o más` },
      { titulo: "Atención servicio de enfermería", valor: num(k.enfermeria), detalle: `${num(k.remisiones)} remisiones` },
      { titulo: "Registro fotográfico", valor: num(k.evidencias), detalle: "fotos y soportes" },
    ]);

    this.subtitulo("Población atendida en el periodo", 160);
    this.torta(cifras.porPoblacion.map((p) => ({ nombre: p.nombre, total: p.total, color: POBLACION[p.clave]?.color || C.gris })));

    this.subtitulo("Impacto poblacional por periodo", 200);
    this.columnas(
      cifras.impacto.map((f) => f.periodo),
      ORDEN.map((p) => ({ nombre: POBLACION[p].nombre, color: POBLACION[p].color, valores: cifras.impacto.map((f) => f[p] || 0) })),
      { alto: 160 }
    );
    this.tabla(
      [
        { titulo: "Periodo", ancho: 1.1, valor: (f) => f.periodo },
        ...ORDEN.map((p) => ({ titulo: POBLACION[p].nombre, ancho: 1, alinear: "right", valor: (f) => num(f[p] || 0) })),
        { titulo: "Total", ancho: 1, alinear: "right", valor: (f) => num(f.total) },
      ],
      cifras.impacto,
      { tam: 7.5, estilos: (c, f) => (f.fuente === "conecta" ? C.amarillo : null) }
    );

    this.subtitulo("Atención servicio de enfermería", 150);
    this.columnas(
      cifras.enfermeria.map((f) => f.periodo),
      [{ nombre: "Población atendida", color: "#0D9488", valores: cifras.enfermeria.map((f) => f.total) }],
      { alto: 120, valores: true }
    );

    this.subtitulo("Población general frente a años anteriores", 150);
    this.columnas(
      cifras.poblacionGeneral.map((f) => f.periodo),
      [{ nombre: "Población general", color: C.azulSuave, valores: cifras.poblacionGeneral.map((f) => f.total) }],
      { alto: 120, valores: true }
    );

    this.subtitulo(`Asistencia población objeto ${cifras.periodo}`, Math.min(cifras.asistenciaObjeto.length * 14, 300));
    this.barrasHorizontales(cifras.asistenciaObjeto);

    this.subtitulo(`Atenciones por línea de acción ${cifras.periodo}`, cifras.porCategoria.length * 14);
    this.barrasHorizontales(cifras.porCategoria, C.dorado);
  }
}

module.exports = { PdfInformeSecciones };
