// Acciones y tipos de movimiento del inventario.

export const ACCIONES = [
  ["prestar", "Prestar", "derecha"],
  ["Ingreso", "Ingreso", "mas"],
  ["Danado", "Marcar dañados", "alerta"],
  ["Reparacion", "Reparados", "check"],
  ["Baja", "Dar de baja", "cerrar"],
];

export const AYUDA_ACCION = {
  Ingreso: "Compra, donación o unidades encontradas: suman al inventario.",
  Danado: "Pasan de disponibles a dañados (no se pueden prestar).",
  Reparacion: "Vuelven de dañados a disponibles.",
  Baja: "Salen del inventario (primero los dañados). Los prestados deben devolverse antes.",
};

export const TEXTO_MOV = { Ingreso: "Ingreso", Baja: "Baja", Danado: "Dañados", Reparacion: "Reparación", Prestamo: "Préstamo", Devolucion: "Devolución" };

export const TONO_MOV = { Ingreso: "verde", Baja: "rojo", Danado: "dorado", Reparacion: "verde", Prestamo: "azul", Devolucion: "azul" };
