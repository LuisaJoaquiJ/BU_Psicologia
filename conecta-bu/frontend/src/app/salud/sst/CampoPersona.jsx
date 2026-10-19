import { useEffect, useId, useRef, useState } from "react";
import { http } from "../../../lib/api/http";
import { claseCampo } from "../comunes/componentes/ui";

const DOC_CORTO = { CC: "C.C.", CE: "C.E.", TI: "T.I." };

// Nombre de quien viaja con sugerencias: al escribir se despliegan las
// personas conocidas (docentes y administrativos de Salud, o quienes ya
// viajaron) y al elegir una se llena su cedula. Si no aparece, se escribe
// a mano como siempre.
export function CampoPersona({ id, valor = "", onCambio, onElegir, placeholder = "Escribe el nombre o la cédula", required, ariaLabel }) {
  const [sugerencias, setSugerencias] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const ultimaElegida = useRef(null);
  const listaId = useId();

  useEffect(() => {
    const q = valor.trim();
    if (q.length < 2 || q === ultimaElegida.current) {
      setSugerencias([]);
      setBuscando(false);
      return undefined;
    }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(() => {
      http
        .get("/reportes-sst/personas", { params: { q } })
        .then((res) => {
          if (!vigente) return;
          setSugerencias(res.data.personas);
          setActivo(res.data.personas.length ? 0 : -1);
        })
        .catch(() => vigente && setSugerencias([]))
        .finally(() => vigente && setBuscando(false));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [valor]);

  function elegir(p) {
    ultimaElegida.current = p.nombre;
    onElegir(p);
    setSugerencias([]);
    setAbierto(false);
  }

  function teclas(e) {
    if (!abierto || !sugerencias.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length);
    } else if (e.key === "Enter" && activo >= 0) {
      e.preventDefault();
      elegir(sugerencias[activo]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const mostrar = abierto && sugerencias.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        value={valor}
        required={required}
        maxLength={200}
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-activedescendant={mostrar && activo >= 0 ? `${listaId}-${activo}` : undefined}
        onChange={(e) => {
          ultimaElegida.current = null;
          onCambio(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onKeyDown={teclas}
        className={claseCampo}
      />
      {buscando && abierto && valor.trim().length >= 2 && !sugerencias.length && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">Buscando…</span>
      )}
      {mostrar && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-1.5 list-none m-0 p-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_14px_34px_rgba(11,42,91,0.16)] max-h-[280px] overflow-y-auto"
        >
          {sugerencias.map((p, i) => (
            <li
              key={p.documento}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(p);
              }}
              onMouseEnter={() => setActivo(i)}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 cursor-pointer ${i === activo ? "bg-primary-light" : ""}`}
            >
              <span className="min-w-0 leading-tight">
                <span className="block font-semibold text-ink-900 truncate">{p.nombre}</span>
                <span className="block text-xs font-normal text-ink-500">{p.detalle}</span>
              </span>
              <span className="text-sm font-semibold text-primary-soft tabular-nums whitespace-nowrap">
                {DOC_CORTO[p.tipoDocumento] || p.tipoDocumento} {p.documento}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
