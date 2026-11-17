import { useState } from "react";
import { Icono } from "../comunes/componentes/Iconos";
import { botonPrimario, botonSecundario } from "../comunes/componentes/ui";
import { urlDelServidor } from "../comunes/lib/imagenes";

// Mismas clases que la agenda de citas (PR de vistas): primario líquido,
// secundario de vidrio, asistencia en verde y «no» en rojo. No vive en
// comunes para no cambiar Salud ni la agenda.

export const btnPrimario = botonPrimario;
export const btnSecundario = botonSecundario;

export const btnPositivo =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-[#0E6B4A] bg-white px-3 text-sm font-bold text-[#0E6B4A] hover:bg-[#DDF3EA] disabled:opacity-60";

export const btnPeligro =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-red-600 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60";

export const btnTexto =
  "inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-sm font-bold text-primary hover:underline disabled:opacity-60";

export const btnContorno =
  "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 text-sm font-bold text-ink-900 hover:bg-gray-50 disabled:opacity-60";

export function srcDeEvento(evento) {
  if (!evento) return "";
  if (evento.imagenUrl) return urlDelServidor(evento.imagenUrl);
  if (evento.imagen && evento.id) return urlDelServidor(`/api/v1/eventos/${evento.id}/imagen?v=${String(evento.imagen).slice(0, 8)}`);
  return "";
}

// Foto del evento o, si no tiene, un recuadro con la paleta del módulo.
// El fallo queda atado a esa URL: al elegir otra foto se vuelve a intentar.
export function FotoEvento({ src, className = "", alt = "" }) {
  const [rota, setRota] = useState("");
  if (!src || rota === src) {
    return (
      <span className={`grid place-items-center bg-primary-dark text-gold ${className}`} aria-hidden="true">
        <Icono nombre="imagen" size={22} strokeWidth={1.8} />
      </span>
    );
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setRota(src)} />;
}
