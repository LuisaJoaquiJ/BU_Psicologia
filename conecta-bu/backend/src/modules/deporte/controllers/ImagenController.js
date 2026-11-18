const { BaseController } = require("./BaseController");
const imagenes = require("../services/ImagenService");
const { almacenamiento } = require("../../../common/storage/almacenamiento");

// Fotos de eventos, disciplinas, implementos y comunicados.
class ImagenController extends BaseController {
  // Manejadores para un tipo de foto ("eventos", "disciplinas"...).
  subir = (tipo) => async (req, res) => this.ok(res, await imagenes.guardarImagen(tipo, req.params.id, req.file));

  quitar = (tipo) => async (req, res) => this.ok(res, await imagenes.quitarImagen(tipo, req.params.id));

  // Publica: la usa <img>, que no envia la sesion. Ids y nombres no se pueden adivinar.
  servir = async (req, res) => {
    const { tipo, id } = req.params;
    if (!imagenes.ENTIDADES[tipo]) return res.status(404).json({ message: "Imagen no encontrada." });
    const archivo = await imagenes.archivoDe(tipo, id);
    if (!archivo) return res.status(404).json({ message: "No tiene imagen." });
    return almacenamiento.enviar(res, {
      ...archivo,
      cache: "public, max-age=86400",
      headers: { "Cross-Origin-Resource-Policy": "cross-origin" },
      mensaje404: "No se encontró la imagen.",
    });
  };
}

module.exports = new ImagenController();
