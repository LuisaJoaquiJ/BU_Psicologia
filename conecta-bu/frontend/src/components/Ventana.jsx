import { useEffect, useRef } from "react";
import { Icono } from "./Iconos";

// Ventana sobre la pagina (dialogo): se cierra con la X, con Esc o tocando fuera.
export function Ventana({ titulo, alCerrar, children }) {
  const ref = useRef(null);
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.focus();
    const alTeclear = (e) => e.key === "Escape" && cerrar.current();
    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0B2347]/55" onClick={alCerrar} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-ventana"
        tabIndex={-1}
        className="relative w-full sm:max-w-[1180px] max-h-[92vh] overflow-y-auto bg-cream rounded-t-[28px] sm:rounded-[28px] shadow-2xl outline-none"
      >
        <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur px-5 sm:px-8 pt-5 pb-3 flex items-center justify-between gap-4 border-b border-gray-200">
          <h2 id="titulo-ventana" className="m-0 text-2xl font-extrabold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="w-11 h-11 rounded-full bg-white border border-gray-200 text-ink-700 flex items-center justify-center hover:bg-gray-50"
          >
            <Icono nombre="cerrar" size={20} strokeWidth={2.2} />
          </button>
        </div>
        <div className="px-5 sm:px-8 py-6">{children}</div>
      </div>
    </div>
  );
}

// Boton flotante (abajo a la derecha) para la accion principal de la pagina.
export function BotonFlotante({ onClick, children, icono = "mas" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed z-30 bottom-5 right-4 sm:bottom-8 sm:right-8 inline-flex items-center gap-2.5 min-h-[56px] pl-3 pr-6 rounded-full bg-cyan text-primary-dark font-extrabold text-[15px] shadow-[0_12px_30px_rgba(11,35,71,0.30)] hover:brightness-95 active:scale-[0.98] transition"
    >
      <span className="w-9 h-9 rounded-full bg-primary-dark text-white flex items-center justify-center">
        <Icono nombre={icono} size={18} strokeWidth={2.6} />
      </span>
      {children}
    </button>
  );
}
