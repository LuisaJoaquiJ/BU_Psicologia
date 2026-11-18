// Base de los controladores de Salud integral: respuestas JSON, descarga de
// archivos generados y envio de archivos guardados (disco o Supabase).
const { almacenamiento } = require("../../../common/storage/almacenamiento");

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
  // origen es { clave, bucket, nombre, tipo } o, por compatibilidad, una ruta en disco.
  enviarArchivo(res, origen, nombre, { tipo, cache = "no-store" } = {}) {
    if (origen && typeof origen === "object") {
      return almacenamiento.enviar(res, {
        clave: origen.clave,
        bucket: origen.bucket,
        nombre: nombre || origen.nombre,
        tipo: tipo || origen.tipo,
        cache,
        mensaje404: "Archivo no disponible.",
      });
    }
    const clave = almacenamiento.claveDesdeRuta(origen);
    if (clave) {
      return almacenamiento.enviar(res, { clave, bucket: "privado", nombre, tipo, cache, mensaje404: "Archivo no disponible." });
    }
    if (tipo) res.set("Content-Type", tipo);
    res.set("Content-Disposition", `inline; filename="${encodeURIComponent(nombre)}"`);
    res.set("Cache-Control", cache);
    res.sendFile(origen, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: "Archivo no disponible.", error: "Not Found" });
    });
  }
}

module.exports = { BaseController };
