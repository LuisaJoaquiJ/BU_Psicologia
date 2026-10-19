// Piezas comunes de las graficas hechas con Recharts (https://recharts.org):
// estilo de los ejes, la cuadricula y el cuadro que aparece al pasar el mouse.
// Todas las graficas de los tableros usan estas mismas piezas para verse igual.

export const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO"));

// Texto de los ejes y lineas guia.
export const EJE = { fontSize: 11, fill: "#6B7385" };
export const LINEA_EJE = { stroke: "#C3C9D4" };
export const GUIA = "#E8ECF2";

// Cuadro oscuro con el valor de cada serie (contenido del <Tooltip> de Recharts).
//   titulo: texto o funcion(label, payload) para la primera linea.
//   formato: como se muestra cada valor.
export function CajaTip({ active, payload, label, titulo, formato = fmt, total = false, unidad = "" }) {
  if (!active || !payload?.length) return null;
  const filas = payload.filter((p) => p.value !== undefined && p.value !== null && p.dataKey !== "_rango");
  const suma = filas.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const encabezado = typeof titulo === "function" ? titulo(label, payload) : titulo ?? label;
  return (
    <div className="bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
      {encabezado !== undefined && encabezado !== "" && (
        <p className="m-0 mb-1 font-bold">
          {encabezado}
          {total && filas.length > 1 ? ` · ${formato(suma)}${unidad} en total` : ""}
        </p>
      )}
      {filas.map((p) => (
        <p key={p.dataKey ?? p.name} className="m-0 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: p.color || p.payload?.fill || p.fill }} />
          <strong className="text-sm tabular-nums">
            {formato(p.value)}
            {unidad}
          </strong>
          <span className="text-white/70">{p.name}</span>
        </p>
      ))}
    </div>
  );
}

// Corta una etiqueta larga para que quepa en el eje.
export function cortar(texto, max) {
  const t = String(texto ?? "");
  return t.length > max ? `${t.slice(0, Math.max(1, max - 1))}…` : t;
}
