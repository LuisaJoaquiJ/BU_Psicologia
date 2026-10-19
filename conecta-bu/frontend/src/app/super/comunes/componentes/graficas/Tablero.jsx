// Graficas de los tableros, hechas con Recharts (libreria de graficas para
// React basada en SVG). Reglas:
// - Un color por modulo, siempre el mismo (validado para daltonismo, todas
//   las parejas). Los textos nunca van del color de la serie.
// - Barras de maximo 24 px, borde redondeado de 4 px en el extremo del dato,
//   2 px de separacion entre segmentos; lineas de 2 px.
// - Cada marca muestra su valor al pasar el mouse o con Tab, y cada tarjeta
//   tiene su tabla de datos ("Ver los datos").

//
// Este archivo solo reune las piezas, que viven en archivos por tipo.
export * from "./Series";
export * from "./Barras";
export * from "./Kpi";
export * from "./Circulares";
export * from "./Actividad";
