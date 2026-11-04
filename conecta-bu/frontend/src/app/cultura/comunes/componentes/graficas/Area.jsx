import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CajaTip, EJE, GUIA, LINEA_EJE } from "./Base";
import { fmt } from "./Series";

// Area en el tiempo (Recharts <AreaChart>). Con "apilada", las series se
// suman (cuanto aporta cada una al total); sin ella, se superponen con un
// relleno suave. Linea de 2 px, guia vertical y lectura de todas las series.
export function AreaTiempo({ datos, series, apilada = false, alto = 260, formato = fmt, etiqueta = "Evolución en el tiempo" }) {
  return (
    <div style={{ height: alto }} role="img" aria-label={etiqueta}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GUIA} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={LINEA_EJE} interval="preserveEnd" minTickGap={18} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={40} allowDecimals={false} tickFormatter={formato} />
          <Tooltip content={<CajaTip formato={formato} total={apilada} />} cursor={{ stroke: "#9AA3B5" }} />
          {series.map((s) => (
            <Area
              key={s.clave}
              type="monotone"
              dataKey={s.clave}
              name={s.etiqueta}
              stackId={apilada ? "total" : undefined}
              stroke={s.color}
              strokeWidth={2}
              fill={s.color}
              fillOpacity={apilada ? 0.55 : 0.14}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
