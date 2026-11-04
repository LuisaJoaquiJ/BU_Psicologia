import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, LineChart, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { CajaTip, EJE, GUIA, LINEA_EJE } from "./Base";

// Graficas del dashboard, hechas con Recharts. Reglas que siguen:
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
export function useTooltip() {
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

export function Tip({ valor, etiqueta, detalle }) {
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

// Columnas apiladas (Recharts): citas por semana y estado.
export function ColumnasSemanales({ semanas, estados = ["Atendida", "NoAsistio", "Agendada", "Cancelada"] }) {
  const datos = semanas.map((s) => ({ ...s, etiqueta: etiquetaSemana(s.semana) }));
  return (
    <div style={{ height: 240 }} role="img" aria-label="Citas por semana y estado">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 18, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GUIA} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={LINEA_EJE} interval="preserveEnd" minTickGap={10} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<CajaTip titulo={(l) => `Semana del ${l}`} total />} cursor={{ fill: "#F3F5F9" }} />
          {estados.map((e, i) => (
            <Bar key={e} dataKey={e} name={ETIQUETA_ESTADO[e]} stackId="semana" fill={COLORES_ESTADO[e]} maxBarSize={36} radius={i === estados.length - 1 ? [4, 4, 0, 0] : 0}>
              {i === estados.length - 1 && <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 600, fill: "#3D4659" }} formatter={(v) => v || ""} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
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

// Punto + bigote por categoria (p. ej. asistencia por dia de la semana) con
// Recharts: una barra de rango [bajo, alto] y el punto en la probabilidad.
export function PuntosConIntervalo({ filas }) {
  const datos = filas.map((f) => ({ ...f, rango: f.probabilidad === null ? null : [f.bajo, f.alto], punto: f.probabilidad }));
  const Tip2 = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const f = payload[0].payload;
    if (f.probabilidad === null) return null;
    return (
      <div className="bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
        <strong className="block text-sm">{formatoPct(f.probabilidad)}</strong>
        <span className="block text-white/75">Asistencia los {f.dia}</span>
        <span className="block text-white/60">
          IC 95 %: {formatoPct(f.bajo)} – {formatoPct(f.alto)} · {f.n} citas
        </span>
      </div>
    );
  };
  return (
    <div style={{ height: filas.length * 36 + 30 }} role="img" aria-label="Asistencia por día con su intervalo de confianza">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GUIA} />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={EJE} tickFormatter={(v) => `${v} %`} axisLine={LINEA_EJE} tickLine={false} />
          <YAxis type="category" dataKey="dia" width={44} tick={{ fontSize: 13, fontWeight: 600, fill: "#3D4659" }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip2 />} cursor={{ fill: "#F3F5F9" }} />
          <Bar dataKey="rango" fill="#0d9488" fillOpacity={0.35} barSize={4} radius={2} isAnimationActive={false} />
          <Scatter dataKey="punto" fill="#0d9488" stroke="#fff" strokeWidth={2} shape={(p) => (p.cx && p.cy ? <circle cx={p.cx} cy={p.cy} r={7} fill="#0d9488" stroke="#fff" strokeWidth={2} /> : <g />)}>
            <LabelList dataKey="punto" position="right" offset={60} formatter={(v) => (v === null ? "sin datos" : formatoPct(v))} style={{ fontSize: 13, fontWeight: 600, fill: "#0E1726" }} />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
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

// Minigrafica de linea para las tarjetas de indicadores (Recharts).
export function Sparkline({ valores, color = "#E8B23A" }) {
  if (!valores.length) return null;
  const datos = valores.map((v, i) => ({ i, v }));
  const ultimo = datos.length - 1;
  return (
    <LineChart width={120} height={32} data={datos} margin={{ top: 4, right: 4, bottom: 2, left: 0 }} aria-hidden="true">
      <YAxis hide domain={[0, "dataMax"]} />
      <Line
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={2}
        isAnimationActive={false}
        dot={(p) => (p.index === ultimo ? <circle key="ultimo" cx={p.cx} cy={p.cy} r={3} fill={color} /> : <g key={p.index} />)}
      />
    </LineChart>
  );
}

// Barra apilada horizontal (asistencia por evento / citas por servicio), con
// Recharts. Su largo es proporcional al total frente al maximo de la lista.
export function BarraApilada({ partes, maximo, etiqueta }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  if (!total) return <div className="h-3 rounded-[4px] bg-gray-100" />;
  const fila = Object.fromEntries(partes.map((p) => [p.clave, p.valor]));
  const visibles = partes.filter((p) => p.valor > 0);
  return (
    <div style={{ width: `${maximo ? Math.max((total / maximo) * 100, 4) : 0}%`, height: 12 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[{ etiqueta, ...fila }]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" dataKey="etiqueta" hide />
          <Tooltip content={<CajaTip />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 20 }} />
          {visibles.map((p, i) => (
            <Bar
              key={p.clave}
              dataKey={p.clave}
              name={p.etiqueta}
              stackId="b"
              fill={p.color}
              isAnimationActive={false}
              radius={visibles.length === 1 ? 4 : i === 0 ? [4, 0, 0, 4] : i === visibles.length - 1 ? [0, 4, 4, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
