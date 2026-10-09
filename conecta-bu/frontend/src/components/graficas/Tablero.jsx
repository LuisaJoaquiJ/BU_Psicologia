import { useEffect, useRef, useState } from "react";
import { Tip, useTooltip } from "./Graficas";
import { Icono as IconoBase } from "../Iconos";

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

// ---------------------------------------------------------------------------
// Piezas del tablero de lectura rapida (inicio de Estadisticas).

export const PERIODOS = [
  { id: "semana", texto: "Semana" },
  { id: "mes", texto: "Mes" },
  { id: "trimestre", texto: "Trimestre" },
  { id: "anio", texto: "Año" },
];

export function SelectorPeriodo({ valor, onCambio }) {
  return (
    <div role="group" aria-label="Periodo" className="inline-flex bg-white border border-gray-200 rounded-full p-1 gap-1">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={valor === p.id}
          onClick={() => onCambio(p.id)}
          className={`min-h-[40px] px-4 sm:px-5 rounded-full text-sm font-bold transition-colors ${
            valor === p.id ? "bg-primary-dark text-white" : "text-primary hover:bg-primary-light"
          }`}
        >
          {p.texto}
        </button>
      ))}
    </div>
  );
}

// Tonos de las fichas de icono (fondo claro + icono oscuro del mismo tono).
const TONOS = {
  azul: "bg-[#E3EEFB] text-[#1C5CAB]",
  verde: "bg-[#DDF3EA] text-[#0E6B4A]",
  naranja: "bg-[#FDE8DE] text-[#A8431B]",
  cian: "bg-[#E4FAFF] text-[#0E5F73]",
  morado: "bg-[#ECE9FB] text-[#4A3AA7]",
  gris: "bg-gray-100 text-ink-600",
};
const LINEA_TONO = { azul: "#2a78d6", verde: "#1baf7a", naranja: "#eb6834", cian: "#0E7C93", morado: "#4a3aa7", gris: "#6B7385" };

function Minilinea({ valores, color }) {
  const v = valores.map((x) => (x === null || x === undefined ? null : x));
  const nums = v.filter((x) => x !== null);
  if (nums.length < 2) return null;
  const ancho = 96;
  const alto = 34;
  const max = Math.max(1, ...nums);
  const pts = v.map((x, i) => (x === null ? null : [(i / (v.length - 1)) * ancho, alto - 3 - (x / max) * (alto - 6)])).filter(Boolean);
  const linea = pts.map((p) => p.join(",")).join(" ");
  const area = `0,${alto} ${linea} ${ancho},${alto}`;
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true" className="overflow-visible shrink-0">
      <polygon points={area} fill={color} opacity="0.1" />
      <polyline points={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)[0]} cy={pts.at(-1)[1]} r="3.5" fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

