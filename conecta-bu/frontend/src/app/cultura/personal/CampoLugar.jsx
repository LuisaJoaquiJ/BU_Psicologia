import { useEffect, useRef, useState } from "react";
import { campo } from "./Marco";
import { buscarLugares } from "./lugares";

// Campo «Lugar» que propone sitios mientras se escribe, justo debajo del campo.
// Al elegir uno se llama alElegir({ nombre, latitud, longitud }).
export function CampoLugar({ valor, alCambiar, alElegir, etiqueta = "Lugar" }) {
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const pedido = useRef(null);
  const elegido = useRef(""); // nombre ya elegido: no se vuelve a buscar

  useEffect(() => {
    const q = String(valor || "").trim();
    pedido.current?.abort();
    if (q.length < 3 || q === elegido.current) {
      setResultados(null);
      setBuscando(false);
      return undefined;
    }
    const t = setTimeout(async () => {
      const control = new AbortController();
      pedido.current = control;
      setBuscando(true);
      setError(false);
      try {
        setResultados(await buscarLugares(q, control.signal));
        setAbierto(true);
      } catch (err) {
        if (err.name === "AbortError") return;
        setResultados(null);
        setError(true);
      } finally {
        if (pedido.current === control) setBuscando(false);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [valor]);
  useEffect(() => () => pedido.current?.abort(), []);

  function elegir(r) {
    elegido.current = r.nombre;
    setResultados(null);
    setAbierto(false);
    alElegir(r);
  }

  const visible = abierto && (buscando || resultados);
  return (
    <div className="relative text-sm font-semibold">
      <label>
        {etiqueta}
        <input
          className={`${campo} w-full mt-1`}
          value={valor}
          autoComplete="off"
          onChange={(e) => {
            alCambiar(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => e.key === "Escape" && setAbierto(false)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          aria-expanded={Boolean(visible)}
          aria-autocomplete="list"
        />
      </label>
      {visible && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl bg-white border border-gray-200 shadow-[0_12px_30px_rgba(31,17,71,0.18)] overflow-hidden font-normal">
          {buscando && <p className="m-0 px-3 py-2.5 text-[13px] text-ink-500">Buscando «{String(valor).trim()}»…</p>}
          {!buscando && resultados && (
            <>
              <p className="m-0 px-3 py-2 text-[13px] text-ink-500 border-b border-gray-100">
                {resultados.length ? "Elige un lugar para marcarlo en el mapa:" : "No encontré ese lugar. Márcalo en el mapa o pega un enlace de Google Maps."}
              </p>
              <ul className="list-none m-0 p-0" role="listbox">
                {resultados.map((r) => (
                  <li key={`${r.latitud},${r.longitud}`} role="option" aria-selected="false" className="border-t border-gray-100 first:border-t-0">
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(r)} className="w-full text-left min-h-[48px] px-3 py-2 hover:bg-primary-light/60 focus-visible:bg-primary-light/60">
                      <span className="block text-sm font-bold text-primary-dark">{r.nombre}</span>
                      {r.detalle && <span className="block text-[13px] text-ink-500 truncate">{r.detalle}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {error && !visible && <p className="m-0 mt-1 text-[13px] font-normal text-ink-500">No pudimos buscar el lugar ahora. Márcalo en el mapa.</p>}
    </div>
  );
}
