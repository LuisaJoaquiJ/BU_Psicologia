import { Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, Tooltip } from "recharts";
import { CajaTip } from "./Base";
import { fmt } from "./Series";

// Dona y anillo de avance (Recharts).

// Dona (parte de un todo, pocas categorias) con Recharts <PieChart>: cifra
// principal en el centro y leyenda con cantidad y porcentaje de cada parte.
export function Dona({ partes, centro, etiquetaCentro, tamano = 200 }) {
  const total = partes.reduce((s, p) => s + (p.valor || 0), 0);
  const conValor = partes.filter((p) => p.valor > 0);
  const pct = (v) => (total ? `${Math.round(((v || 0) / total) * 100)} %` : "—");
  return (
    <div className="relative flex flex-wrap items-center justify-center gap-6 w-full">
      <div className="relative shrink-0" style={{ width: tamano, height: tamano }} role="img" aria-label={`${etiquetaCentro}: ${centro}`}>
        <PieChart width={tamano} height={tamano}>
          <Pie
            data={total ? conValor : [{ clave: "vacio", etiqueta: "Sin datos", valor: 1, color: "#EEF2F7" }]}
            dataKey="valor"
            nameKey="etiqueta"
            innerRadius={tamano / 2 - 25}
            outerRadius={tamano / 2 - 3}
            startAngle={90}
            endAngle={-270}
            paddingAngle={conValor.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={total > 0}
          >
            {(total ? conValor : [{ clave: "vacio", color: "#EEF2F7" }]).map((p) => (
              <Cell key={p.clave} fill={p.color} />
            ))}
          </Pie>
          {total > 0 && <Tooltip content={<CajaTip titulo="" formato={(v) => `${fmt(v)} · ${pct(v)}`} />} />}
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[34px] leading-none font-extrabold text-primary-dark">{centro}</span>
          <span className="mt-1 text-xs text-ink-500 max-w-[110px] leading-tight">{etiquetaCentro}</span>
        </div>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-2.5 flex-[1_1_200px] min-w-0">
        {partes.map((p) => (
          <li key={p.clave} className="flex items-center gap-2.5 text-sm">
            <span className="w-3 h-3 rounded-[3px] shrink-0" style={{ background: p.color }} />
            <span className="flex-1 min-w-0 text-ink-700">{p.etiqueta}</span>
            <strong className="text-ink-900 tabular-nums">{fmt(p.valor || 0)}</strong>
            <span className="w-11 text-right text-ink-500 tabular-nums">{pct(p.valor)}</span>
          </li>
        ))}
      </ul>
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
