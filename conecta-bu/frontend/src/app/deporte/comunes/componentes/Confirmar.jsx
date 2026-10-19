import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icono } from "./Iconos";

// Confirmaciones y avisos de toda la app:
//   const { confirmar, avisar } = useConfirmar();
//   if (!(await confirmar({ titulo, mensaje, detalle, boton, peligro }))) return;
//   ...hacer la accion...
//   avisar("Préstamo registrado.");
// confirmar() abre una ventana que pregunta antes de actuar (Esc o "No"
// cancelan). avisar() muestra abajo un mensaje que se cierra solo.

const Contexto = createContext(null);

export function ConfirmarProvider({ children }) {
  const [pregunta, setPregunta] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const resolver = useRef(null);

  const confirmar = useCallback(
    (opciones) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setPregunta(typeof opciones === "string" ? { titulo: opciones } : opciones);
      }),
    []
  );
  const responder = useCallback((si) => {
    resolver.current?.(si);
    resolver.current = null;
    setPregunta(null);
  }, []);

  const avisar = useCallback((texto, tono = "exito") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto, tono }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Contexto.Provider value={{ confirmar, avisar }}>
      {children}
      {pregunta && <VentanaConfirmar pregunta={pregunta} responder={responder} />}
      <div aria-live="polite" className="fixed z-[70] bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-32px)] sm:w-[380px] pointer-events-none">
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-xl border text-sm font-semibold animate-[entrarAviso_0.25s_ease-out] ${
              a.tono === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-[#0B2347] border-[#0B2347] text-white"
            }`}
          >
            <span className={`shrink-0 w-6 h-6 rounded-full grid place-items-center ${a.tono === "error" ? "bg-red-100" : "bg-[#1baf7a]"}`}>
              <Icono nombre={a.tono === "error" ? "alerta" : "check"} size={14} strokeWidth={3} />
            </span>
            <span className="flex-1 pt-0.5">{a.texto}</span>
            <button type="button" onClick={() => setAvisos((x) => x.filter((y) => y.id !== a.id))} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
              <Icono nombre="cerrar" size={14} />
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes entrarAviso{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </Contexto.Provider>
  );
}

function VentanaConfirmar({ pregunta, responder }) {
  const si = useRef(null);
  const no = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    (pregunta.peligro ? no : si).current?.focus();
    const tecla = (e) => e.key === "Escape" && responder(false);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      previo?.focus?.();
    };
  }, [pregunta, responder]);
  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--menu,0px)] z-[70] flex items-end sm:items-center justify-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0B2347]/55" onClick={() => responder(false)} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo" aria-describedby="confirmar-mensaje" className="relative w-full sm:max-w-[460px] bg-white rounded-t-[28px] sm:rounded-xl shadow-2xl p-6 flex flex-col gap-4 animate-[entrarAviso_0.2s_ease-out]">
        <div className="flex gap-3 items-start">
          <span className={`shrink-0 w-11 h-11 rounded-full grid place-items-center ${pregunta.peligro ? "bg-red-50 text-red-700" : "bg-primary-light text-primary"}`}>
            <Icono nombre={pregunta.peligro ? "alerta" : "check"} size={20} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <h2 id="confirmar-titulo" className="m-0 text-lg font-extrabold text-ink-900">
              {pregunta.titulo}
            </h2>
            {pregunta.mensaje && (
              <p id="confirmar-mensaje" className="m-0 mt-1.5 text-sm text-ink-600">
                {pregunta.mensaje}
              </p>
            )}
          </div>
        </div>
        {pregunta.detalle?.length > 0 && (
          <dl className="m-0 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {pregunta.detalle.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-500">{k}</dt>
                <dd className="m-0 font-semibold text-ink-900 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex gap-2 justify-end flex-wrap">
          <button ref={no} type="button" onClick={() => responder(false)} className="min-h-[44px] px-5 rounded-full border border-gray-200 bg-white font-bold text-sm text-ink-700 hover:bg-gray-50">
            {pregunta.cancelar || "No, volver"}
          </button>
          <button
            ref={si}
            type="button"
            onClick={() => responder(true)}
            className={`min-h-[44px] px-5 rounded-full font-bold text-sm text-white ${pregunta.peligro ? "bg-red-700 hover:bg-red-800" : "bg-primary hover:bg-primary-dark"}`}
          >
            {pregunta.boton || "Sí, continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fuera del proveedor (pruebas, pantallas sueltas) cae a las ventanas del navegador.
export function useConfirmar() {
  return (
    useContext(Contexto) || {
      confirmar: async (o) => window.confirm(typeof o === "string" ? o : [o.titulo, o.mensaje].filter(Boolean).join("\n\n")),
      avisar: () => {},
    }
  );
}
