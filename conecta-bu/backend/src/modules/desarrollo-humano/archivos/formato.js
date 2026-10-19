// Formato comun de los informes de Desarrollo Humano (Excel y PDF).

const XLS = { AZUL: "FF0B2A5B", DORADO: "FFE8B23A", MARFIL: "FFFBF7EE", GRIS: "FF5B6478", PCT: "0.0%" };

function textoPeriodo(filtro) {
  if (!filtro.desde && !filtro.hasta) return "Todo el historial";
  return `${filtro.desde || "inicio"} a ${filtro.hasta || "hoy"}`;
}

module.exports = { XLS, textoPeriodo };
