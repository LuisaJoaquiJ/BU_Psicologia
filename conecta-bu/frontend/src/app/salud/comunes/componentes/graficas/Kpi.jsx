import { Area, AreaChart, YAxis } from "recharts";
import { Icono as IconoBase } from "../Iconos";

// Selector de periodo y tarjetas de indicadores con su mini linea y su
// cambio frente al periodo anterior.

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
    <div role="group" aria-label="Periodo" className="inline-flex vidrio-panel rounded-full p-1 gap-1">
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={valor === p.id}
          onClick={() => onCambio(p.id)}
          className={`min-h-[40px] px-4 sm:px-5 rounded-full text-sm font-bold transition-colors ${
            valor === p.id ? "boton-liquido" : "text-primary hover:bg-white/80"
          }`}
        >
          {p.texto}
        </button>
      ))}
    </div>
  );
}

// Tonos de las fichas de icono (fondo claro + icono oscuro del mismo tono).
export const TONOS = {
  azul: "bg-[#E3EEFB] text-[#1C5CAB]",
  verde: "bg-[#DDF3EA] text-[#0E6B4A]",
  naranja: "bg-[#FDE8DE] text-[#A8431B]",
  cian: "bg-[#E4FAFF] text-[#0E5F73]",
  morado: "bg-[#ECE9FB] text-[#4A3AA7]",
  gris: "bg-gray-100 text-ink-600",
};
const LINEA_TONO = { azul: "#2a78d6", verde: "#1baf7a", naranja: "#eb6834", cian: "#0E7C93", morado: "#4a3aa7", gris: "#6B7385" };

function Minilinea({ valores, color }) {
  const datos = valores.filter((x) => x !== null && x !== undefined).map((v, i) => ({ i, v }));
  if (datos.length < 2) return null;
  const ultimo = datos.length - 1;
  return (
    <AreaChart width={96} height={34} data={datos} margin={{ top: 4, right: 4, bottom: 2, left: 0 }} aria-hidden="true">
      <YAxis hide domain={[0, "dataMax"]} />
      <Area
        type="monotone"
        dataKey="v"
        stroke={color}
        strokeWidth={2}
        fill={color}
        fillOpacity={0.1}
        isAnimationActive={false}
        dot={(p) => (p.index === ultimo ? <circle key="ultimo" cx={p.cx} cy={p.cy} r={3.5} fill={color} stroke="#fff" strokeWidth={2} /> : <g key={p.index} />)}
      />
    </AreaChart>
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
  const clase = "bg-white border border-gray-200 rounded-xl p-4 sm:p-5 min-w-0 flex flex-col";
  return a ? (
    <a href={a} className={`${clase} hover:border-primary/40 hover:shadow-[0_8px_24px_rgba(11,35,71,0.08)] transition-shadow`}>
      {cuerpo}
    </a>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}
