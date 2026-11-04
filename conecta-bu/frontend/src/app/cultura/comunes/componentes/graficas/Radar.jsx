import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { CajaTip, EJE, GUIA, cortar } from "./Base";
import { fmt } from "./Series";

// Radar (Recharts <RadarChart>) para comparar varias medidas en la MISMA
// escala (por defecto porcentajes de 0 a 100) sobre 3 a 8 ejes. Hasta 3
// series: con mas, las formas se tapan. Con menos de 3 ejes no se dibuja
// (un radar de 2 puntos es una linea): quien lo usa muestra barras.
export function RadarComparado({ ejes, series, dominio = [0, 100], unidad = " %", alto = 300, etiqueta = "Comparación por eje" }) {
  if (ejes.length < 3) return null;
  const formato = (v) => (v === null || v === undefined ? "—" : `${fmt(v)}${unidad}`);
  return (
    <div style={{ height: alto }} role="img" aria-label={etiqueta}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={ejes} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke={GUIA} />
          <PolarAngleAxis dataKey="nombre" tick={{ ...EJE, fontSize: 12, fill: "#3D4659" }} tickFormatter={(v) => cortar(v, 16)} />
          {/* La escala va en la diagonal entre los dos primeros ejes, para no tapar sus nombres. */}
          <PolarRadiusAxis domain={dominio} angle={90 - 180 / ejes.length} tick={{ ...EJE, fontSize: 10 }} tickCount={5} axisLine={false} tickFormatter={(v) => `${v}`} />
          <Tooltip content={<CajaTip formato={formato} />} />
          {series.slice(0, 3).map((s) => (
            <Radar
              key={s.clave}
              dataKey={s.clave}
              name={s.etiqueta}
              stroke={s.color}
              strokeWidth={2}
              fill={s.color}
              fillOpacity={0.12}
              dot={{ r: 4, fill: s.color, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
