import { useEffect, useRef, useState } from "react";

// Colores por modulo, escala ordinal, leyenda, tabla "Ver los datos" y
// utilidades comunes de las graficas de los tableros.

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

export const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO"));

export function useAncho() {
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
