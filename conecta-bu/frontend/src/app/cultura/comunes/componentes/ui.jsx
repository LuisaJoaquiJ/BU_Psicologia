import { AvisoFlotante, textoPlano } from "../../../../components/avisos/Avisos";
import { useLayoutEffect, useRef, useState } from "react";
import { BarrasH } from "./graficas/Barras";
import { Icono } from "./Iconos";
// Piezas de interfaz compartidas por las pantallas de Salud integral.

export const claseCampo =
  "w-full border border-[#DCE3EE] rounded-xl px-3.5 min-h-[44px] text-[15px] text-ink-900 bg-white/90 shadow-[inset_0_1px_2px_rgba(11,35,71,0.05)] placeholder:text-gray-400 transition-[border-color,box-shadow] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15";

// Igual que claseCampo pero con el ancho de su contenido (selectores en barras).
export const claseCampoCorto = claseCampo.replace("w-full ", "w-auto max-w-full ");

export const botonPrimario =
  "inline-flex items-center justify-center gap-2 boton-liquido font-semibold text-[15px] px-5 min-h-[44px] rounded-full transition-transform duration-200 ease-salida hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0";
// En este modulo el boton destacado lleva el color del modulo, no el dorado.
export const botonDorado =
  "inline-flex items-center justify-center gap-2 boton-liquido font-semibold text-[15px] px-5 min-h-[44px] rounded-full transition-transform duration-200 ease-salida hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60";
export const botonSecundario =
  "inline-flex items-center justify-center gap-2 burbuja text-primary-dark font-semibold text-sm px-4 min-h-[42px] rounded-full transition-[transform,background-color] duration-200 ease-salida hover:bg-white hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60";

// Filtros y vistas: eligen que se ve, no hacen nada. Control segmentado con un indicador
// blanco que se desliza hasta la opcion elegida (no es un boton de accion).
// opciones: [[id, texto, icono?]]. Los botones son de texto; el fondo lo pone el indicador.
export const segmentos = "relative inline-flex flex-wrap items-center gap-0.5 p-1 rounded-[14px] bg-primary-light/60 ring-1 ring-primary/10 backdrop-blur-sm";
export function Segmentos({ opciones, valor, alCambiar, etiqueta, className = "", compacto = false }) {
  const caja = useRef(null);
  const [marca, setMarca] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const el = caja.current?.querySelector('[aria-pressed="true"]');
      setMarca(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    medir();
    if (typeof ResizeObserver === "undefined" || !caja.current) return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(caja.current);
    return () => ro.disconnect();
  }, [valor, opciones.length]);
  return (
    <div ref={caja} role="group" aria-label={etiqueta} className={`${segmentos} ${className}`}>
      {marca && (
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(31,17,71,0.12),0_6px_14px_-4px_rgba(31,17,71,0.2)] transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ width: marca.w, height: marca.h, transform: `translate(${marca.x}px, ${marca.y}px)` }}
        />
      )}
      {opciones.map(([id, texto, icono]) => (
        <button
          key={id || "todos"}
          type="button"
          aria-pressed={valor === id}
          onClick={() => alCambiar(id)}
          className={`relative z-10 ${compacto ? "min-h-[32px] px-3" : "min-h-[36px] px-4"} rounded-[10px] text-[13px] font-bold inline-flex items-center gap-1.5 transition-colors duration-200 active:scale-[0.97] motion-reduce:active:scale-100 ${
            valor === id ? "text-primary-dark" : "text-ink-600 hover:text-primary-dark"
          }`}
        >
          {icono && <Icono nombre={icono} size={16} strokeWidth={2.2} />}
          {texto}
        </button>
      ))}
    </div>
  );
}
// Acciones que quitan, rechazan o cancelan: en rojo, para no confundirlas con las demas.
export const botonPeligro =
  "inline-flex items-center justify-center gap-2 border border-red-300 text-red-700 bg-white/70 font-bold text-sm px-4 min-h-[44px] rounded-full hover:bg-red-50 transition-colors disabled:opacity-60";
export const botonPeligroTexto =
  "inline-flex items-center justify-center min-h-[44px] px-3 rounded-full text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60";

