import { claseCampoCorto } from "../../comunes/componentes/ui";
import { Icono } from "../../comunes/componentes/Iconos";
import { DIAS } from "../../comunes/lib/deporte";

// Editor del horario semanal de un grupo (día, hora de inicio y fin).

export function EditorHorario({ horario, onCambio }) {
  const cambiar = (i, k, v) => onCambio(horario.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  return (
    <div className="flex flex-col gap-2">
      {horario.map((h, i) => (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <select aria-label="Día" value={h.dia} onChange={(e) => cambiar(i, "dia", Number(e.target.value))} className={claseCampoCorto}>
            {Object.entries(DIAS).map(([d, n]) => (
              <option key={d} value={d}>
                {n}
              </option>
            ))}
          </select>
          <input aria-label="Desde" type="time" value={h.inicio} onChange={(e) => cambiar(i, "inicio", e.target.value)} className={`${claseCampoCorto} w-[130px]`} />
          <span className="text-ink-500">a</span>
          <input aria-label="Hasta" type="time" value={h.fin} onChange={(e) => cambiar(i, "fin", e.target.value)} className={`${claseCampoCorto} w-[130px]`} />
          {horario.length > 1 && (
            <button type="button" onClick={() => onCambio(horario.filter((_, j) => j !== i))} aria-label="Quitar franja" className="w-9 h-9 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
              <Icono nombre="cerrar" size={16} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onCambio([...horario, { dia: 3, inicio: "14:00", fin: "16:00" }])} className="self-start text-sm font-bold text-primary-soft">
        + Agregar otro día
      </button>
    </div>
  );
}