// Cambio frente al periodo anterior: flecha + texto (nunca solo color).
function Cambio({ variacion, puntos, subirEsBueno = true, textoAnterior }) {
  const valor = puntos !== undefined ? puntos : variacion;
  let tono = "text-ink-500 bg-gray-100";
  let flecha = "→";
  let texto;
  if (valor === null || valor === undefined) {
    texto = "Sin datos para comparar";
  } else if (valor === 0) {
    texto = "Igual";
  } else {
    const sube = valor > 0;
    flecha = sube ? "↑" : "↓";
    const bueno = subirEsBueno === null ? null : sube === subirEsBueno;
    tono = bueno === null ? "text-ink-600 bg-gray-100" : bueno ? "text-[#0B6B2E] bg-[#E3F5E9]" : "text-[#A32020] bg-[#FDECEC]";
    texto = puntos !== undefined ? `${Math.abs(valor).toLocaleString("es-CO")} pts` : `${Math.abs(valor).toLocaleString("es-CO")} %`;
  }
  return (
    <p className="m-0 flex items-center gap-1.5 flex-wrap text-xs">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold ${tono}`}>
        {valor !== null && valor !== undefined && valor !== 0 && <span aria-hidden="true">{flecha}</span>}
        {texto}
      </span>
      {valor !== null && valor !== undefined && <span className="text-ink-500">vs. {textoAnterior}</span>}
    </p>
  );
}

export function TarjetaKpi({ icono, tono = "azul", titulo, valor, unidad = "", variacion, puntos, subirEsBueno, textoAnterior, serie, a }) {
  const Icono = IconoBase;
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${TONOS[tono]}`}>{Icono && <Icono nombre={icono} size={22} strokeWidth={2} />}</span>
        {serie && (
          <span className="hidden sm:block">
            <Minilinea valores={serie} color={LINEA_TONO[tono]} />
          </span>
        )}
      </div>
      <p className="mt-3 mb-0 text-[13px] font-semibold text-ink-500">{titulo}</p>
      <p className="m-0 text-[26px] sm:text-[32px] leading-tight font-extrabold text-primary-dark">
        {valor === null || valor === undefined ? "—" : Number(valor).toLocaleString("es-CO")}
        {valor !== null && valor !== undefined && unidad && <span className="text-xl font-bold text-ink-600"> {unidad}</span>}
      </p>
      <div className="mt-2">
        <Cambio variacion={variacion} puntos={puntos} subirEsBueno={subirEsBueno} textoAnterior={textoAnterior} />
      </div>
    </>
  );
  const clase = "bg-white border border-gray-200 rounded-[22px] p-4 sm:p-5 min-w-0 flex flex-col";
  return a ? (
    <a href={a} className={`${clase} hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(11,35,71,0.08)] transition-shadow`}>
      {cuerpo}
    </a>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

// Dona (parte de un todo, pocas categorias): cifra principal en el centro y
// leyenda con cantidad y porcentaje de cada parte.
export function Dona({ partes, centro, etiquetaCentro, tamano = 200 }) {
  const { mostrar, ocultar, nodo } = useTooltip();
  const total = partes.reduce((s, p) => s + (p.valor || 0), 0);
  const r = tamano / 2 - 14;
  const c = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <div data-grafica className="relative flex flex-col sm:flex-row items-center gap-6">
      {nodo}
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
        <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} className="-rotate-90" role="img" aria-label={etiquetaCentro}>
          <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth="22" />
          {total > 0 &&
            partes.map((p) => {
              if (!p.valor) return null;
              const largo = (p.valor / total) * c;
              const trazo = Math.max(largo - (partes.filter((x) => x.valor).length > 1 ? 3 : 0), 1);
              const el = (
                <circle
                  key={p.clave}
                  cx={tamano / 2}
                  cy={tamano / 2}
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="22"
                  strokeDasharray={`${trazo} ${c - trazo}`}
                  strokeDashoffset={-acumulado}
                  tabIndex={0}
                  aria-label={`${p.etiqueta}: ${p.valor}`}
                  onMouseEnter={(ev) => mostrar(ev, <Tip valor={`${fmt(p.valor)} · ${Math.round((p.valor / total) * 100)} %`} etiqueta={p.etiqueta} />)}
                  onFocus={(ev) => mostrar(ev, <Tip valor={`${fmt(p.valor)} · ${Math.round((p.valor / total) * 100)} %`} etiqueta={p.etiqueta} />)}
                  onMouseLeave={ocultar}
                  onBlur={ocultar}
                  className="outline-none hover:opacity-85 cursor-default"
                />
              );
              acumulado += largo;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[34px] leading-none font-extrabold text-primary-dark">{centro}</span>
          <span className="mt-1 text-xs text-ink-500 max-w-[110px] leading-tight">{etiquetaCentro}</span>
        </div>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-2.5 w-full min-w-0">
        {partes.map((p) => (
          <li key={p.clave} className="flex items-center gap-2.5 text-sm">
            <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: p.color }} />
            <span className="flex-1 min-w-0 text-ink-700">{p.etiqueta}</span>
            <strong className="text-ink-900 tabular-nums">{fmt(p.valor || 0)}</strong>
            <span className="w-11 text-right text-ink-500 tabular-nums">{total ? `${Math.round(((p.valor || 0) / total) * 100)} %` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Columnas apiladas por cubeta (dia, semana o mes), con eje y lectura al pasar.
export function ColumnasApiladas({ datos, partes, alto = 240 }) {
  const [ref, ancho] = useAncho();
  const [activo, setActivo] = useState(null);
  const margen = { izq: 36, der: 8, arr: 10, aba: 26 };
  const w = ancho - margen.izq - margen.der;
  const h = alto - margen.arr - margen.aba;
  const totales = datos.map((d) => partes.reduce((s, p) => s + (d[p.clave] || 0), 0));
  const { tope, marcas } = escala(Math.max(0, ...totales));
  const banda = w / Math.max(datos.length, 1);
  const grosor = Math.max(3, Math.min(24, banda * 0.6));
  const y = (v) => margen.arr + h - (v / tope) * h;
  const cada = Math.ceil(46 / Math.max(banda, 1));
  const tip = activo !== null ? datos[activo] : null;
  return (
    <div ref={ref} className="relative">
      <svg width={ancho} height={alto} role="img" aria-label="Columnas por periodo" className="block">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margen.izq} x2={margen.izq + w} y1={y(m)} y2={y(m)} stroke={m === 0 ? "#C3C9D4" : "#E8ECF2"} strokeWidth="1" />
            <text x={margen.izq - 8} y={y(m)} dy="0.32em" textAnchor="end" className="fill-[#6B7385] text-[11px] tabular-nums">
              {fmt(m)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = margen.izq + i * banda + (banda - grosor) / 2;
          let base = 0;
          const visibles = partes.filter((p) => d[p.clave] > 0);
          return (
            <g key={d.clave || d.mes} opacity={activo === null || activo === i ? 1 : 0.45}>
              {visibles.map((p, j) => {
                const v = d[p.clave];
                const y1 = y(base + v);
                const alt = Math.max(y(base) - y1 - (j < visibles.length - 1 ? 2 : 0), 1);
                base += v;
                const ultimo = j === visibles.length - 1;
                return ultimo ? (
                  <path
                    key={p.clave}
                    d={`M${x},${y1 + alt} V${y1 + Math.min(4, alt)} Q${x},${y1} ${x + Math.min(4, grosor / 2)},${y1} H${x + grosor - Math.min(4, grosor / 2)} Q${x + grosor},${y1} ${x + grosor},${y1 + Math.min(4, alt)} V${y1 + alt} Z`}
                    fill={p.color}
                  />
                ) : (
                  <rect key={p.clave} x={x} y={y1 + 2} width={grosor} height={alt} fill={p.color} />
                );
              })}
            </g>
          );
        })}
        {datos.map((d, i) =>
          i === activo || i === datos.length - 1 || (datos.length - 1 - i) % cada === 0 ? (
            <text key={`e-${i}`} x={margen.izq + i * banda + banda / 2} y={alto - 8} textAnchor="middle" className={`text-[11px] ${activo === i ? "fill-[#0E1726] font-bold" : "fill-[#6B7385]"}`}>
              {d.etiqueta}
            </text>
          ) : null
        )}
        {datos.map((d, i) => (
          <rect
            key={`hit-${i}`}
            x={margen.izq + i * banda}
            y={margen.arr}
            width={banda}
            height={h}
            fill="transparent"
            tabIndex={0}
            aria-label={`${d.etiqueta}: ${partes.map((p) => `${p.etiqueta} ${fmt(d[p.clave] || 0)}`).join(", ")}`}
            onMouseEnter={() => setActivo(i)}
            onFocus={() => setActivo(i)}
            onMouseLeave={() => setActivo(null)}
            onBlur={() => setActivo(null)}
            className="outline-none"
          />
        ))}
      </svg>
      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 top-0 bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          style={{ left: Math.min(Math.max(margen.izq + activo * banda + banda / 2 - 80, 0), ancho - 180) }}
        >
          <p className="m-0 mb-1 font-bold">
            {tip.etiqueta} · {fmt(totales[activo])} en total
          </p>
          {partes.map((p) => (
            <p key={p.clave} className="m-0 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: p.color }} />
              <strong className="text-sm tabular-nums">{fmt(tip[p.clave] || 0)}</strong>
              <span className="text-white/70">{p.etiqueta}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Calendario del mes con la actividad de cada dia (mas oscuro = mas actividad).
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const RAMPA = ["#E3EEFB", "#B7D3F6", "#6DA7EC", "#2A78D6", "#184F95"];

export function CalendarioActividad({ mes, hoy, dias, cantidad, describir, alElegir }) {
  const [anio, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, m - 1, 1));
  const total = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const desfase = (primero.getUTCDay() + 6) % 7;
  const valores = Object.values(dias).map(cantidad);
  const max = Math.max(1, ...valores);
  const celdas = [...Array(desfase).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div>
      <p className="m-0 mb-3 font-bold text-ink-900">
        {NOMBRES_MES[m - 1]} {anio}
      </p>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="text-[11px] font-semibold text-ink-500 pb-1">
            {d}
          </span>
        ))}
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`v-${i}`} />;
          const clave = `${mes}-${String(dia).padStart(2, "0")}`;
          const info = dias[clave];
          const n = info ? cantidad(info) : 0;
          const nivel = n ? Math.min(RAMPA.length - 1, Math.ceil((n / max) * (RAMPA.length - 1))) : -1;
          const fondo = nivel >= 0 ? RAMPA[nivel] : "transparent";
          const oscuro = nivel >= 3;
          const esHoy = clave === hoy;
          const titulo = `${dia} de ${NOMBRES_MES[m - 1].toLowerCase()}: ${info ? describir(info) : "sin actividad"}`;
          const Etiqueta = alElegir ? "button" : "span";
          return (
            <Etiqueta
              key={clave}
              type={alElegir ? "button" : undefined}
              title={titulo}
              aria-label={titulo}
              onClick={alElegir ? () => alElegir(clave) : undefined}
              className={`aspect-square min-h-[34px] rounded-xl flex flex-col items-center justify-center text-sm tabular-nums ${
                oscuro ? "text-white font-bold" : "text-ink-900"
              } ${esHoy ? "ring-2 ring-offset-2 ring-primary-dark font-extrabold" : ""} ${alElegir ? "hover:outline hover:outline-2 hover:outline-primary/40" : ""}`}
              style={{ background: fondo }}
            >
              {dia}
            </Etiqueta>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500">
        Menos
        {RAMPA.map((c) => (
          <span key={c} className="w-3.5 h-3.5 rounded-[4px]" style={{ background: c }} />
        ))}
        Más
      </div>
    </div>
  );
}

// "hace 5 min", "hace 3 h", "ayer", "12 sep".
export function haceCuanto(fechaIso) {
  const ms = Date.now() - new Date(fechaIso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(fechaIso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

const ACTIVIDAD = {
  cita: { icono: "calendario", tono: "azul" },
  cancelada: { icono: "cerrar", tono: "gris" },
  inscripcion: { icono: "estrella", tono: "morado" },
  atencion: { icono: "pulso", tono: "verde" },
  sesion: { icono: "balon", tono: "naranja" },
  sst: { icono: "alerta", tono: "cian" },
};

export function ActividadReciente({ items, Icono = IconoBase }) {
  if (!items.length) return <p className="m-0 text-sm text-ink-500">Todavía no hay actividad registrada.</p>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col">
      {items.map((a, i) => {
        const estilo = ACTIVIDAD[a.tipo] || ACTIVIDAD.cita;
        return (
          <li key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONOS[estilo.tono]}`}>
              <Icono nombre={estilo.icono} size={17} strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0 leading-snug">
              <span className="block text-sm font-semibold text-ink-900">{a.texto}</span>
              {a.detalle && <span className="block text-[13px] text-ink-500 truncate">{a.detalle}</span>}
            </span>
            <span className="text-xs text-ink-500 whitespace-nowrap pt-0.5">{haceCuanto(a.fecha)}</span>
          </li>
        );
      })}
    </ul>
  );
}
