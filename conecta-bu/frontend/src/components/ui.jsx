// Piezas de interfaz compartidas por las pantallas de Salud integral.

export const claseCampo =
  "w-full border border-gray-200 rounded-xl px-3.5 min-h-[44px] text-[15px] text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-soft/30 focus:border-primary-soft";

// Igual que claseCampo pero con el ancho de su contenido (selectores en barras).
export const claseCampoCorto = claseCampo.replace("w-full ", "w-auto max-w-full ");

export const botonPrimario =
  "inline-flex items-center justify-center gap-2 bg-primary text-white font-bold text-[15px] px-5 min-h-[46px] rounded-full hover:bg-primary-dark disabled:opacity-60";
export const botonDorado =
  "inline-flex items-center justify-center gap-2 bg-gold text-primary font-bold text-[15px] px-5 min-h-[46px] rounded-full hover:brightness-95 disabled:opacity-60";
export const botonSecundario =
  "inline-flex items-center justify-center gap-2 border-[1.5px] border-gray-200 bg-white text-primary font-bold text-sm px-4 min-h-[42px] rounded-full hover:bg-gray-50 disabled:opacity-60";

export function Encabezado({ kicker, titulo, descripcion, acciones }) {
  return (
    <div className="flex justify-between items-end gap-4 flex-wrap mb-7">
      <div className="min-w-0">
        {kicker && <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">{kicker}</p>}
        <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">{titulo}</h1>
        {descripcion && <p className="mt-1.5 mb-0 text-ink-500 max-w-[680px]">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2.5 flex-wrap">{acciones}</div>}
    </div>
  );
}

export function Tarjeta({ titulo, subtitulo, acciones, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-[22px] p-5 sm:p-6 min-w-0 ${className}`}>
      {(titulo || acciones) && (
        <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            {titulo && <h2 className="m-0 font-sans text-lg font-bold text-primary">{titulo}</h2>}
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
    <div className={`rounded-[20px] p-5 ${destacado ? "bg-primary text-white" : "bg-white border border-gray-200"}`}>
      <p className={`m-0 text-[13px] ${destacado ? "text-white/75" : "text-ink-500"}`}>{titulo}</p>
      <p className={`mt-1.5 mb-0 font-display text-[36px] leading-none font-semibold tabular-nums ${destacado ? "text-gold" : "text-primary"}`}>
        {valor}
      </p>
      {detalle && <p className={`mt-2 mb-0 text-[13px] ${destacado ? "text-white/75" : "text-ink-500"}`}>{detalle}</p>}
    </div>
  );
}

const TONOS = {
  azul: "bg-primary-light text-primary-soft",
  verde: "bg-[#E3F4F1] text-[#0B6B61]",
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
  return <p className="m-0 text-sm text-ink-500 bg-gray-50 rounded-xl p-4">{children}</p>;
}

// Barras horizontales simples (una serie) con el valor visible.
export function BarrasHorizontales({ datos, color = "#163F86", formato = (v) => v }) {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  if (!datos.length) return <Vacio>Sin datos todavía.</Vacio>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
      {datos.map((d) => (
        <li key={d.nombre} className="text-sm">
          <div className="flex justify-between gap-3 mb-1">
            <span className="truncate text-ink-600">{d.nombre}</span>
            <strong className="tabular-nums text-ink-900">{formato(d.total)}</strong>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.total / maximo) * 100}%`, background: d.color || color }} />
          </div>
        </li>
      ))}
    </ul>
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

// Banda de bienvenida a todo el ancho (diseño A). Va fuera del <main> de la
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
      <svg viewBox="0 0 400 400" width="520" height="520" aria-hidden="true" className="absolute -right-28 -top-40 pointer-events-none">
        <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(127,232,255,0.30)" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="130" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      </svg>
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-12 flex gap-8 lg:gap-14 flex-wrap items-center">
        <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-3">
          <h1 className="m-0 text-[36px] sm:text-[48px] leading-[1.05] font-extrabold text-white">{titulo}</h1>
          {fecha && <p className="m-0 text-[15px] font-semibold text-[#B9C7DE]">{fecha}</p>}
          {texto && <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC] max-w-[560px]">{texto}</p>}
          {children}
          {acciones && <div className="flex gap-3 flex-wrap mt-2">{acciones}</div>}
        </div>
        {aside && (
          <div className="flex-[1_1_340px] max-w-[460px] min-w-0 bg-white text-ink-900 rounded-[24px] p-6 sm:p-7 flex flex-col gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
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
  "bg-cyan text-primary-dark font-extrabold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center gap-2 hover:brightness-95 disabled:opacity-60";
export const botonBandaSecundario =
  "border-[1.5px] border-white/45 text-white font-semibold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center gap-2 hover:bg-white/10";

export function hoyLargo() {
  const texto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
