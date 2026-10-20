import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icono } from "./Iconos";
import { AsistenteConversacion } from "./AsistenteConversacion";
import { useAuth } from "../lib/auth/AuthContext";

// Botón flotante del asistente. Solo para estudiantes con sesión (la
// consulta y el agendamiento son del estudiante) y no en la página completa
// del asistente (/estudiante/asistente), donde ya está el mismo chat.
export function AsistenteFlotante() {
  const { estaAutenticado, usuario } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  if (!estaAutenticado || usuario?.rol !== "Estudiante" || pathname === "/login" || pathname.startsWith("/estudiante/asistente")) return null;

  return (
    <div className="fixed z-30 bottom-24 right-4 sm:bottom-28 sm:right-8 flex flex-col items-end gap-3">
      {abierto && (
        <section
          role="dialog"
          aria-label="Asistente de orientación"
          className="w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-9rem))] vidrio-panel rounded-3xl shadow-[0_16px_40px_rgba(11,35,71,0.22)] flex flex-col overflow-hidden"
        >
          <header className="flex items-start justify-between gap-3 px-4 py-3 boton-liquido rounded-none">
            <div>
              <p className="m-0 text-base font-extrabold">Asistente</p>
              <p className="m-0 mt-0.5 text-xs text-white/80">Orientación sobre Bienestar. No hace diagnósticos.</p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asistente"
              className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25"
            >
              <Icono nombre="cerrar" size={18} strokeWidth={2.2} />
            </button>
          </header>
          <div className="flex-1 min-h-0 p-3 flex flex-col">
            <AsistenteConversacion compacto alNavegar={() => setAbierto(false)} />
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        className="inline-flex items-center gap-2.5 min-h-[56px] pl-3 pr-5 rounded-full boton-liquido font-extrabold text-[15px] transition-transform duration-200 ease-salida hover:-translate-y-px active:scale-[0.98] motion-reduce:transform-none"
      >
        <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
          <Icono nombre={abierto ? "cerrar" : "chat"} size={18} strokeWidth={2.2} />
        </span>
        Asistente
      </button>
    </div>
  );
}
