import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

// El botón se puede arrastrar a cualquier parte de la pantalla; la posición se recuerda.
const CLAVE_POSICION = "conectabu:asistente-posicion";
const MARGEN = 8;
const UMBRAL_ARRASTRE = 5;

function posicionGuardada() {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_POSICION));
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  } catch {
    /* sin posición guardada */
  }
  return { x: 0, y: 0 };
}

// Mismo esquema que el asistente de NOVA: botón circular, saludo y panel
// crema. El contenido sigue siendo el de Bienestar.
export function AsistenteFlotante() {
  const { estaAutenticado, usuario } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [saludo, setSaludo] = useState(true);
  const modulo = moduloDe(pathname);
  const [desp, setDesp] = useState(posicionGuardada);
  const [ajuste, setAjuste] = useState({ x: 0, y: 0 });
  const caja = useRef(null);
  const boton = useRef(null);
  const despActual = useRef(desp);
  const arrastre = useRef(null);
  const movido = useRef(false);
  despActual.current = desp;

  // Mantiene el botón dentro de la pantalla.
  const limitar = useCallback((p) => {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return p;
    const izq = r.left - despActual.current.x;
    const arr = r.top - despActual.current.y;
    const x = Math.min(Math.max(p.x, MARGEN - izq), window.innerWidth - MARGEN - (izq + r.width));
    const y = Math.min(Math.max(p.y, MARGEN - arr), window.innerHeight - MARGEN - (arr + r.height));
    return { x, y };
  }, []);

  useEffect(() => {
    const alCambiar = () => setDesp((d) => limitar(d));
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, [limitar]);

  // Con el panel abierto, se corre lo necesario para que el panel quepa completo.
  useLayoutEffect(() => {
    if (!abierto) {
      setAjuste({ x: 0, y: 0 });
      return;
    }
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    const x = r.left < MARGEN ? MARGEN - r.left : r.right > window.innerWidth - MARGEN ? window.innerWidth - MARGEN - r.right : 0;
    const y = r.top < MARGEN ? MARGEN - r.top : r.bottom > window.innerHeight - MARGEN ? window.innerHeight - MARGEN - r.bottom : 0;
    setAjuste({ x, y });
  }, [abierto]);

  function alPresionar(e) {
    if (e.button !== 0) return;
    arrastre.current = { sx: e.clientX, sy: e.clientY, ox: despActual.current.x, oy: despActual.current.y };
    movido.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function alMover(e) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.sx;
    const dy = e.clientY - a.sy;
    if (!movido.current && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
    movido.current = true;
    setDesp(limitar({ x: a.ox + dx, y: a.oy + dy }));
  }
  function alSoltar() {
    if (arrastre.current && movido.current) {
      try {
        localStorage.setItem(CLAVE_POSICION, JSON.stringify(despActual.current));
      } catch {
        /* no se pudo guardar: se queda solo en esta visita */
      }
    }
    arrastre.current = null;
  }
  function alPulsar() {
    // Si se acaba de arrastrar, no se abre ni se cierra.
    if (movido.current) {
      movido.current = false;
      return;
    }
    setAbierto((v) => !v);
  }

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
    <div
      ref={caja}
      className="fixed z-50 left-3 right-3 bottom-4 sm:left-6 sm:right-auto sm:bottom-6 flex flex-col items-start gap-3 sm:w-[400px] pointer-events-none"
      style={{ transform: `translate(${desp.x + ajuste.x}px, ${desp.y + ajuste.y}px)` }}
    >
      {abierto && (
        <section
          role="dialog"
          aria-label="Asistente virtual Conecta BU"
          className="pointer-events-auto w-full h-[min(640px,calc(100dvh-8rem))] rounded-[28px] overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(11,26,44,0.28)]"
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
          ref={boton}
          type="button"
          onClick={alPulsar}
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          title="Arrastra para mover"
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
          className="pointer-events-auto relative h-14 w-14 rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(232,116,14,0.45)] cursor-grab active:cursor-grabbing select-none"
          style={{ ...aro, touchAction: "none" }}
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
          <div className="pointer-events-auto mb-1 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_10px_30px_rgba(11,26,44,0.12)] border border-[#1E3A5F]/10">
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
