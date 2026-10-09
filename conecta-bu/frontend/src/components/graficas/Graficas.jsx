import { useState } from "react";

// Graficas del dashboard (SVG/HTML a mano, sin librerias). Reglas que siguen:
// - Colores por significado, validados para daltonismo; el gris neutro siempre
//   va acompañado de su numero.
// - Cada barra/celda muestra su valor al pasar el mouse o con el teclado (Tab).
// - Leyenda siempre visible cuando hay mas de una serie.

export const COLORES_ESTADO = {
  Agendada: "#163F86",
  Atendida: "#0d9488",
  NoAsistio: "#d97706",
  Cancelada: "#CBD2DE",
};
export const ETIQUETA_ESTADO = {
  Agendada: "Agendadas",
  Atendida: "Atendidas",
  NoAsistio: "No asistieron",
  Cancelada: "Canceladas",
};

export function formatoPct(valor) {
  return valor === null || valor === undefined ? "—" : `${valor.toLocaleString("es-CO")} %`;
}

export function Leyenda({ series }) {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-ink-600">
      {series.map(({ clave, etiqueta, color }) => (
        <span key={clave} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
          {etiqueta}
        </span>
      ))}
    </div>
  );
}

// Tooltip flotante dentro del contenedor relativo de cada grafica.
function useTooltip() {
  const [tip, setTip] = useState(null);
  const mostrar = (evento, contenido) => {
    const caja = evento.currentTarget.closest("[data-grafica]").getBoundingClientRect();
    const marca = evento.currentTarget.getBoundingClientRect();
    setTip({ x: marca.left - caja.left + marca.width / 2, y: marca.top - caja.top, contenido });
  };
  const ocultar = () => setTip(null);
  const nodo = tip ? (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-2 bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      {tip.contenido}
    </div>
  ) : null;
  return { mostrar, ocultar, nodo };
}

