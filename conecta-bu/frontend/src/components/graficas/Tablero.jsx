import { useEffect, useRef, useState } from "react";
import { Tip, useTooltip } from "./Graficas";

// Graficas del tablero del superadministrador (SVG/HTML a mano, sin
// librerias). Reglas:
// - Un color por modulo, siempre el mismo (validado para daltonismo, todas
//   las parejas). Los textos nunca van del color de la serie.
// - Barras de maximo 24 px, borde redondeado de 4 px en el extremo del dato,
//   2 px de separacion entre segmentos; lineas de 2 px.
// - Cada marca muestra su valor al pasar el mouse o con Tab, y cada tarjeta
//   tiene su tabla de datos ("Ver los datos").

export const COLOR_MODULO = {
  "desarrollo-humano": "#2a78d6",
  salud: "#1baf7a",
  deporte: "#eb6834",
};
export const NOMBRE_MODULO = {
  "desarrollo-humano": "Desarrollo Humano",
  salud: "Salud Integral",
  deporte: "Deporte y Recreación",
};
export const SERIES_MODULOS = Object.keys(COLOR_MODULO).map((clave) => ({ clave, etiqueta: NOMBRE_MODULO[clave], color: COLOR_MODULO[clave] }));

// Escala ordinal azul (de menos a mas): nunca mas clara que el paso 250.
export const AZUL_ORDINAL = ["#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];

const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO"));

function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(640);
  useEffect(() => {
    if (!ref.current) return undefined;
    const obs = new ResizeObserver(([e]) => setAncho(Math.max(260, Math.floor(e.contentRect.width))));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
}

// Marcas "redondas" de escala: 0, 5, 10, 20, 50, 100...
function escala(maximo, pasos = 4) {
  if (maximo <= 0) return { tope: 4, marcas: [0, 1, 2, 3, 4] };
  const crudo = maximo / pasos;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= crudo) || 10 * potencia;
  const tope = Math.ceil(maximo / paso) * paso;
  const marcas = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(Math.round(v * 100) / 100);
  return { tope, marcas };
}

export function Leyenda({ series, forma = "barra" }) {
  return (
    <ul className="list-none m-0 p-0 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[13px] text-ink-600">
      {series.map(({ clave, etiqueta, color }) => (
        <li key={clave} className="flex items-center gap-1.5">
          {forma === "linea" ? (
            <span className="w-4 h-[3px] rounded-full" style={{ background: color }} />
          ) : (
            <span className="w-3 h-3 rounded-[3px]" style={{ background: color }} />
          )}
          {etiqueta}
        </li>
      ))}
    </ul>
  );
}

// Lineas por mes, una por modulo, con linea guia y lectura de todas las
// series en el mes señalado.
export function LineasMensuales({ datos, series, alto = 260 }) {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const margen = { izq: 40, der: 96, arr: 12, aba: 28 };
  const w = ancho - margen.izq - margen.der;
  const h = alto - margen.arr - margen.aba;
  const max = Math.max(0, ...datos.flatMap((d) => series.map((s) => d[s.clave] || 0)));
  const { tope, marcas } = escala(max);
  const x = (i) => margen.izq + (datos.length === 1 ? w / 2 : (i / (datos.length - 1)) * w);
  const y = (v) => margen.arr + h - (v / tope) * h;
  const paso = datos.length > 1 ? w / (datos.length - 1) : w;

  // Etiquetas al final de cada linea, solo si no se pisan (si no, la leyenda basta).
  const finales = series
    .map((s) => ({ ...s, valor: datos.at(-1)?.[s.clave] || 0 }))
    .map((s) => ({ ...s, y: y(s.valor) }))
    .sort((a, b) => a.y - b.y);
  const visibles = finales.filter((s, i) => i === 0 || s.y - finales[i - 1].y >= 16);

  const tip = activo !== null ? datos[activo] : null;
  return (
    <div ref={ref} className="relative">
      <svg width={ancho} height={alto} role="img" aria-label="Participaciones por mes y módulo" className="block overflow-visible">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izq} x2={margen.izq + w} y1={y(m)} y2={y(m)} stroke={m === 0 ? "#C3C9D4" : "#E8ECF2"} strokeWidth="1" />
            <text x={margen.izq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-[#6B7385] text-[11px] tabular-nums">
              {fmt(m)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          // Si no caben todos los meses, se muestra uno de cada N (siempre el ultimo).
          const cada = Math.ceil(52 / Math.max(paso, 1));
          if (activo !== i && i !== datos.length - 1 && (datos.length - 1 - i) % cada !== 0) return null;
          return (
          <text key={d.mes} x={x(i)} y={alto - 8} textAnchor="middle" className={`text-[11px] ${activo === i ? "fill-[#0E1726] font-bold" : "fill-[#6B7385]"}`}>
            {d.etiqueta}
          </text>
          );
        })}
        {activo !== null && <line x1={x(activo)} x2={x(activo)} y1={margen.arr} y2={margen.arr + h} stroke="#9AA3B5" strokeWidth="1" />}
        {series.map((s) => (
          <polyline
            key={s.clave}
            points={datos.map((d, i) => `${x(i)},${y(d[s.clave] || 0)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((s) =>
          datos.map((d, i) =>
            i === datos.length - 1 || i === activo ? (
              <circle key={`${s.clave}-${i}`} cx={x(i)} cy={y(d[s.clave] || 0)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />
            ) : null
          )
        )}
        {visibles.map((s) => (
          <text key={s.clave} x={margen.izq + w + 10} y={s.y} dy="0.32em" className="fill-[#3D4659] text-[12px] font-semibold tabular-nums">
            {fmt(s.valor)} · {s.etiqueta.split(" ")[0]}
          </text>
        ))}
        {datos.map((d, i) => (
          <rect
            key={`hit-${d.mes}`}
            x={x(i) - paso / 2}
            y={margen.arr}
            width={paso}
            height={h}
            fill="transparent"
            tabIndex={0}
            aria-label={`${d.etiqueta}: ${series.map((s) => `${s.etiqueta} ${fmt(d[s.clave] || 0)}`).join(", ")}`}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onBlur={() => setActivo(null)}
            className="outline-none focus:stroke-[#0B2347]"
          />
        ))}
      </svg>
      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 top-1 bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          style={{ left: Math.min(Math.max(x(activo) - 70, 0), ancho - 170) }}
        >
          <p className="m-0 mb-1 font-bold">{tip.etiqueta}</p>
          {series.map((s) => (
            <p key={s.clave} className="m-0 flex items-center gap-2">
              <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
              <strong className="text-sm tabular-nums">{fmt(tip[s.clave] || 0)}</strong>
              <span className="text-white/70">{s.etiqueta}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Barras horizontales de una sola serie, con el valor en la punta.
export function BarrasH({ filas, color = "#2a78d6", colores, formato = fmt, unidad = "", vacio = "Sin datos en este rango." }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const max = Math.max(1, ...filas.map((f) => f.total));
  if (!filas.length || filas.every((f) => !f.total)) return <p className="m-0 text-sm text-ink-500">{vacio}</p>;
  return (
    <div data-grafica className="relative">
      {nodo}
      <ul className="list-none m-0 p-0 flex flex-col gap-3">
        {filas.map((f) => (
          <li key={f.id}>
            <p className="m-0 mb-1 text-[13px] text-ink-700 truncate" title={f.nombre}>
              {f.nombre}
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label={`${f.nombre}: ${formato(f.total)}${unidad}`}
                onMouseEnter={(ev) => mostrar(ev, <Tip valor={`${formato(f.total)}${unidad}`} etiqueta={f.nombre} />)}
                onFocus={(ev) => mostrar(ev, <Tip valor={`${formato(f.total)}${unidad}`} etiqueta={f.nombre} />)}
                onMouseLeave={ocultar}
                onBlur={ocultar}
                className="h-[18px] rounded-r-[4px] hover:brightness-110 shrink-0"
                style={{ width: `calc(${(f.total / max) * 100}% - 56px)`, minWidth: f.total ? 4 : 0, background: colores?.[f.id] || color }}
              />
              <span className="text-[13px] font-bold text-ink-900 tabular-nums whitespace-nowrap">
                {formato(f.total)}
                {unidad}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Una barra apilada por fila (p. ej. citas por estado en cada modulo), en la
// misma escala para poder comparar filas.
export function FilasApiladas({ filas, partes }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const total = (f) => partes.reduce((s, p) => s + (f.valores[p.clave] || 0), 0);
  const max = Math.max(1, ...filas.map(total));
  return (
    <div data-grafica className="relative flex flex-col gap-4">
      {nodo}
      {filas.map((f) => {
        const t = total(f);
        return (
          <div key={f.id}>
            <div className="flex justify-between items-baseline gap-3 mb-1.5">
              <span className="text-sm font-bold text-ink-900">{f.nombre}</span>
              <span className="text-[13px] text-ink-500 tabular-nums">{f.detalle ?? `${fmt(t)} en total`}</span>
            </div>
            {t === 0 ? (
              <div className="h-[22px] rounded-[4px] bg-gray-100 flex items-center px-2 text-xs text-ink-500">Sin registros</div>
            ) : (
              <div className="flex gap-[2px] h-[22px]" style={{ width: `${(t / max) * 100}%`, minWidth: 8 }}>
                {partes.map((p) =>
                  f.valores[p.clave] > 0 ? (
                    <button
                      key={p.clave}
                      type="button"
                      aria-label={`${f.nombre}: ${f.valores[p.clave]} ${p.etiqueta.toLowerCase()}`}
                      onMouseEnter={(ev) => mostrar(ev, <Tip valor={fmt(f.valores[p.clave])} etiqueta={p.etiqueta} detalle={f.nombre} />)}
                      onFocus={(ev) => mostrar(ev, <Tip valor={fmt(f.valores[p.clave])} etiqueta={p.etiqueta} detalle={f.nombre} />)}
                      onMouseLeave={ocultar}
                      onBlur={ocultar}
                      className="h-full first:rounded-l-[4px] last:rounded-r-[4px] hover:brightness-110"
                      style={{ flexGrow: f.valores[p.clave], background: p.color }}
                    />
                  ) : null
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Columnas verticales (una serie), con el valor sobre cada columna.
export function Columnas({ filas, colores, color = "#2a78d6", alto = 180, formato = fmt }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <div data-grafica className="relative">
      {nodo}
      <div className="flex items-end gap-3 border-b border-[#C3C9D4]" style={{ height: alto + 22 }}>
        {filas.map((f, i) => (
          <div key={f.id} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
            <span className="text-[12px] font-bold text-ink-900 tabular-nums mb-1">{formato(f.total)}</span>
            <button
              type="button"
              aria-label={`${f.nombre}: ${formato(f.total)}`}
              onMouseEnter={(ev) => mostrar(ev, <Tip valor={formato(f.total)} etiqueta={f.nombre} />)}
              onFocus={(ev) => mostrar(ev, <Tip valor={formato(f.total)} etiqueta={f.nombre} />)}
              onMouseLeave={ocultar}
              onBlur={ocultar}
              className="w-full max-w-[24px] rounded-t-[4px] hover:brightness-110"
              style={{ height: Math.max((f.total / max) * alto, f.total ? 3 : 0), background: colores?.[i] || color }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-1.5">
        {filas.map((f) => (
          <span key={f.id} className="flex-1 min-w-0 text-center text-[11px] leading-tight text-ink-500">
            {f.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

// Tabla con los mismos datos de la grafica (accesible sin mouse ni color).
export function VerDatos({ columnas, filas }) {
  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-[13px] font-bold text-primary-soft py-1.5 select-none">Ver los datos</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-[13px] tabular-nums border-collapse">
          <thead>
            <tr className="text-left text-ink-500">
              {columnas.map((c, i) => (
                <th key={c} className={`font-semibold py-1.5 pr-3 border-b border-gray-200 ${i ? "text-right" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {f.map((v, j) => (
                  <td key={j} className={`py-1.5 pr-3 border-b border-gray-100 ${j ? "text-right" : "text-ink-900"}`}>
                    {typeof v === "number" ? fmt(v) : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
