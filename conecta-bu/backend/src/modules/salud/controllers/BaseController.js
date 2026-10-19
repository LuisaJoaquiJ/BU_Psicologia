// Base de los controladores de Salud integral: respuestas JSON, descarga de
// archivos generados y envio de archivos guardados en el servidor.
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

  // Archivo generado en memoria (Excel, PDF): se descarga.
  archivo(res, buffer, nombre, tipo) {
    res.set({ "Content-Type": TIPOS[tipo] || tipo, "Content-Disposition": `attachment; filename="${nombre}"`, "Cache-Control": "no-store" });
    return res.status(200).send(Buffer.from(buffer));
  }

  // Archivo guardado (evidencia, comprobante, documento): se ve en el navegador.
  enviarArchivo(res, ruta, nombre, { tipo, cache = "no-store" } = {}) {
    if (tipo) res.set("Content-Type", tipo);
    res.set("Content-Disposition", `inline; filename="${encodeURIComponent(nombre)}"`);
    res.set("Cache-Control", cache);
    res.sendFile(ruta, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: "Archivo no disponible.", error: "Not Found" });
    });
  }
}

module.exports = { BaseController };
