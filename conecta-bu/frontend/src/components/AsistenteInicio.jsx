import { useEffect, useState } from "react";
import { Icono } from "./Iconos";

// Pantalla inicial del asistente (estilo «solo chips»): saludo corto que se
// escribe solo, acciones principales y preguntas sugeridas como chips, y el
// aviso de privacidad. Respeta prefers-reduced-motion: sin animaciones, el
// saludo aparece completo de una vez.

export const NOTA_PRIVACIDAD =
  "Nota: Tus mensajes son confidenciales, salvo que el sistema detecte un riesgo para tu salud o seguridad, en cuyo caso buscaremos ayuda para ti.";

const POR_TANDA = 3;

function prefiereMenosMovimiento() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Efecto de escritura breve (~0,7 s en total, sin importar el largo).
function useEscritura(texto) {
  const [visible, setVisible] = useState(() => (prefiereMenosMovimiento() ? texto : ""));
  useEffect(() => {
    if (prefiereMenosMovimiento()) {
      setVisible(texto);
      return undefined;
    }
    let i = 0;
    const paso = Math.max(1, Math.ceil(texto.length / 28));
    setVisible("");
    const id = setInterval(() => {
      i = Math.min(texto.length, i + paso);
      setVisible(texto.slice(0, i));
      if (i >= texto.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [texto]);
  return visible;
}

const CHIP_BASE =
  "asistente-entra inline-flex items-center gap-1.5 rounded-full border font-bold transition-[transform,box-shadow,border-color,background-color] duration-150 " +
  "hover:scale-[1.04] hover:shadow-[0_6px_16px_-6px_rgba(30,58,95,0.35)] active:scale-95 active:shadow-[0_0_0_4px_rgba(232,116,14,0.22)] " +
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(232,116,14,0.35)] disabled:opacity-50 disabled:pointer-events-none " +
  "motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

// Chips de preguntas sugeridas con un botón para ver otra tanda (rota).
export function SugerenciasChips({ preguntas, onElegir, deshabilitado, retraso = 0 }) {
  const [tanda, setTanda] = useState(0);
  const total = Math.max(1, Math.ceil(preguntas.length / POR_TANDA));
  const visibles = preguntas.slice((tanda % total) * POR_TANDA, (tanda % total) * POR_TANDA + POR_TANDA);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="m-0 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#6B7A8D]">Prueba preguntar</p>
        {total > 1 && (
          <button
            type="button"
            onClick={() => setTanda((t) => t + 1)}
            className="group inline-flex items-center gap-1 h-6 px-2 -mr-1 rounded-full text-[11px] font-bold text-[#C2600A] hover:bg-[#E8740E]/10 active:scale-95 motion-reduce:active:scale-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none motion-reduce:group-hover:rotate-0">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Otras sugerencias
          </button>
        )}
      </div>
      <div key={tanda} className="flex flex-wrap gap-1.5">
        {visibles.map((texto, i) => (
          <button
            key={texto}
            type="button"
            disabled={deshabilitado}
            onClick={() => onElegir(texto)}
            style={{ animationDelay: `${retraso + i * 50}ms` }}
            className={`${CHIP_BASE} h-8 px-3 text-[12px] bg-[#F3EDE1] border-transparent text-[#1E3A5F] hover:bg-white hover:border-[#E8740E]/40`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotaPrivacidad({ className = "" }) {
  return (
    <p className={`m-0 flex items-start gap-1.5 text-[10.5px] leading-snug italic text-[#6B7A8D] ${className}`}>
      <span className="mt-[1px] shrink-0 text-[#1E3A5F]/55" aria-hidden="true">
        <Icono nombre="escudo" size={12} strokeWidth={2.2} />
      </span>
      {NOTA_PRIVACIDAD}
    </p>
  );
}

// Estado inicial del panel flotante.
export function AsistenteInicio({ saludo, acciones, preguntas, onElegir, deshabilitado }) {
  const titulo = useEscritura(saludo.titulo);
  const escribiendo = titulo.length < saludo.titulo.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="asistente-entra w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-md" style={{ background: "linear-gradient(135deg, var(--liquido-1, #3d6288), var(--liquido-3, #162c49))" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4M22 5h-4M4 17v2M5 18H3" /></svg>
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[17px] leading-tight font-black text-[#1E3A5F]" aria-label={saludo.titulo}>
            <span aria-hidden="true">{titulo}</span>
            {escribiendo && <span aria-hidden="true" className="asistente-cursor inline-block w-[2px] h-[1em] ml-0.5 align-[-2px] bg-[#E8740E]" />}
          </p>
          <p className="asistente-entra m-0 mt-0.5 text-[12.5px] leading-snug text-[#6B7A8D]" style={{ animationDelay: "250ms" }}>
            {saludo.detalle}
          </p>
        </div>
      </div>

      <div>
        <p className="m-0 mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#6B7A8D]">Te ayudo con</p>
        <div className="flex flex-wrap gap-1.5">
          {acciones.map((accion, i) => (
            <button
              key={accion.titulo}
              type="button"
              disabled={deshabilitado}
              onClick={() => onElegir(accion.texto)}
              title={accion.detalle}
              style={{ animationDelay: `${300 + i * 55}ms` }}
              className={`${CHIP_BASE} h-8 pl-1 pr-3 text-[12.5px] bg-white border-[#1E3A5F]/10 text-[#1E3A5F] hover:border-[#E8740E]/45`}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-[#E8740E]/10 text-[#C2600A]">
                <Icono nombre={accion.icono || "chat"} size={13} strokeWidth={2.2} />
              </span>
              {accion.chip || accion.titulo}
            </button>
          ))}
        </div>
      </div>

      <SugerenciasChips preguntas={preguntas} onElegir={onElegir} deshabilitado={deshabilitado} retraso={300 + acciones.length * 55} />

      <NotaPrivacidad className="asistente-entra pt-2 border-t border-[#1E3A5F]/10" />
    </div>
  );
}
