import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Icono } from "./Iconos";
import { MODULO_AVISO, haceCuanto, useNotificaciones } from "../lib/notificaciones/NotificacionesContext";
import { useAuth } from "../lib/auth/AuthContext";

const ANCHO = 392;
const ALTO_MAX = 480;
const MARGEN = 8;

// Campana del centro de notificaciones: contador de avisos sin leer y un panel con los ultimos.
// El panel va aparte del encabezado (portal) para que ninguna barra lo recorte, y se coloca
// hacia donde hay espacio: debajo de la campana o, si esta abajo en pantalla, encima.
export function CampanaNotificaciones({ className = "" }) {
  const { estaAutenticado } = useAuth();
  const { items, noLeidas, cargando, cargar, marcarLeida, marcarTodas } = useNotificaciones();
  const navigate = useNavigate();
  const [abierta, setAbierta] = useState(false);
  const [lugar, setLugar] = useState(null);
  const boton = useRef(null);
  const panel = useRef(null);

  function colocar() {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const ancho = Math.min(ANCHO, window.innerWidth - MARGEN * 2);
    const izquierda = Math.min(Math.max(r.right - ancho, MARGEN), window.innerWidth - ancho - MARGEN);
    const espacioAbajo = window.innerHeight - r.bottom - MARGEN * 2;
    const espacioArriba = r.top - MARGEN * 2;
    const arriba = espacioAbajo < 300 && espacioArriba > espacioAbajo;
    const alto = Math.min(ALTO_MAX, arriba ? espacioArriba : espacioAbajo);
    setLugar(arriba ? { left: izquierda, width: ancho, bottom: window.innerHeight - r.top + MARGEN, maxHeight: alto } : { left: izquierda, width: ancho, top: r.bottom + MARGEN, maxHeight: alto });
  }

  useLayoutEffect(() => {
    if (abierta) colocar();
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return undefined;
    const cerrar = () => setAbierta(false);
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        cerrar();
        boton.current?.focus();
      }
    };
    const alPulsar = (e) => !panel.current?.contains(e.target) && !boton.current?.contains(e.target) && cerrar();
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alPulsar);
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alPulsar);
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [abierta]);

  if (!estaAutenticado) return null;

  function alternar() {
    if (!abierta) cargar();
    setAbierta((a) => !a);
  }
  function abrirAviso(n) {
    marcarLeida(n.id);
    setAbierta(false);
    if (n.ruta) navigate(n.ruta);
  }

  const etiqueta = noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones";
  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={alternar}
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        className={`relative w-10 h-10 shrink-0 rounded-full inline-flex items-center justify-center text-ink-700 hover:bg-black/5 focus-visible:bg-black/5 transition-colors ${className}`}
      >
        <Icono nombre="campana" size={21} strokeWidth={2} />
        {noLeidas > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-extrabold leading-[18px] text-center tabular-nums ring-2 ring-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierta &&
        lugar &&
        createPortal(
          <section
            ref={panel}
            role="dialog"
            aria-label="Notificaciones"
            style={{ position: "fixed", ...lugar }}
            className="z-[70] flex flex-col rounded-[24px] bg-white/95 backdrop-blur-2xl border border-white shadow-[0_24px_60px_-18px_rgba(11,35,71,0.45)] overflow-hidden animate-aparecer motion-reduce:animate-aparecer-suave"
          >
            <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-gray-100">
              <h2 className="m-0 font-sans text-base font-extrabold text-primary-dark">Notificaciones</h2>
              <button type="button" onClick={marcarTodas} disabled={noLeidas === 0} className="min-h-[36px] px-3 -mr-2 rounded-full text-[13px] font-bold text-primary hover:bg-primary-light disabled:opacity-40 disabled:hover:bg-transparent">
                Marcar todas como leídas
              </button>
            </header>

            <div className="overflow-y-auto overscroll-contain">
              {items.length === 0 && (
                <p role="status" className="m-0 px-6 py-10 text-center text-sm text-ink-500">
                  {cargando ? "Cargando…" : "No tienes notificaciones todavía. Aquí aparecerán tus citas, inscripciones y respuestas."}
                </p>
              )}
              <ul className="list-none m-0 p-1.5">
                {items.map((n) => {
                  const modulo = MODULO_AVISO[n.modulo] || MODULO_AVISO.general;
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => abrirAviso(n)} className={`w-full text-left flex gap-3 rounded-2xl px-3 py-2.5 min-h-[64px] transition-colors hover:bg-primary-light/70 focus-visible:bg-primary-light/70 ${n.leida ? "" : "bg-primary-light/40"}`}>
                        <span aria-hidden="true" className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.leida ? "transparent" : modulo.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold rounded px-1.5 py-0.5 text-white select-none" style={{ background: modulo.color }}>
                              {modulo.nombre}
                            </span>
                            <span className="text-[12px] text-ink-500 shrink-0">{haceCuanto(n.fecha)}</span>
                          </span>
                          <span className={`block mt-1 text-[14px] leading-snug text-primary-dark ${n.leida ? "font-semibold" : "font-extrabold"}`}>{n.titulo}</span>
                          <span className="block text-[13px] leading-snug text-ink-600 line-clamp-3">{n.mensaje}</span>
                          {!n.leida && <span className="sr-only">Sin leer</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="border-t border-gray-100 p-1.5">
              <Link to="/notificaciones" onClick={() => setAbierta(false)} className="flex items-center justify-center gap-2 min-h-[44px] rounded-2xl text-sm font-extrabold text-primary no-underline hover:bg-primary-light/70">
                Ver todas las notificaciones <Icono nombre="flecha" size={16} strokeWidth={2.4} />
              </Link>
            </footer>
          </section>,
          document.body
        )}
    </>
  );
}
