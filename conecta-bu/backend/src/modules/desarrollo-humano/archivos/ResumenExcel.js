const { LibroExcel } = require("./LibroExcel");
const { XLS, textoPeriodo } = require("./formato");

// Hoja "Resumen" del informe de Desarrollo Humano: indicadores de citas,
// eventos, participacion y probabilidades, y la lectura rapida.
class ResumenExcel extends LibroExcel {
  hojaResumen(informe) {
    const hoja = this.libro.addWorksheet("Resumen", { properties: { tabColor: { argb: XLS.DORADO } } });
    hoja.columns = [{ width: 46 }, { width: 18 }, { width: 50 }];

    hoja.mergeCells("A1:C1");
    hoja.getCell("A1").value = "Conecta BU · Informe de Bienestar Universitario";
    hoja.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    hoja.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: XLS.AZUL } };
    hoja.getRow(1).height = 32;
    hoja.getCell("A1").alignment = { vertical: "middle", indent: 1 };

    hoja.getCell("A2").value = `Corporación Universitaria Autónoma del Cauca · Periodo: ${textoPeriodo(informe.filtro)}`;
    hoja.getCell("A3").value = `Generado el ${informe.generado.toLocaleString("es-CO", { timeZone: "America/Bogota" })}`;
    ["A2", "A3"].forEach((c) => (hoja.getCell(c).font = { color: { argb: XLS.GRIS } }));

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
      celda.font = { bold: true, size: 12, color: { argb: XLS.AZUL } };
      hoja.getCell(`A${fila}`).border = { bottom: { style: "medium", color: { argb: XLS.DORADO } } };
      fila += 1;
      for (const [etiqueta, valor, esPct, nota] of items) {
        hoja.getCell(`A${fila}`).value = etiqueta;
        const v = hoja.getCell(`B${fila}`);
        v.value = valor === null || valor === undefined ? "Sin datos" : valor;
        v.font = { bold: true };
        v.alignment = { horizontal: "right" };
        if (esPct) v.numFmt = XLS.PCT;
        if (nota) {
          hoja.getCell(`C${fila}`).value = nota;
          hoja.getCell(`C${fila}`).font = { size: 9, color: { argb: XLS.GRIS } };
        }
        fila += 1;
      }
      fila += 1;
    }

    hoja.getCell(`A${fila}`).value = "Lectura rápida";
    hoja.getCell(`A${fila}`).font = { bold: true, size: 12, color: { argb: XLS.AZUL } };
    hoja.getCell(`A${fila}`).border = { bottom: { style: "medium", color: { argb: XLS.DORADO } } };
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
    hoja.getCell(`A${fila}`).font = { size: 9, italic: true, color: { argb: XLS.GRIS } };
    hoja.getCell(`A${fila}`).alignment = { wrapText: true };
    hoja.getRow(fila).height = 42;
  }}

module.exports = { ResumenExcel };
