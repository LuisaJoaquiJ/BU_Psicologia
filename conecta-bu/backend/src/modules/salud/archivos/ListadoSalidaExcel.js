const ExcelJS = require("exceljs");
const { iso } = require("../utils/salidas");

// Listado de inscritos a una salida, en Excel, para la ARL o el seguro.
async function generarListado(salida, lista, todos) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Listado");
  hoja.addRow(["Universidad Autónoma del Cauca · Bienestar Institucional · Salud Integral"]).font = { bold: true, size: 13 };
  hoja.addRow([`Salida: ${salida.nombre}`]).font = { bold: true };
  hoja.addRow([`Destino: ${salida.destino}`]);
  hoja.addRow([`Fechas: ${iso(salida.fechaSalida)}${salida.horaSalida ? ` ${salida.horaSalida}` : ""} a ${iso(salida.fechaRegreso)}${salida.horaRegreso ? ` ${salida.horaRegreso}` : ""}`]);
  if (salida.responsable) hoja.addRow([`Responsable: ${salida.responsable}`]);
  hoja.addRow([todos ? "Inscritos (todos los estados, sin cancelados)" : "Estudiantes aprobados"]);
  hoja.addRow([]);
  const columnas = ["N°", "Nombre completo", "Tipo doc.", "Documento", "Programa", "Celular", "Correo", "EPS", "Contacto de emergencia", "Teléfono emergencia", "Estado"];
  const encabezado = hoja.addRow(columnas);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF19407B" } };
  });
  lista.forEach((i, n) =>
    hoja.addRow([n + 1, i.nombre, i.tipoDocumento, i.documento, i.programa, i.celular, i.correo, i.eps, i.contactoEmergencia || "", i.telefonoEmergencia || "", i.estado])
  );
  [5, 34, 9, 16, 34, 14, 34, 22, 28, 18, 12].forEach((w, k) => {
    hoja.getColumn(k + 1).width = w;
  });
  const nombre = `salida-${salida.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}.xlsx`;
  return { buffer: await libro.xlsx.writeBuffer(), nombre };
}

module.exports = { generarListado };
