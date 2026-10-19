const { ConstanciaPdf } = require("./ConstanciaPdf");
const { ReporteHorasExcel } = require("./ReporteHorasExcel");
const { InventarioExcel } = require("./InventarioExcel");

// Cada archivo usa una instancia nueva (el PDF y el libro guardan estado).
module.exports = {
  constanciaPdf: (detalle) => new ConstanciaPdf().generar(detalle),
  reporteExcel: (datos) => new ReporteHorasExcel().generar(datos),
  inventarioExcel: (datos) => new InventarioExcel().generar(datos),
};
