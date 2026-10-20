import { BarrasH } from "./graficas/Barras";
// Piezas de interfaz compartidas por las pantallas de Salud integral.

export const claseCampo =
  "w-full border border-[#DCE3EE] rounded-xl px-3.5 min-h-[44px] text-[15px] text-ink-900 bg-white/90 shadow-[inset_0_1px_2px_rgba(11,35,71,0.05)] placeholder:text-gray-400 transition-[border-color,box-shadow] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/15";

// Igual que claseCampo pero con el ancho de su contenido (selectores en barras).
export const claseCampoCorto = claseCampo.replace("w-full ", "w-auto max-w-full ");

export const botonPrimario =
  "inline-flex items-center justify-center gap-2 boton-liquido font-semibold text-[15px] px-5 min-h-[44px] rounded-full transition-transform duration-200 ease-salida hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0";
export const botonDorado =
  "inline-flex items-center justify-center gap-2 boton-liquido-dorado font-semibold text-[15px] px-5 min-h-[44px] rounded-full transition-transform duration-200 ease-salida hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60";
export const botonSecundario =
  "inline-flex items-center justify-center gap-2 burbuja text-primary-dark font-semibold text-sm px-4 min-h-[42px] rounded-full transition-[transform,background-color] duration-200 ease-salida hover:bg-white hover:-translate-y-px motion-reduce:hover:translate-y-0 disabled:opacity-60";

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
  return <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${TONOS[tono]} ${className}`}>{children}</span>;
}

export function Aviso({ tono = "rojo", children }) {
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
    <section className="relative overflow-hidden bg-primary-dark text-white">
      {imagen && (
        <>
          <img src={imagen} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-25" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,#0B2347_35%,rgba(11,35,71,0.6))]" />
        </>
      )}
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-12 flex gap-8 lg:gap-14 flex-wrap items-center">
        <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-3">
          <h1 className="m-0 text-[36px] sm:text-[48px] leading-[1.05] font-bold text-white">{titulo}</h1>
          {fecha && <p className="m-0 text-[15px] font-semibold text-[#B9C7DE]">{fecha}</p>}
          {texto && <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC] max-w-[560px]">{texto}</p>}
          {children}
          {acciones && <div className="flex gap-3 flex-wrap mt-2">{acciones}</div>}
        </div>
        {aside && (
          <div className="flex-[1_1_340px] max-w-[460px] min-w-0 bg-white text-ink-900 rounded-xl border border-white/10 p-6 sm:p-7 flex flex-col gap-4">
            {aside}
          </div>
        )}
        {lado && <div className="relative shrink-0 mx-auto lg:mx-0">{lado}</div>}
      </div>
    </section>
  );
}

// Botones para usar dentro de la banda (fondo azul oscuro).
export const botonBandaPrincipal =
  "bg-white text-primary-dark font-medium text-[15px] px-5 min-h-[44px] rounded-md inline-flex items-center gap-2 transition-all duration-200 hover:-translate-y-px hover:bg-primary-light disabled:opacity-60";
export const botonBandaSecundario =
  "border border-white/35 text-white font-medium text-[15px] px-5 min-h-[44px] rounded-md inline-flex items-center gap-2 transition-all duration-200 hover:bg-white/10 hover:-translate-y-px";

export function hoyLargo() {
  const texto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
