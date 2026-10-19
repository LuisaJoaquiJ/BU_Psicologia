// Banda de inicio con aurora (manchas de luz que se mueven despacio sobre el
// azul noche), panel de vidrio y entrada en cascada. Cada modulo usa su tono.
// Con "reducir movimiento" la aurora queda quieta y la entrada es solo un fundido.

const TONOS = {
  "desarrollo-humano": {
    manchas: ["rgba(29,78,158,0.95)", "rgba(30,158,154,0.85)", "rgba(201,162,63,0.6)"],
    fecha: "text-[#9EEFFF]",
    titulo: "bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#B8F4FF_75%,#EAD8A2_100%)]",
    boton: "bg-[linear-gradient(100deg,#7FE8FF_0%,#3FD0C9_55%,#1E9E9A_100%)] hover:shadow-[0_10px_28px_rgba(127,232,255,0.45)]",
  },
  salud: {
    manchas: ["rgba(30,158,154,0.95)", "rgba(27,175,122,0.75)", "rgba(127,232,255,0.45)"],
    fecha: "text-[#8FF0D6]",
    titulo: "bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#B5F5E4_75%,#9EEFFF_100%)]",
    boton: "bg-[linear-gradient(100deg,#9EF5DD_0%,#3FD0B0_55%,#1BAF7A_100%)] hover:shadow-[0_10px_28px_rgba(63,208,176,0.45)]",
  },
  deporte: {
    manchas: ["rgba(235,104,52,0.85)", "rgba(201,162,63,0.7)", "rgba(29,78,158,0.9)"],
    fecha: "text-[#FFC9A8]",
    titulo: "bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#FFD3B8_75%,#EAD8A2_100%)]",
    boton: "bg-[linear-gradient(100deg,#FFC48F_0%,#F58C55_55%,#EB6834_100%)] hover:shadow-[0_10px_28px_rgba(245,140,85,0.45)]",
  },
  super: {
    manchas: ["rgba(29,78,158,0.95)", "rgba(201,162,63,0.65)", "rgba(30,158,154,0.8)"],
    fecha: "text-[#EAD8A2]",
    titulo: "bg-[linear-gradient(100deg,#FFFFFF_0%,#FFFFFF_45%,#EAD8A2_75%,#B8F4FF_100%)]",
    boton: "bg-[linear-gradient(100deg,#F3E3B3_0%,#E0BE62_55%,#C9A23F_100%)] hover:shadow-[0_10px_28px_rgba(224,190,98,0.45)]",
  },
};

// Entrada al cargar: los bloques aparecen en cascada (50 ms entre uno y otro).
export const ENTRA = "animate-aparecer motion-reduce:animate-aparecer-suave";
export const retraso = (ms) => ({ animationDelay: `${ms}ms` });

export const botonAuroraSecundario =
  "min-h-[50px] inline-flex items-center gap-2 px-[22px] rounded-full bg-white/10 border-[1.5px] border-white/35 text-white font-bold text-[15px] no-underline hover:bg-white/[0.18]";
export const botonAuroraPrincipal = (tono = "desarrollo-humano") =>
  `min-h-[50px] inline-flex items-center gap-2 px-6 rounded-full text-[#071A38] font-extrabold text-[15px] no-underline transition hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${TONOS[tono].boton}`;

function Manchas({ colores }) {
  const [a, b, c] = colores;
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute w-[620px] h-[620px] -left-40 -top-64 rounded-full blur-[30px] animate-deriva-a motion-reduce:animate-none" style={{ background: `radial-gradient(circle, ${a} 0%, transparent 70%)` }} />
      <div className="absolute w-[560px] h-[560px] left-[38%] -top-32 rounded-full blur-[40px] animate-deriva-b motion-reduce:animate-none" style={{ background: `radial-gradient(circle, ${b} 0%, transparent 70%)` }} />
      <div className="absolute w-[520px] h-[520px] left-[18%] -bottom-[330px] rounded-full blur-[40px] animate-deriva-c motion-reduce:animate-none" style={{ background: `radial-gradient(circle, ${c} 0%, transparent 70%)` }} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,26,56,0)_55%,rgba(7,26,56,0.55)_100%)]" />
    </div>
  );
}