export function Encabezado({ kicker, titulo, descripcion, acciones }) {
  return (
    <div className="flex justify-between items-end gap-4 flex-wrap mb-7">
      <div className="min-w-0">
        {kicker && <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">{kicker}</p>}
        <h1 className="m-0 font-sans text-[32px] sm:text-[40px] font-extrabold tracking-[-0.04em]">{titulo}</h1>
        {descripcion && <p className="mt-1.5 mb-0 text-ink-500 max-w-[680px]">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2.5 flex-wrap">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ titulo, subtitulo, acciones, children, className = "" }) {
  return (
    <section className={`vidrio-panel rounded-[22px] p-5 sm:p-6 min-w-0 ${className}`}>
      {(titulo || acciones) && (
        <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            {titulo && <h2 className="m-0 font-display text-lg font-semibold text-ink-900">{titulo}</h2>}
            {subtitulo && <p className="mt-1 mb-0 text-sm text-ink-500">{subtitulo}</p>}
          </div>
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ titulo, valor, detalle, destacado }) {
  return (
    <div className={`rounded-[20px] p-5 ${destacado ? "bg-[linear-gradient(155deg,var(--liquido-1,#2D67C6)_0%,var(--liquido-2,#1D4E9E)_50%,var(--liquido-3,#163F86)_100%)] text-[color:var(--liquido-texto,#FFFFFF)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_36px_var(--liquido-sombra,rgba(29,78,158,0.3))]" : "vidrio-panel"}`}>
      <p className={`m-0 text-[13px] ${destacado ? "opacity-80" : "text-ink-500"}`}>{titulo}</p>
      <p className={`mt-1.5 mb-0 font-display text-[36px] leading-none font-semibold tabular-nums ${destacado ? "" : "text-ink-900"}`}>
        {valor}
      </p>
      {detalle && <p className={`mt-2 mb-0 text-[13px] ${destacado ? "opacity-80" : "text-ink-500"}`}>{detalle}</p>}
    </div>
  );
}

const TONOS = {
  azul: "bg-primary-light text-primary-soft",
  verde: "bg-teal-light text-teal-dark",
  dorado: "bg-gold-light text-[#7A5405]",
  rojo: "bg-red-50 text-red-700",
  gris: "bg-gray-100 text-ink-600",
};

export function Insignia({ tono = "azul", children, className = "" }) {
  return <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-md px-2 py-0.5 select-none cursor-default ${TONOS[tono]} ${className}`}>{children}</span>;
}

export function Aviso({ tono = "rojo", children }) {
  // El resultado de una accion (error o exito) sale como aviso flotante, a la vista aunque se este lejos del tope.
  const texto = textoPlano(children);
  if (texto && (tono === "rojo" || tono === "verde")) return <AvisoFlotante tono={tono === "rojo" ? "error" : "exito"}>{texto}</AvisoFlotante>;
  const estilos = {
    rojo: "text-red-700 bg-red-50 border-red-100",
    verde: "text-[#0B6B61] bg-[#E3F4F1] border-[#C8EBE3]",
    dorado: "text-[#5C4206] bg-gold-light border-[#F3E2B5]",
    azul: "text-primary-soft bg-primary-light border-[#DCE4F3]",
  };
  return <div className={`text-sm rounded-xl border px-4 py-3 ${estilos[tono]}`}>{children}</div>;
}

export function Campo({ etiqueta, ayuda, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold text-ink-600 min-w-0 ${className}`}>
      {etiqueta}
      {children}
      {ayuda && <span className="text-xs font-normal text-ink-500">{ayuda}</span>}
    </label>
  );
}

// Carga: bloques con la forma del contenido, no un texto "Cargando…".
// forma: "lista" (filas), "tarjetas" (cuadricula) o "linea" (un dato corto).
export function Esqueleto({ forma = "lista", cantidad = 3, etiqueta = "Cargando…" }) {
  const pulso = "animate-pulse motion-reduce:animate-none";
  if (forma === "linea") {
    return (
      <span role="status" className={`block h-5 w-40 max-w-full rounded-full bg-primary-light ${pulso}`}>
        <span className="sr-only">{etiqueta}</span>
      </span>
    );
  }
  return (
    <div role="status" className={forma === "tarjetas" ? "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]" : "flex flex-col gap-3"}>
      <span className="sr-only">{etiqueta}</span>
      {Array.from({ length: cantidad }, (_, i) => (
        <span key={i} aria-hidden="true" className={`block rounded-[22px] bg-white/70 border border-white ${forma === "tarjetas" ? "h-56" : "h-20"} ${pulso}`} />
      ))}
    </div>
  );
}

// Estado vacio: que pasa y que puede hacer ahora la persona (accion: botones
// o enlaces). compacto: dentro de una tarjeta que ya tiene titulo.
export function EstadoVacio({ icono = "calendario", titulo, texto, accion, compacto = false }) {
  return (
    <div className={`text-center flex flex-col items-center gap-3 ${compacto ? "py-6 px-4" : "vidrio-panel rounded-[22px] p-8 sm:p-10"}`}>
      <span aria-hidden="true" className="w-14 h-14 rounded-full bg-primary-light text-primary grid place-items-center">
        <Icono nombre={icono} size={26} strokeWidth={2} />
      </span>
      <p className="m-0 text-lg font-extrabold text-primary-dark">{titulo}</p>
      {texto && <p className="m-0 text-ink-500 max-w-md [text-wrap:pretty]">{texto}</p>}
      {accion && <div className="flex flex-wrap justify-center gap-2 mt-1">{accion}</div>}
    </div>
  );
}

export function Vacio({ children }) {
  return <p className="m-0 text-sm text-ink-500 bg-gray-50 rounded-lg p-4">{children}</p>;
}

// Barras horizontales simples (una serie) con el valor visible, hechas con
// Recharts (mismo componente BarrasH de los tableros).
export function BarrasHorizontales({ datos, color = "#163F86", formato = (v) => v }) {
  if (!datos.length) return <Vacio>Sin datos todavía.</Vacio>;
  return (
    <BarrasH
      filas={datos.map((d) => ({ id: d.nombre, nombre: d.nombre, total: d.total }))}
      colores={Object.fromEntries(datos.filter((d) => d.color).map((d) => [d.nombre, d.color]))}
      color={color}
      formato={formato}
      vacio="Sin datos todavía."
    />
  );
}

// Estados de citas y eventos: una sola etiqueta y un solo color en todas las
// pantallas (antes cada pantalla tenía su mapa y "Agendada" salía en azul en
// una y en verde en otra).
const ESTADOS = {
  Agendada: { texto: "Agendada", tono: "azul" },
  Atendida: { texto: "Atendida", tono: "verde" },
  NoAsistio: { texto: "No asistió", tono: "dorado" },
  Cancelada: { texto: "Cancelada", tono: "gris" },
  Publicado: { texto: "Publicado", tono: "verde" },
  Borrador: { texto: "Borrador", tono: "gris" },
  Cerrado: { texto: "Cerrado", tono: "azul" },
  Cancelado: { texto: "Cancelado", tono: "gris" },
  Confirmada: { texto: "Inscrito", tono: "azul" },
};

export function textoEstado(estado) {
  return ESTADOS[estado]?.texto || estado;
}

export function Estado({ estado }) {
  const e = ESTADOS[estado] || { texto: estado, tono: "gris" };
  return <Insignia tono={e.tono}>{e.texto}</Insignia>;
}

// Banda de bienvenida a todo el ancho, en el azul noche institucional. Va fuera del <main> de la
// página, justo debajo de la barra. "aside" es una tarjeta blanca a la
// derecha (próxima cita, resumen…); "lado" pone contenido libre a la derecha; "imagen" pone una foto de fondo tenue.
export function BandaInicio({ titulo, fecha, texto, acciones, aside, lado, imagen, children }) {
  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6">
    <section className="relative overflow-hidden bg-[#071A38] text-white rounded-[24px] sm:rounded-[28px]">
      {/* Aurora con los colores del modulo (quieta si se pidio reducir movimiento). */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[620px] h-[620px] -left-40 -top-64 rounded-full blur-[30px] animate-deriva-a motion-reduce:animate-none" style={{ background: "radial-gradient(circle, rgba(124,92,214,0.85) 0%, transparent 70%)" }} />
        <div className="absolute w-[560px] h-[560px] left-[38%] -top-32 rounded-full blur-[40px] animate-deriva-b motion-reduce:animate-none" style={{ background: "radial-gradient(circle, rgba(235,104,140,0.5) 0%, transparent 70%)" }} />
        <div className="absolute w-[520px] h-[520px] left-[18%] -bottom-[330px] rounded-full blur-[40px] animate-deriva-c motion-reduce:animate-none" style={{ background: "radial-gradient(circle, rgba(29,78,158,0.9) 0%, transparent 70%)" }} />
      </div>
      <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex gap-8 lg:gap-12 flex-wrap items-center">
        <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-3">
          {fecha && <p className="m-0 text-[15px] font-semibold text-[#B9C7DE]">{fecha}</p>}
          <h1 className="m-0 font-sans text-[34px] sm:text-[46px] leading-[1.04] tracking-[-0.04em] font-extrabold text-white max-w-[16em]">{titulo}</h1>
          {texto && <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC] max-w-[560px]">{texto}</p>}
          {children}
          {acciones && <div className="flex gap-3 flex-wrap mt-2">{acciones}</div>}
        </div>
        {aside && (
          <div className="flex-[1_1_340px] max-w-[460px] min-w-0 bg-white/95 text-ink-900 rounded-[24px] shadow-[0_24px_60px_rgba(2,10,28,0.35)] p-6 sm:p-7 flex flex-col gap-4">
            {aside}
          </div>
        )}
        {lado && <div className="relative shrink-0 mx-auto lg:mx-0">{lado}</div>}
      </div>
    </section>
    </div>
  );
}

// Botones para usar dentro de la banda (fondo azul oscuro).
export const botonBandaPrincipal =
  "bg-white text-primary-dark font-bold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center gap-2 shadow-[0_8px_20px_rgba(2,10,28,0.25)] transition-transform duration-200 ease-salida hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60";
export const botonBandaSecundario =
  "bg-white/10 border-[1.5px] border-white/35 text-white font-bold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center gap-2 transition-colors duration-200 hover:bg-white/[0.18]";

export function hoyLargo() {
  const texto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