function Tip({ valor, etiqueta, detalle }) {
  return (
    <span className="flex flex-col">
      <strong className="text-sm">{valor}</strong>
      <span className="text-white/75">{etiqueta}</span>
      {detalle && <span className="text-white/60">{detalle}</span>}
    </span>
  );
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaSemana(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
}

// Columnas apiladas: citas por semana y estado.
export function ColumnasSemanales({ semanas, estados = ["Atendida", "NoAsistio", "Agendada", "Cancelada"] }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const maximo = Math.max(1, ...semanas.map((s) => s.total));
  const altura = 200;
  const hoy = new Date();
  return (
    <div data-grafica className="relative">
      {nodo}
      <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height: altura + 28 }}>
        {semanas.map((s) => {
          const esActual = hoy >= new Date(`${s.semana}T00:00:00Z`) && hoy < new Date(new Date(`${s.semana}T00:00:00Z`).getTime() + 7 * 864e5);
          return (
            <div key={s.semana} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
              <span className="text-[11px] font-semibold text-ink-600 tabular-nums mb-1">{s.total || ""}</span>
              <div className="w-full max-w-[36px] flex flex-col-reverse gap-[2px]" style={{ height: (s.total / maximo) * altura }}>
                {estados.map((e) =>
                  s[e] > 0 ? (
                    <button
                      key={e}
                      type="button"
                      aria-label={`Semana del ${etiquetaSemana(s.semana)}: ${s[e]} ${ETIQUETA_ESTADO[e].toLowerCase()}`}
                      onMouseEnter={(ev) => mostrar(ev, <Tip valor={s[e]} etiqueta={ETIQUETA_ESTADO[e]} detalle={`Semana del ${etiquetaSemana(s.semana)}`} />)}
                      onFocus={(ev) => mostrar(ev, <Tip valor={s[e]} etiqueta={ETIQUETA_ESTADO[e]} detalle={`Semana del ${etiquetaSemana(s.semana)}`} />)}
                      onMouseLeave={ocultar}
                      onBlur={ocultar}
                      className="w-full first:rounded-b-[4px] last:rounded-t-[4px] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-gold"
                      style={{ flexGrow: s[e], background: COLORES_ESTADO[e] }}
                    />
                  ) : null
                )}
              </div>
              <span
                className={`mt-1.5 text-[10px] sm:text-[11px] whitespace-nowrap ${esActual ? "font-bold text-primary" : "text-ink-500"} ${
                  semanas.length > 8 && !esActual && semanas.indexOf(s) % 2 ? "invisible sm:visible" : ""
                }`}
              >
                {etiquetaSemana(s.semana)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Probabilidad con su intervalo de confianza al 95 %.
export function Probabilidad({ titulo, dato, colorPunto = "#0B2A5B", descripcion }) {
  const vacio = dato?.probabilidad === null || dato?.probabilidad === undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-ink-900">{titulo}</span>
        <span className="font-display text-2xl font-semibold text-primary tabular-nums">{formatoPct(dato?.probabilidad)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-gray-100" aria-hidden="true">
        {!vacio && (
          <>
            <div
              className="absolute top-0 h-3 rounded-full"
              style={{ left: `${dato.bajo}%`, width: `${Math.max(dato.alto - dato.bajo, 1)}%`, background: `${colorPunto}33` }}
            />
            <div
              className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{ left: `${dato.probabilidad}%`, background: colorPunto }}
            />
          </>
        )}
      </div>
      <span className="text-xs text-ink-500">
        {vacio
          ? "Aún no hay datos suficientes."
          : `Entre ${formatoPct(dato.bajo)} y ${formatoPct(dato.alto)} con 95 % de confianza · ${dato.n} registros`}
        {descripcion ? ` · ${descripcion}` : ""}
      </span>
    </div>
  );
}

// Punto + bigote por categoria (p. ej. asistencia por dia de la semana).
export function PuntosConIntervalo({ filas }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  return (
    <div data-grafica className="relative flex flex-col gap-3">
      {nodo}
      {filas.map((f) => (
        <div key={f.dia} className="grid grid-cols-[40px_1fr_64px] items-center gap-3">
          <span className="text-sm font-semibold text-ink-600">{f.dia}</span>
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200" aria-hidden="true" />
            {[25, 50, 75].map((m) => (
              <div key={m} className="absolute top-1 bottom-1 w-px bg-gray-100" style={{ left: `${m}%` }} aria-hidden="true" />
            ))}
            {f.probabilidad !== null && (
              <button
                type="button"
                aria-label={`${f.dia}: ${formatoPct(f.probabilidad)} de asistencia, entre ${formatoPct(f.bajo)} y ${formatoPct(f.alto)}, ${f.n} citas`}
                onMouseEnter={(ev) => mostrar(ev, <Tip valor={formatoPct(f.probabilidad)} etiqueta={`Asistencia los ${f.dia}`} detalle={`IC 95 %: ${formatoPct(f.bajo)} – ${formatoPct(f.alto)} · ${f.n} citas`} />)}
                onFocus={(ev) => mostrar(ev, <Tip valor={formatoPct(f.probabilidad)} etiqueta={`Asistencia los ${f.dia}`} detalle={`IC 95 %: ${formatoPct(f.bajo)} – ${formatoPct(f.alto)} · ${f.n} citas`} />)}
                onMouseLeave={ocultar}
                onBlur={ocultar}
                className="absolute inset-y-0 focus:outline-none group"
                style={{ left: `${f.bajo}%`, width: `${Math.max(f.alto - f.bajo, 2)}%` }}
              >
                <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#0d9488]/40" />
                <span
                  className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0d9488] border-2 border-white group-focus:ring-2 group-focus:ring-gold"
                  style={{ left: `${((f.probabilidad - f.bajo) / Math.max(f.alto - f.bajo, 2)) * 100}%` }}
                />
              </button>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums text-right text-ink-900">
            {f.probabilidad === null ? <span className="text-ink-500 font-normal text-xs">sin datos</span> : formatoPct(f.probabilidad)}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[40px_1fr_64px] gap-3 text-[10px] text-ink-500" aria-hidden="true">
        <span />
        <div className="flex justify-between"><span>0 %</span><span>50 %</span><span>100 %</span></div>
        <span />
      </div>
    </div>
  );
}

// Mapa de calor: dias x horas, un solo tono (de claro a azul marino).
export function MapaCalor({ mapa }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const color = (v) => {
    if (!v) return "#F3EDE0";
    const t = 0.18 + 0.82 * (v / Math.max(mapa.maximo, 1));
    const mezcla = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${mezcla(214, 11)}, ${mezcla(224, 42)}, ${mezcla(242, 91)})`;
  };
  return (
    <div data-grafica className="relative">
      {nodo}
      <div className="overflow-x-auto pb-1">
      <div className="inline-grid gap-[3px] min-w-full" style={{ gridTemplateColumns: `40px repeat(${mapa.horas.length}, minmax(28px, 1fr))` }}>
        <span />
        {mapa.horas.map((h) => (
          <span key={h} className="text-[10px] text-ink-500 text-center">{h}h</span>
        ))}
        {mapa.dias.map((dia, i) => (
          <div key={dia} className="contents">
            <span className="text-xs font-semibold text-ink-600 self-center">{dia}</span>
            {mapa.celdas[i].map((v, j) => (
              <button
                key={j}
                type="button"
                aria-label={`${dia} ${mapa.horas[j]}:00 — ${v} citas`}
                onMouseEnter={(ev) => mostrar(ev, <Tip valor={`${v} citas`} etiqueta={`${dia} · ${mapa.horas[j]}:00`} />)}
                onFocus={(ev) => mostrar(ev, <Tip valor={`${v} citas`} etiqueta={`${dia} · ${mapa.horas[j]}:00`} />)}
                onMouseLeave={ocultar}
                onBlur={ocultar}
                className="h-8 rounded-[4px] text-[11px] font-semibold tabular-nums hover:ring-2 hover:ring-gold focus:outline-none focus:ring-2 focus:ring-gold"
                style={{ background: color(v), color: v / Math.max(mapa.maximo, 1) > 0.5 ? "#FFFFFF" : "#0E1726" }}
              >
                {v || ""}
              </button>
            ))}
          </div>
        ))}
      </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px] text-ink-500" aria-hidden="true">
        <span>Menos</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="w-5 h-3 rounded-sm" style={{ background: t === 0 ? "#F3EDE0" : color(Math.max(1, Math.round(t * mapa.maximo))) }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

// Minigrafica de linea para las tarjetas de indicadores.
export function Sparkline({ valores, color = "#E8B23A" }) {
  if (!valores.length) return null;
  const ancho = 120;
  const alto = 32;
  const max = Math.max(1, ...valores);
  const puntos = valores.map((v, i) => `${(i / Math.max(valores.length - 1, 1)) * ancho},${alto - (v / max) * (alto - 4) - 2}`);
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true" className="overflow-visible">
      <polyline points={puntos.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={puntos.at(-1).split(",")[0]} cy={puntos.at(-1).split(",")[1]} r="3" fill={color} />
    </svg>
  );
}

// Barra apilada horizontal (asistencia por evento / citas por servicio).
export function BarraApilada({ partes, maximo, etiqueta }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div data-grafica className="relative">
      {nodo}
      <div className="flex gap-[2px] h-3" style={{ width: `${maximo ? Math.max((total / maximo) * 100, total ? 4 : 0) : 0}%` }}>
        {partes.map((p) =>
          p.valor > 0 ? (
            <button
              key={p.clave}
              type="button"
              aria-label={`${etiqueta}: ${p.valor} ${p.etiqueta.toLowerCase()}`}
              onMouseEnter={(ev) => mostrar(ev, <Tip valor={p.valor} etiqueta={p.etiqueta} detalle={etiqueta} />)}
              onFocus={(ev) => mostrar(ev, <Tip valor={p.valor} etiqueta={p.etiqueta} detalle={etiqueta} />)}
              onMouseLeave={ocultar}
              onBlur={ocultar}
              className="h-full first:rounded-l-[4px] last:rounded-r-[4px] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-gold"
              style={{ flexGrow: p.valor, background: p.color }}
            />
          ) : null
        )}
      </div>
      {total === 0 && <div className="h-3 rounded-[4px] bg-gray-100 -mt-3" />}
    </div>
  );
}