// Banda de inicio: saludo con degradado, texto, acciones y un panel al lado.
// Deja espacio abajo (pb-28) para que el contenido se monte encima con -mt-[72px].
export function BandaAurora({ tono = "desarrollo-humano", titulo, fecha, texto, acciones, lado, children }) {
  const t = TONOS[tono];
  return (
    <section className="relative overflow-hidden bg-[#071A38] text-white">
      <Manchas colores={t.manchas} />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16 pb-28 flex flex-wrap gap-10 items-end">
        <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-4">
          {fecha && <p className={`m-0 text-[15px] font-semibold ${t.fecha} ${ENTRA}`}>{fecha}</p>}
          <h1
            style={retraso(50)}
            className={`m-0 font-sans text-[44px] sm:text-[64px] lg:text-[72px] leading-[0.98] tracking-[-0.045em] font-extrabold max-w-[9em] bg-clip-text text-transparent ${t.titulo} ${ENTRA}`}
          >
            {titulo}
          </h1>
          {texto && (
            <p style={retraso(100)} className={`m-0 text-[17px] sm:text-[19px] leading-normal text-white/[0.84] max-w-[32em] ${ENTRA}`}>
              {texto}
            </p>
          )}
          {children && (
            <div style={retraso(150)} className={ENTRA}>
              {children}
            </div>
          )}
          {acciones && (
            <div style={retraso(150)} className={`flex flex-wrap gap-2.5 mt-1.5 ${ENTRA}`}>
              {acciones}
            </div>
          )}
        </div>
        {lado && (
          <div style={retraso(200)} className={`relative flex-[1_1_340px] max-w-[460px] min-w-0 ${ENTRA}`}>
            {lado}
          </div>
        )}
      </div>
    </section>
  );
}

// Panel de vidrio sobre la aurora (texto blanco).
export function PanelVidrio({ titulo, subtitulo, children }) {
  return (
    <section className="rounded-[22px] p-5 sm:p-[22px] bg-white/[0.12] border border-white/[0.28] shadow-[0_30px_60px_rgba(2,10,28,0.45)] text-white flex flex-col gap-4">
      <div>
        <h2 className="m-0 font-sans text-lg font-bold text-white">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 mb-0 text-sm text-white/75">{subtitulo}</p>}
      </div>
      {children}
    </section>
  );
}

// Cifra grande dentro del panel de vidrio.
export function CifraVidrio({ valor, texto, detalle }) {
  return (
    <div className="flex gap-4 items-center">
      <span className="shrink-0 min-w-[76px] h-[68px] px-3 rounded-2xl bg-white/[0.14] text-white font-extrabold flex items-center justify-center tabular-nums text-[30px]">{valor}</span>
      <span className="min-w-0 leading-snug">
        <strong className="block text-[17px]">{texto}</strong>
        {detalle && <span className="text-sm text-white/75">{detalle}</span>}
      </span>
    </div>
  );
}

export const botonVidrio = "self-start min-h-[44px] inline-flex items-center px-4 rounded-full bg-white text-[#071A38] font-bold text-sm no-underline hover:bg-white/90";

// Fila de indicadores que se monta sobre la banda (tarjetas blancas con sombra).
export function IndicadoresAurora({ children, demora = 220 }) {
  return (
    <section aria-label="Indicadores" style={retraso(demora)} className={`grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))] ${ENTRA}`}>
      {children}
    </section>
  );
}

export function KpiAurora({ titulo, valor, detalle }) {
  return (
    <div className="bg-white rounded-[18px] p-5 sm:p-[22px] shadow-[0_16px_40px_rgba(11,35,71,0.16)] min-w-0">
      <p className="m-0 text-sm text-ink-500">{titulo}</p>
      <p className="mt-2 mb-0 text-[38px] sm:text-[42px] leading-none font-extrabold tracking-[-0.03em] text-primary-dark tabular-nums">{valor}</p>
      {detalle && <p className="mt-2 mb-0 text-[13px] text-ink-500">{detalle}</p>}
    </div>
  );
}
