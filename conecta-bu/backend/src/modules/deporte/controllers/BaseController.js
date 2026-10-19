// Base de los controladores de Deporte: respuestas JSON y descarga de archivos.
const TIPOS = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

class BaseController {
  ok(res, datos, estado = 200) {
    return res.status(estado).json(datos);
  }

  creado(res, datos) {
    return this.ok(res, datos, 201);
  }

  archivo(res, buffer, nombre, tipo) {
    res.set({ "Content-Type": TIPOS[tipo] || tipo, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
    return res.status(200).send(buffer);
  }
}

module.exports = { BaseController };
