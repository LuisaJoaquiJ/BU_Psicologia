import { Children, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "../Iconos";

// Avisos flotantes de toda la plataforma: el resultado de una accion (guardado, error, etc.)
// aparece siempre a la vista, aunque la persona este lejos del tope de la pagina.
//   const avisos = useAvisos();
//   avisos.exito("Quedó guardado.");  avisos.error("No fue posible guardar.");
//   avisos.aviso("...");  avisos.info("...");
// Los de exito se cierran solos; los de error se quedan mas tiempo y siempre se pueden cerrar.
// Se detienen mientras el mouse o el teclado estan encima, y el mismo texto no se repite (cuenta ×2).

const TONOS = {
  exito: { color: "#0E8F6B", fondo: "#E3F4F1", icono: "check", duracion: 5000, rol: "status" },
  info: { color: "#1E5AA8", fondo: "#E4EDFB", icono: "alerta", duracion: 6500, rol: "status" },
  aviso: { color: "#B7791F", fondo: "#FDF1D6", icono: "alerta", duracion: 8000, rol: "status" },
  error: { color: "#C62828", fondo: "#FDECEC", icono: "alerta", duracion: 10000, rol: "alert" },
};
const MAX_VISIBLES = 4;

const Contexto = createContext(null);

// Texto de un contenido simple (cadenas y numeros); "" si trae elementos de React.
export function textoPlano(contenido) {
  const partes = Children.toArray(contenido);
  if (!partes.length || partes.some((p) => typeof p !== "string" && typeof p !== "number")) return "";
  return partes.join("").trim();
}

export function AvisosProvider({ children }) {
  const [lista, setLista] = useState([]);

  const mostrar = useCallback((texto, tono = "exito") => {
    const contenido = String(texto || "").trim();
    if (!contenido) return null;
    const clave = `${tono}|${contenido}`;
    setLista((l) => {
      if (l.some((t) => t.clave === clave)) return l.map((t) => (t.clave === clave ? { ...t, veces: t.veces + 1, version: t.version + 1 } : t));
      return [...l.slice(-(MAX_VISIBLES - 1)), { clave, tono, texto: contenido, veces: 1, version: 0 }];
    });
    return clave;
  }, []);
  const descartar = useCallback((clave) => setLista((l) => l.filter((t) => t.clave !== clave)), []);

  const api = useMemo(
    () => ({ mostrar, descartar, exito: (t) => mostrar(t, "exito"), error: (t) => mostrar(t, "error"), aviso: (t) => mostrar(t, "aviso"), info: (t) => mostrar(t, "info") }),
    [mostrar, descartar]
  );

  return (
    <Contexto.Provider value={api}>
      {children}
      {createPortal(
        <div aria-label="Avisos" className="fixed z-[90] top-[68px] sm:top-[92px] md:top-[136px] xl:top-[96px] inset-x-3 sm:inset-x-auto sm:right-6 sm:w-[400px] flex flex-col gap-2.5 pointer-events-none">
          {lista.map((t) => (
            <Aviso key={t.clave} aviso={t} alCerrar={() => descartar(t.clave)} />
          ))}
        </div>,
        document.body
      )}
    </Contexto.Provider>
  );
}

function Aviso({ aviso, alCerrar }) {
  const tono = TONOS[aviso.tono] || TONOS.info;
  const [pausado, setPausado] = useState(false);

  // Se cierra solo; la cuenta vuelve a empezar si el mismo aviso se repite o cuando se suelta el mouse.
  useEffect(() => {
    if (pausado) return undefined;
    const t = setTimeout(alCerrar, tono.duracion);
    return () => clearTimeout(t);
  }, [pausado, aviso.version]);

  return (
    <div
      role={tono.rol}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl border border-white pl-5 pr-2 py-3 shadow-[0_18px_44px_-14px_rgba(11,35,71,0.45)] animate-aparecer motion-reduce:animate-aparecer-suave"
    >
      <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1.5" style={{ background: tono.color }} />
      <span aria-hidden="true" className="mt-0.5 w-6 h-6 shrink-0 rounded-full grid place-items-center" style={{ background: tono.fondo, color: tono.color }}>
        <Icono nombre={tono.icono} size={14} strokeWidth={2.8} />
      </span>
      <p className="m-0 flex-1 pt-0.5 text-[14px] font-semibold leading-snug text-ink-900">
        {aviso.texto}
        {aviso.veces > 1 && <span className="ml-1.5 text-[12px] font-bold text-ink-500 tabular-nums">×{aviso.veces}</span>}
      </p>
      <button type="button" onClick={alCerrar} aria-label="Cerrar aviso" className="w-9 h-9 -my-0.5 shrink-0 rounded-full inline-flex items-center justify-center text-ink-500 hover:bg-black/5 hover:text-ink-900">
        <Icono nombre="cerrar" size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// Fuera del proveedor (pruebas, pantallas sueltas) los avisos no hacen nada.
const SIN_AVISOS = { mostrar: () => null, descartar: () => {}, exito: () => null, error: () => null, aviso: () => null, info: () => null };
export const useAvisos = () => useContext(Contexto) || SIN_AVISOS;

// Version declarativa para pantallas que ya muestran su mensaje con {error && <Aviso>…</Aviso>}:
// mientras exista, el aviso esta a la vista; al desaparecer el mensaje, se retira.
export function AvisoFlotante({ tono = "error", children }) {
  const { mostrar, descartar } = useAvisos();
  const texto = textoPlano(children);
  useEffect(() => {
    if (!texto) return undefined;
    const clave = mostrar(texto, tono);
    return () => descartar(clave);
  }, [texto, tono, mostrar, descartar]);
  return null;
}
