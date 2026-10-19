import { useState } from "react";
import { Icono } from "./Iconos";
import { http } from "../../../../lib/api/http";
import { urlDelServidor } from "../lib/imagenes";

// Foto opcional de un formulario (como en los eventos de Desarrollo Humano):
// se elige o se arrastra, se ve antes de guardar y se puede cambiar o quitar.
//   const [foto, setFoto] = useState(fotoInicial(registro.imagenUrl));
//   <SelectorFoto foto={foto} onCambio={setFoto} />
//   ...despues de guardar el registro: await guardarFoto(`/ruta/${id}/imagen`, foto, registro.imagenUrl)

const FORMATOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

export function fotoInicial(imagenUrl) {
  return { archivo: null, vista: imagenUrl ? urlDelServidor(imagenUrl) : null, quitar: false };
}

// Sube la foto nueva o quita la anterior. Devuelve un texto de aviso si
// fallo (el registro ya quedo guardado) o "" si salio bien o no habia cambios.
export async function guardarFoto(ruta, foto, teniaFoto) {
  try {
    if (foto.archivo) {
      const forma = new FormData();
      forma.append("imagen", foto.archivo);
      await http.post(ruta, forma);
    } else if (foto.quitar && teniaFoto) {
      await http.delete(ruta);
    }
    return "";
  } catch (err) {
    return `No pudimos guardar la foto: ${err.response?.data?.message || "intenta subirla de nuevo."}`;
  }
}

export function SelectorFoto({ foto, onCambio, etiqueta = "Foto", ayuda = "JPG, PNG o WEBP, hasta 5 MB. Es opcional.", alto = "h-[160px]" }) {
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);

  function elegir(archivo) {
    setError("");
    if (!archivo) return;
    if (!FORMATOS.includes(archivo.type)) return setError("La foto debe ser JPG, PNG o WEBP.");
    if (archivo.size > MAX_MB * 1024 * 1024) return setError(`La foto no puede pesar más de ${MAX_MB} MB.`);
    onCambio({ archivo, vista: URL.createObjectURL(archivo), quitar: false });
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="font-bold text-sm text-ink-900">{etiqueta}</span>
      {foto.vista ? (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <img src={foto.vista} alt="Vista previa de la foto" className={`w-full sm:w-[240px] ${alto} object-cover rounded-2xl border border-gray-200 bg-gray-50`} />
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-gray-200 bg-white font-bold text-sm text-primary hover:bg-gray-50 focus-within:ring-2 focus-within:ring-primary">
              <Icono nombre="imagen" size={16} />
              Cambiar foto
              <input type="file" accept={FORMATOS.join(",")} className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
            </label>
            <button
              type="button"
              onClick={() => onCambio({ archivo: null, vista: null, quitar: true })}
              className="min-h-[44px] px-4 rounded-full font-bold text-sm text-red-700 hover:bg-red-50"
            >
              Quitar foto
            </button>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            elegir(e.dataTransfer.files?.[0]);
          }}
          className={`cursor-pointer flex items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 transition-colors focus-within:ring-2 focus-within:ring-primary ${
            arrastrando ? "border-primary bg-primary-light" : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
          }`}
        >
          <span className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
            <Icono nombre="imagen" size={24} strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-primary">Elige una foto o arrástrala aquí</span>
            <span className="block text-sm text-ink-500">{ayuda}</span>
          </span>
          <input type="file" accept={FORMATOS.join(",")} className="sr-only" onChange={(e) => elegir(e.target.files?.[0])} />
        </label>
      )}
      {error && <p className="m-0 text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}

// Foto que se muestra en tarjetas y detalles, con respaldo si no carga.
export function FotoDeporte({ url, respaldo, alt = "", className = "" }) {
  const src = url ? urlDelServidor(url) : respaldo;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        if (respaldo && !e.currentTarget.dataset.respaldo) {
          e.currentTarget.dataset.respaldo = "1";
          e.currentTarget.src = respaldo;
        }
      }}
      className={`object-cover bg-gray-100 ${className}`}
    />
  );
}
