import { Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, Tooltip } from "recharts";
import { CajaTip } from "./Base";
import { PALETA, fmt } from "./Series";

// Pastel, dona y anillo de avance (Recharts). Pastel y dona son para "parte
// de un todo" con pocas partes (hasta 6): con mas, las sobrantes se juntan en
// "Otros". Para comparar valores parecidos es mejor una barra.

const MAX_PARTES = 6;
const VACIO = "#EEF2F7";
const OTROS = "#9AA3B5";

// Hasta 6 partes con valor, con su color; el resto se suma en "Otros".
function prepararPartes(partes) {
  const conValor = partes.filter((p) => p.valor > 0).map((p, i) => ({ ...p, color: p.color || PALETA[i % PALETA.length] }));
  if (conValor.length <= MAX_PARTES) return conValor;
  const ordenadas = [...conValor].sort((a, b) => b.valor - a.valor);
  const resto = ordenadas.slice(MAX_PARTES - 1);
  return [...ordenadas.slice(0, MAX_PARTES - 1), { clave: "otros", etiqueta: `Otros (${resto.length})`, valor: resto.reduce((s, p) => s + p.valor, 0), color: OTROS }];
}

const porcentaje = (v, total) => (total ? Math.round(((v || 0) / total) * 100) : 0);

// Texto oscuro sobre colores claros y blanco sobre los oscuros.
function tintaSobre(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#0E1222" : "#FFFFFF";
}

// Porcentaje dentro de cada parte; se omite en las muy pequenas (queda en la leyenda).
function etiquetaPorcentaje(minimo) {
  const Etiqueta = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }) => {
    if (percent < minimo) return null;
    const radio = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radio * Math.cos((-midAngle * Math.PI) / 180);
    const y = cy + radio * Math.sin((-midAngle * Math.PI) / 180);
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={tintaSobre(payload.color)} pointerEvents="none">
        {Math.round(percent * 100)} %
      </text>
    );
  };
  return Etiqueta;
}

// Leyenda con cantidad y porcentaje de cada parte (la identidad nunca depende solo del color).
function LeyendaPartes({ partes, total }) {
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2.5 flex-[1_1_200px] min-w-0">
      {partes.map((p) => (
        <li key={p.clave} className="flex items-center gap-2.5 text-sm">
          <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: p.color }} />
          <span className="flex-1 min-w-0 text-ink-700">{p.etiqueta}</span>
          <strong className="text-ink-900 tabular-nums">{fmt(p.valor || 0)}</strong>
          <span className="w-11 text-right text-ink-500 tabular-nums">{total ? `${porcentaje(p.valor, total)} %` : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

function Circulo({ partes, total, tamano, interior, porcentajes, minimo, descripcion, children }) {
  const visibles = total ? partes : [{ clave: "vacio", etiqueta: "Sin datos", valor: 1, color: VACIO }];
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }} role="img" aria-label={descripcion}>
      <PieChart width={tamano} height={tamano}>
        <Pie
          data={visibles}
          dataKey="valor"
          nameKey="etiqueta"
          innerRadius={interior}
          outerRadius={tamano / 2 - 3}
          startAngle={90}
          endAngle={-270}
          // Separacion de 2 px del color de la superficie entre partes.
          stroke="#FFFFFF"
          strokeWidth={visibles.length > 1 ? 2 : 0}
          label={total && porcentajes ? etiquetaPorcentaje(minimo) : false}
          labelLine={false}
          isAnimationActive={total > 0}
        >
          {visibles.map((p) => (
            <Cell key={p.clave} fill={p.color} />
          ))}
        </Pie>
        {total > 0 && <Tooltip content={<CajaTip titulo="" formato={(v) => `${fmt(v)} · ${porcentaje(v, total)} %`} />} />}
      </PieChart>
      {children}
    </div>
  );
}

const describir = (partes, total) => partes.map((p) => `${p.etiqueta}: ${fmt(p.valor)} (${porcentaje(p.valor, total)} %)`).join(", ");

// Dona con Recharts <PieChart>: cifra principal en el centro y leyenda con
// cantidad y porcentaje. Con "porcentajes", cada parte muestra su % encima.
export function Dona({ partes, centro, etiquetaCentro, tamano = 200, porcentajes = false }) {
  const listas = prepararPartes(partes);
  const total = listas.reduce((s, p) => s + p.valor, 0);
  const grosor = porcentajes ? 34 : 25;
  return (
    <div className="relative flex flex-wrap items-center justify-center gap-6 w-full">
      <Circulo
        partes={listas}
        total={total}
        tamano={tamano}
        interior={tamano / 2 - grosor}
        porcentajes={porcentajes}
        minimo={0.07}
        descripcion={`${etiquetaCentro}: ${centro}. ${describir(listas, total)}`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[34px] leading-none font-extrabold text-primary-dark">{centro}</span>
          <span className="mt-1 text-xs text-ink-500 max-w-[110px] leading-tight">{etiquetaCentro}</span>
        </div>
      </Circulo>
      {/* Sin "Otros", la leyenda muestra todas las partes (tambien las que estan en cero). */}
      <LeyendaPartes partes={listas.some((p) => p.clave === "otros") ? listas : partes.map((p) => listas.find((l) => l.clave === p.clave) || { ...p, color: p.color || OTROS })} total={total} />
    </div>
  );
}

// Pastel completo con el porcentaje dentro de cada parte y la leyenda al lado.
export function Pastel({ partes, tamano = 220, titulo = "Distribución", vacio = "Sin datos en este rango." }) {
  const listas = prepararPartes(partes);
  const total = listas.reduce((s, p) => s + p.valor, 0);
  if (!total) return <p className="m-0 text-sm text-ink-500">{vacio}</p>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 w-full">
      <Circulo partes={listas} total={total} tamano={tamano} interior={0} porcentajes minimo={0.05} descripcion={`${titulo}: ${describir(listas, total)}`} />
      <LeyendaPartes partes={listas} total={total} />
    </div>
  );
}

// Anillo de avance (Recharts <RadialBarChart>): un solo valor de 0 a 100 con
// el texto en el centro. "pista" es el color del fondo del anillo.
export function Anillo({ porcentaje, color, pista = "#EEF1F6", tamano = 96, grosor = 10, etiqueta, children }) {
  const valor = Math.max(0, Math.min(100, Number(porcentaje) || 0));
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }} role="img" aria-label={etiqueta}>
      <RadialBarChart
        width={tamano}
        height={tamano}
        data={[{ valor }]}
        innerRadius={tamano / 2 - grosor - 2}
        outerRadius={tamano / 2 - 2}
        startAngle={90}
        endAngle={-270}
        barSize={grosor}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="valor" fill={color} background={{ fill: pista }} cornerRadius={grosor / 2} isAnimationActive />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">{children}</div>
    </div>
  );
}
