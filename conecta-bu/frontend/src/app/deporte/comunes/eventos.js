import { IMAGENES, urlDelServidor } from "./lib/imagenes";

// Ayudas de los eventos deportivos.

export const TONO_ESTADO_EVENTO = { Publicado: "verde", Borrador: "gris", Cancelado: "rojo", Finalizado: "azul" };

// Foto de un evento: la suya, la de su disciplina o una de la universidad.
export function respaldoEvento(e) {
  return e?.disciplinaImagenUrl ? urlDelServidor(e.disciplinaImagenUrl) : IMAGENES.deportes.src;
}
