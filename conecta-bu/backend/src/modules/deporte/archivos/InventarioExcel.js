const { LibroExcel } = require("./LibroExcel");

// Inventario de implementos: existencias, prestamos activos y movimientos.
class InventarioExcel extends LibroExcel {
  async generar({ implementos, prestamos, movimientos }) {
    const inv = this.hoja(
      "INVENTARIO",
      [
        { titulo: "Código", clave: "codigo", ancho: 12, valor: (f) => f.codigo },
        { titulo: "Implemento", clave: "nombre", ancho: 30, valor: (f) => f.nombre },
        { titulo: "Disciplina", clave: "disciplina", ancho: 18, valor: (f) => f.disciplina },
        { titulo: "Ubicación", clave: "ubicacion", ancho: 22, valor: (f) => f.ubicacion },
        { titulo: "Total", clave: "total", ancho: 9, valor: (f) => f.cantidadTotal },
        { titulo: "Disponibles", clave: "disponibles", ancho: 12, valor: (f) => f.disponibles },
        { titulo: "En préstamo", clave: "prestamo", ancho: 12, valor: (f) => f.enPrestamo },
        { titulo: "Dañados", clave: "danados", ancho: 10, valor: (f) => f.cantidadDanada },
        { titulo: "Stock mínimo", clave: "minimo", ancho: 12, valor: (f) => f.stockMinimo },
        { titulo: "Estado", clave: "estado", ancho: 14, valor: (f) => (!f.activo ? "Inactivo" : f.bajoStock ? "Bajo stock" : "OK") },
      ],
      implementos
    );
    this.resaltar(inv, "estado", "Bajo stock", "FFFDE2B8");
    this.hoja(
      "PRESTAMOS ACTIVOS",
      [
        { titulo: "Implemento", clave: "implemento", ancho: 28, valor: (f) => f.implemento },
        { titulo: "Cantidad", clave: "cantidad", ancho: 10, valor: (f) => f.cantidad },
        { titulo: "Responsable", clave: "responsable", ancho: 28, valor: (f) => f.responsable },
        { titulo: "Tipo", clave: "tipo", ancho: 12, valor: (f) => f.tipoResponsable },
        { titulo: "Correo", clave: "email", ancho: 30, valor: (f) => f.responsableEmail },
        { titulo: "Prestado", clave: "prestado", ancho: 12, valor: (f) => new Date(f.fechaPrestamo).toISOString().slice(0, 10) },
        { titulo: "Devolver el", clave: "devolver", ancho: 12, valor: (f) => f.fechaDevolucionEsperada },
        { titulo: "Vencido", clave: "vencido", ancho: 9, valor: (f) => (f.vencido ? "Sí" : "No") },
      ],
      prestamos
    );
    this.hoja(
      "MOVIMIENTOS",
      [
        { titulo: "Fecha", clave: "fecha", ancho: 18, valor: (f) => new Date(f.fecha).toISOString().slice(0, 16).replace("T", " ") },
        { titulo: "Implemento", clave: "implemento", ancho: 28, valor: (f) => f.implemento },
        { titulo: "Movimiento", clave: "tipo", ancho: 12, valor: (f) => f.tipo },
        { titulo: "Cantidad", clave: "cantidad", ancho: 10, valor: (f) => f.cantidad },
        { titulo: "Motivo / detalle", clave: "motivo", ancho: 44, valor: (f) => f.motivo },
        { titulo: "Registró", clave: "registro", ancho: 30, valor: (f) => f.registradoPor },
      ],
      movimientos
    );
    return this.buffer();
  }
}

module.exports = { InventarioExcel };
