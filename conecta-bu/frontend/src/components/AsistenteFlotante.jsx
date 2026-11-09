import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AsistenteConversacion } from "./AsistenteConversacion";
import { useAuth } from "../lib/auth/AuthContext";

function Chispa({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </svg>
  );
}

const MODULOS = [
  { prefijos: ["/mi-cultura", "/cultura"], id: "cultura" },
  { prefijos: ["/mi-salud", "/salud", "/reportes-sst"], id: "salud" },
  { prefijos: ["/mi-deporte", "/deporte"], id: "deporte" },
];
// Modulo de la pagina actual: da el contexto de las preguntas del asistente.
const moduloDe = (pathname) => MODULOS.find((m) => m.prefijos.some((p) => pathname === p || pathname.startsWith(`${p}/`))) || { id: "orientacion" };

const aro = { background: "conic-gradient(from 200deg, #E8740E, #C89B14, #E8740E)" };

// Mismo esquema que el asistente de NOVA: botón circular, saludo y panel
// crema. El contenido sigue siendo el de Bienestar.
export function AsistenteFlotante() {
  const { estaAutenticado, usuario } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [saludo, setSaludo] = useState(true);
  const modulo = moduloDe(pathname);

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
    <div className="fixed z-50 left-3 right-3 bottom-4 sm:left-6 sm:right-auto sm:bottom-6 flex flex-col items-start gap-3 sm:w-[400px]">
      {abierto && (
        <section
          role="dialog"
          aria-label="Asistente virtual Conecta BU"
          className="w-full h-[min(640px,calc(100dvh-8rem))] rounded-[28px] overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(11,26,44,0.28)]"
          style={{ background: "#FAF6EE" }}
        >
          <header className="relative shrink-0 px-4 py-3.5 flex items-center gap-3 overflow-hidden" style={{ background: "linear-gradient(135deg, #1E3A5F 0%, #132A46 100%)" }}>
            <span aria-hidden="true" className="absolute -top-16 -right-10 w-44 h-44 rounded-full blur-2xl" style={{ background: "rgba(232, 116, 14, 0.25)" }} />
            <span className="relative">
              <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white shadow-md" style={aro}>
                <Chispa size={18} />
              </span>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1E3A5F]" />
            </span>
            <div className="relative flex-1 min-w-0">
              <p className="m-0 text-white font-bold text-[15px] leading-tight">Asistente Conecta BU</p>
              <p className="m-0 text-white/60 text-xs leading-tight mt-0.5">En línea · responde al instante</p>
            </div>
            <Link to="/estudiante/asistente" aria-label="Ampliar" title="Ampliar" onClick={() => setAbierto(false)} className="relative hidden sm:flex h-8 w-8 rounded-xl items-center justify-center text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" x2="14" y1="3" y2="10" /><line x1="3" x2="10" y1="21" y2="14" /></svg>
            </Link>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" title="Cerrar" className="relative h-8 w-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>
          <div className="flex-1 min-h-0 px-4 py-4 flex flex-col">
            <AsistenteConversacion compacto modulo={modulo.id} alNavegar={() => setAbierto(false)} />
          </div>
        </section>
      )}

      <div className="flex items-end gap-3">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
          className="relative h-14 w-14 rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(232,116,14,0.45)]"
          style={aro}
        >
          {!abierto && (
            <span aria-hidden="true" className="nova-pulso pointer-events-none absolute inset-0 rounded-full" />
          )}
          <span className="absolute inset-[3px] rounded-full border border-white/40" />
          {abierto ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          ) : (
            <Chispa size={24} />
          )}
        </button>
        {!abierto && saludo && (
          <div className="mb-1 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_10px_30px_rgba(11,26,44,0.12)] border border-[#1E3A5F]/10">
            <button type="button" onClick={() => setAbierto(true)} className="text-left text-[13px] font-semibold text-[#1E3A5F]">
              ¡Hola! ¿Te ayudo con Bienestar?
            </button>
            <button type="button" aria-label="Ocultar saludo" onClick={() => setSaludo(false)} className="h-7 w-7 rounded-lg text-[#6B7A8D] hover:bg-[#F3EDE1]">
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
