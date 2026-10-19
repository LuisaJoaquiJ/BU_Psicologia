import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CajaTip, EJE, GUIA, LINEA_EJE, cortar } from "./Base";
import { fmt, useAncho } from "./Series";

// Graficas de barras y lineas de los tableros (Recharts).

// Lineas por mes, una por modulo (Recharts <LineChart>), con linea guia y
// lectura de todas las series en el mes señalado.
export function LineasMensuales({ datos, series, alto = 260 }) {
  return (
    <div style={{ height: alto }} role="img" aria-label="Participaciones por mes y módulo">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GUIA} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={LINEA_EJE} interval="preserveEnd" minTickGap={18} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={40} allowDecimals={false} tickFormatter={fmt} />
          <Tooltip content={<CajaTip />} cursor={{ stroke: "#9AA3B5" }} />
          {series.map((s) => (
            <Line
              key={s.clave}
              type="monotone"
              dataKey={s.clave}
              name={s.etiqueta}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Barras horizontales de una sola serie (Recharts <BarChart layout="vertical">),
// con el nombre a la izquierda y el valor en la punta.
export function BarrasH({ filas, color = "#2a78d6", colores, formato = fmt, unidad = "", vacio = "Sin datos en este rango." }) {
  const [ref, ancho] = useAncho();
  if (!filas.length || filas.every((f) => !f.total)) return <p className="m-0 text-sm text-ink-500">{vacio}</p>;
  const anchoEje = Math.round(Math.min(200, Math.max(96, ancho * 0.4)));
  return (
    <div ref={ref} style={{ height: filas.length * 40 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 76, left: 0, bottom: 4 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={anchoEje}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#3D4659" }}
            tickFormatter={(v) => cortar(v, Math.floor(anchoEje / 6.6))}
          />
          <Tooltip content={<CajaTip formato={formato} unidad={unidad} />} cursor={{ fill: "#F3F5F9" }} />
          <Bar dataKey="total" name="Total" fill={color} radius={[0, 4, 4, 0]} barSize={18} minPointSize={2}>
            {filas.map((f) => (
              <Cell key={f.id} fill={colores?.[f.id] || color} />
            ))}
            {/* Espacios duros: Recharts parte el texto en los espacios si no cabe. */}
            <LabelList dataKey="total" position="right" formatter={(v) => `${formato(v)}${unidad}`.replace(/ /g, "\u00a0")} style={{ fontSize: 12, fontWeight: 700, fill: "#0E1726", whiteSpace: "nowrap" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Barras agrupadas horizontales (Recharts): por cada fila, una barra por
// serie lado a lado, en la misma escala, con el valor en la punta.
//   filas: [{ id, nombre, [serie.clave]: numero }]   series: [{ clave, etiqueta, color }]
export function BarrasAgrupadas({ filas, series, formato = fmt, unidad = "", vacio = "Sin datos en este rango." }) {
  const [ref, ancho] = useAncho();
  if (!filas.length || filas.every((f) => series.every((s) => !f[s.clave]))) return <p className="m-0 text-sm text-ink-500">{vacio}</p>;
  const anchoEje = Math.round(Math.min(200, Math.max(96, ancho * 0.4)));
  const grosor = 12;
  return (
    <div ref={ref} style={{ height: filas.length * (series.length * (grosor + 2) + 22) + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }} barGap={2} barCategoryGap={11}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="nombre"
            width={anchoEje}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "#3D4659" }}
            tickFormatter={(v) => cortar(v, Math.floor(anchoEje / 6.6))}
          />
          <Tooltip content={<CajaTip formato={formato} unidad={unidad} />} cursor={{ fill: "#F3F5F9" }} />
          {series.map((s) => (
            <Bar key={s.clave} dataKey={s.clave} name={s.etiqueta} fill={s.color} radius={[0, 4, 4, 0]} barSize={grosor} minPointSize={2}>
              <LabelList dataKey={s.clave} position="right" formatter={(v) => `${formato(v)}${unidad}`.replace(/ /g, " ")} style={{ fontSize: 11, fontWeight: 700, fill: "#0E1726" }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Una barra apilada por fila (Recharts, barras apiladas con stackId), en la
// misma escala para poder comparar filas. El detalle va bajo el nombre.
export function FilasApiladas({ filas, partes }) {
  const [ref, ancho] = useAncho();
  if (!filas.length) return <p className="m-0 text-sm text-ink-500">Sin registros.</p>;
  const anchoEje = Math.round(Math.min(220, Math.max(110, ancho * 0.38)));
  const datos = filas.map((f) => ({ id: f.id, nombre: f.nombre, detalle: f.detalle, ...f.valores }));
  const Etiqueta = ({ x, y, payload }) => {
    const fila = datos[payload.index];
    return (
      <g transform={`translate(4,${y})`}>
        <text y={-3} fontSize={13} fontWeight={700} fill="#0E1726">
          {cortar(payload.value, Math.floor(anchoEje / 7.5))}
        </text>
        {fila?.detalle && (
          <text y={13} fontSize={11} fill="#6B7385">
            {cortar(fila.detalle, Math.floor(anchoEje / 6))}
          </text>
        )}
      </g>
    );
  };
  return (
    <div ref={ref} style={{ height: filas.length * 52 + 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }} barCategoryGap={14}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="nombre" width={anchoEje} tickLine={false} axisLine={false} tick={<Etiqueta />} />
          <Tooltip content={<CajaTip total />} cursor={{ fill: "#F3F5F9" }} />
          {partes.map((p, i) => (
            <Bar key={p.clave} dataKey={p.clave} name={p.etiqueta} stackId="fila" fill={p.color} barSize={22} radius={i === partes.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Columnas verticales de una serie (Recharts <BarChart>), con el valor encima.
export function Columnas({ filas, colores, color = "#2a78d6", alto = 180, formato = fmt }) {
  return (
    <div style={{ height: alto + 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="nombre" tick={EJE} tickLine={false} axisLine={LINEA_EJE} interval={filas.length > 8 ? "preserveStartEnd" : 0} minTickGap={12} />
          <YAxis hide />
          <Tooltip content={<CajaTip formato={formato} />} cursor={{ fill: "#F3F5F9" }} />
          <Bar dataKey="total" name="Total" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} minPointSize={2}>
            {filas.map((f, i) => (
              <Cell key={f.id} fill={colores?.[i] || color} />
            ))}
            <LabelList dataKey="total" position="top" formatter={(v) => (filas.length > 12 && !v ? "" : formato(v))} style={{ fontSize: 12, fontWeight: 700, fill: "#0E1726" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Columnas apiladas por cubeta (dia, semana o mes) con Recharts: barras con
// el mismo stackId, eje y lectura de todas las partes al pasar el mouse.
export function ColumnasApiladas({ datos, partes, alto = 240 }) {
  return (
    <div style={{ height: alto }} role="img" aria-label="Columnas por periodo">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GUIA} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={LINEA_EJE} interval="preserveEnd" minTickGap={14} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={36} allowDecimals={false} tickFormatter={fmt} />
          <Tooltip content={<CajaTip total />} cursor={{ fill: "#F3F5F9" }} />
          {partes.map((p, i) => (
            <Bar key={p.clave} dataKey={p.clave} name={p.etiqueta} stackId="total" fill={p.color} maxBarSize={24} radius={i === partes.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
