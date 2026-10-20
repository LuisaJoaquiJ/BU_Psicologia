import { Icono } from "./componentes/Iconos";

// Botones tipo pastilla para filtrar o elegir, y el selector de categorías
// (Pregrado, Posgrado, Egresado).

// Pastillas para elegir una opcion (filtros, alcance, prioridad...).
export function Pastillas({ opciones, valor, onCambio, etiqueta, conteos }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const [id, texto] = Array.isArray(o) ? o : [o, o];
        const activo = valor === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambio(id)}
            className={`min-h-[40px] px-4 rounded-full border text-sm font-bold inline-flex items-center gap-2 transition-colors ${
              activo ? "boton-liquido border-transparent" : "burbuja text-ink-600 hover:bg-white"
            }`}
          >
            {texto}
            {conteos && conteos[id] !== undefined && (
              <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full grid place-items-center text-[12px] tabular-nums ${activo ? "bg-white/20" : "bg-gray-100"}`}>{conteos[id]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Casillas de categorias (vacio = todas).
export function SelectorCategorias({ categorias, valor = [], onCambio }) {
  const todas = valor.length === 0;
  const alternar = (c) => {
    const base = todas ? [...categorias] : [...valor];
    const nueva = base.includes(c) ? base.filter((x) => x !== c) : [...base, c];
    onCambio(nueva.length === 0 || nueva.length === categorias.length ? [] : nueva);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {categorias.map((c) => {
        const marcada = todas || valor.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={marcada}
            onClick={() => alternar(c)}
            className={`min-h-[36px] px-3.5 rounded-full border text-[13px] font-bold inline-flex items-center gap-1.5 ${
              marcada ? "bg-[#E3F4F1] border-[#9ED9CF] text-[#0B6B61]" : "bg-white border-gray-200 text-ink-500 line-through"
            }`}
          >
            {marcada && <Icono nombre="check" size={13} strokeWidth={2.6} />}
            {c}
          </button>
        );
      })}
    </div>
  );
}

export const textoCategorias = (lista) => (lista?.length ? `Solo ${lista.join(" y ").toLowerCase()}` : "Todas las categorías");
