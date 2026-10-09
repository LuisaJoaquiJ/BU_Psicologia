import { useEffect, useRef, useState } from "react";
import { revisarOrtografia } from "../lib/ortografia";

// Ayuda de ortografia para toda la aplicacion: al hacer una pausa o al salir
// de un campo de texto, si hay tildes que faltan o espacios de
// mas, aparece un aviso abajo con la sugerencia y un boton para aplicarla.
// Nunca cambia el texto sin que la persona lo acepte.

const TIPOS_TEXTO = new Set(["text", "search", ""]);

function esCampoDeTexto(el) {
  if (!el || el.readOnly || el.disabled) return false;
  if (el.getAttribute("spellcheck") === "false" || el.dataset.ortografia === "no") return false;
  if (el.tagName === "TEXTAREA") return true;
  return el.tagName === "INPUT" && TIPOS_TEXTO.has(el.getAttribute("type") || "") && el.type !== "search";
}

// Cambia el valor de un campo controlado por React y le avisa del cambio.
function escribirValor(el, valor) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function AyudaOrtografia() {
  const [sugerencia, setSugerencia] = useState(null);
  const ignoradas = useRef(new Set());

  useEffect(() => {
    let pausa = null;
    function revisar(el) {
      if (!esCampoDeTexto(el)) return;
      const original = el.value;
      const { texto, cambios } = revisarOrtografia(original, { mayusculaInicial: el.tagName === "TEXTAREA" });
      if (!cambios.length || texto === original || ignoradas.current.has(original)) return;
      setSugerencia({ el, original, texto, palabras: cambios.filter(([a]) => !a.includes(" ")) });
    }
    const alSalir = (e) => revisar(e.target);
    // Tambien cuando la persona hace una pausa al escribir, para avisar antes
    // de que guarde el formulario.
    const alEscribir = (e) => {
      clearTimeout(pausa);
      const el = e.target;
      pausa = setTimeout(() => document.activeElement === el && revisar(el), 1500);
    };
    document.addEventListener("focusout", alSalir);
    document.addEventListener("input", alEscribir);
    return () => {
      clearTimeout(pausa);
      document.removeEventListener("focusout", alSalir);
      document.removeEventListener("input", alEscribir);
    };
  }, []);

  // Se cierra sola si la persona sigue escribiendo en ese campo.
  useEffect(() => {
    if (!sugerencia) return undefined;
    const t = setTimeout(() => setSugerencia(null), 15000);
    const alEscribir = (e) => e.target === sugerencia.el && setSugerencia(null);
    document.addEventListener("input", alEscribir);
    return () => {
      clearTimeout(t);
      document.removeEventListener("input", alEscribir);
    };
  }, [sugerencia]);

  if (!sugerencia) return null;

  function aplicar() {
    const { el, original, texto } = sugerencia;
    setSugerencia(null);
    if (document.body.contains(el) && el.value === original) escribirValor(el, texto);
  }

  const palabras = sugerencia.palabras.slice(0, 4);
  return (
    <div
      role="status"
      className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-8 w-[min(560px,calc(100vw-32px))] bg-primary-dark text-white rounded-2xl shadow-[0_16px_40px_rgba(11,35,71,0.35)] px-4 py-3 flex items-center gap-3 flex-wrap"
    >
      <p className="m-0 flex-1 min-w-[200px] text-sm">
        <strong className="text-cyan">Ortografía:</strong>{" "}
        {palabras.length
          ? palabras.map(([a, b], i) => (
              <span key={i}>
                {i > 0 && ", "}
                <span className="line-through opacity-70">{a}</span> → <strong>{b}</strong>
              </span>
            ))
          : "hay espacios de más o falta la mayúscula inicial."}
        {sugerencia.palabras.length > 4 && ` y ${sugerencia.palabras.length - 4} más`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            ignoradas.current.add(sugerencia.original);
            setSugerencia(null);
          }}
          className="min-h-[40px] px-3.5 rounded-full text-sm font-bold text-[#B9C7DE] hover:text-white"
        >
          Dejar así
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={aplicar}
          className="min-h-[40px] px-4 rounded-full bg-cyan text-primary-dark text-sm font-extrabold"
        >
          Corregir
        </button>
      </div>
    </div>
  );
}
