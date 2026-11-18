import { useState } from "react";
import { http } from "../../../../lib/api/http";
import { botonSecundario } from "./ui";

// Botones para descargar un archivo del backend en Excel o PDF.
export function BotonesDescarga({ url, params = {}, nombre, onError }) {
  const [cargando, setCargando] = useState(null);

  async function bajar(formato) {
    setCargando(formato);
    try {
      const res = await http.get(url, { params: { ...params, formato }, responseType: "blob" });
      const href = URL.createObjectURL(res.data);
      const enlace = document.createElement("a");
      enlace.href = href;
      enlace.download = `${nombre}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      onError?.("No fue posible descargar la lista de asistentes. Intenta de nuevo.");
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[
        ["xlsx", "Excel"],
        ["pdf", "PDF"],
      ].map(([formato, texto]) => (
        <button key={formato} type="button" disabled={Boolean(cargando)} onClick={() => bajar(formato)} className={botonSecundario}>
          {cargando === formato ? "Generando…" : `Asistentes ${texto}`}
        </button>
      ))}
    </div>
  );
}