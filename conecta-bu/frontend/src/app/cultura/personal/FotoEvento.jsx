import { useState } from "react";
import { http } from "../../../lib/api/http";
import { IMAGENES, urlDelServidor } from "../../../lib/imagenes";
import { mensajeError } from "../comun/formato";

// Foto de portada de un evento: la ven los estudiantes en la agenda y el portal.
export function FotoEvento({ evento, alCambiar }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const ruta = `/cultura/admin/agenda/${evento.id}/imagen`;

  async function subir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const datos = new FormData();
    datos.append("imagen", archivo);
    setOcupado(true);
    setError("");
    try {
      await http.post(ruta, datos);
      alCambiar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible subir la foto."));
    } finally {
      setOcupado(false);
    }
  }

  async function quitar() {
    setOcupado(true);
    try {
      await http.delete(ruta);
      alCambiar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="shrink-0 w-full sm:w-[180px] flex flex-col gap-2">
      <div className="relative h-[120px] rounded-[18px] overflow-hidden bg-primary-light">
        <img src={evento.imagenUrl ? urlDelServidor(evento.imagenUrl) : IMAGENES.auditorio.src} alt="" className={`absolute inset-0 w-full h-full object-cover ${evento.imagenUrl ? "" : "opacity-50 grayscale"}`} />
        {!evento.imagenUrl && <span className="absolute inset-x-2 bottom-2 rounded-full bg-white/90 px-2 py-1 text-center text-[11px] font-bold text-ink-600">Sin foto propia</span>}
      </div>
      <div className="flex gap-1.5">
        <label className={`flex-1 min-h-[38px] px-3 rounded-full burbuja text-primary-dark text-xs font-bold inline-flex items-center justify-center cursor-pointer ${ocupado ? "opacity-60" : ""}`}>
          {evento.imagenUrl ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={subir} disabled={ocupado} className="sr-only" />
        </label>
        {evento.imagenUrl && (
          <button type="button" onClick={quitar} disabled={ocupado} className="min-h-[38px] px-3 rounded-full text-xs font-bold text-ink-500 hover:bg-white">
            Quitar
          </button>
        )}
      </div>
      {error && <p className="m-0 text-xs text-red-700">{error}</p>}
    </div>
  );
}
