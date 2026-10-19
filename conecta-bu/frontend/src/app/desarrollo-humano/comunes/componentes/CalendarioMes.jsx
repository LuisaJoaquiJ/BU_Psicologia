import { useState } from "react";
import { Icono } from "./Iconos";

// Calendario mensual sencillo. Cada dia muestra marcas cortas (p. ej.
// "3 libres", "Incapacidad") y al tocarlo se elige ese dia; el detalle lo
// pinta la pantalla que lo usa debajo del calendario.
//   marcas: { "2026-10-14": [{ texto: "3 libres", tono: "verde", etiqueta?: "texto para lector de pantalla" }, ...] }

const TONOS = {
  verde: "bg-[#DDF3EA] text-[#0E6B4A]",
  azul: "bg-[#E3EEFB] text-[#1C5CAB]",
  marino: "bg-primary-dark text-white",
  gris: "bg-gray-100 text-ink-600",
  ambar: "bg-[#FFF1DC] text-[#8A4B00]",
  rojo: "bg-red-50 text-red-700",
};
const PUNTOS = {
  verde: "bg-[#1baf7a]",
  azul: "bg-[#2a78d6]",
  marino: "bg-primary-dark",
  gris: "bg-gray-400",
  ambar: "bg-[#d97706]",
  rojo: "bg-red-600",
};
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarioMes({ marcas = {}, seleccionado, onSeleccionar, leyenda }) {
  const hoy = isoDia(new Date());
  const base = seleccionado ? new Date(`${seleccionado}T12:00:00`) : new Date();
  const [mes, setMes] = useState(new Date(base.getFullYear(), base.getMonth(), 1));

  const primerDia = (mes.getDay() + 6) % 7; // lunes = 0
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasMes; d++) celdas.push(new Date(mes.getFullYear(), mes.getMonth(), d));
  while (celdas.length % 7) celdas.push(null);

  const titulo = mes.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  const mover = (n) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));

  return (
    <section className="vidrio-panel rounded-[24px] p-2 sm:p-3" aria-label="Calendario">
      <div className="flex items-center justify-between gap-3 px-2 sm:px-3 pt-1 pb-3">
        <h2 className="m-0 text-lg font-extrabold first-letter:uppercase">{titulo}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const h = new Date();
              setMes(new Date(h.getFullYear(), h.getMonth(), 1));
              onSeleccionar?.(hoy);
            }}
            className="min-h-[40px] px-4 rounded-full text-sm font-bold text-primary burbuja hover:bg-white"
          >
            Hoy
          </button>
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => mover(-1)}
            className="w-10 h-10 rounded-full grid place-items-center text-primary burbuja hover:bg-white"
          >
            <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => mover(1)}
            className="w-10 h-10 rounded-full grid place-items-center text-primary burbuja hover:bg-white"
          >
            <Icono nombre="derecha" size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 px-1 text-center text-xs font-bold text-ink-500">
        {DIAS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 p-1">
        {celdas.map((d, i) => {
          if (!d) return <div key={`v${i}`} className="min-h-[56px] sm:min-h-[104px]" />;
          const dia = isoDia(d);
          const lista = marcas[dia] || [];
          const elegido = dia === seleccionado;
          const esHoy = dia === hoy;
          const pasado = dia < hoy;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onSeleccionar?.(dia)}
              aria-pressed={elegido}
              aria-label={`${d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}${lista.length ? `: ${lista.map((m) => m.etiqueta || m.texto).join(", ")}` : ""}`}
              className={`min-h-[56px] sm:min-h-[104px] rounded-xl sm:rounded-2xl p-1 sm:p-2 text-left flex flex-col gap-1 align-top transition-[transform,background-color] duration-200 ease-salida ${
                elegido
                  ? "bg-white ring-2 ring-primary shadow-[0_8px_22px_rgba(29,78,158,0.18)]"
                  : `${pasado ? "bg-white/35 border border-white/70" : "burbuja"} hover:bg-white motion-safe:hover:-translate-y-0.5`
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full grid place-items-center text-sm font-extrabold tabular-nums ${
                  esHoy ? "bg-[#1E9E9A] text-white" : elegido ? "text-primary" : pasado ? "text-ink-500/60" : "text-ink-900"
                }`}
              >
                {d.getDate()}
              </span>
              {/* Escritorio: marcas con texto. Celular: puntos de color. */}
              <span className="hidden sm:flex flex-col gap-1 min-w-0 w-full">
                {lista.slice(0, 3).map((m, j) => (
                  <span key={j} className={`block truncate text-[11px] leading-tight font-bold rounded-md px-1.5 py-1 ${TONOS[m.tono] || TONOS.gris}`}>
                    {m.texto}
                  </span>
                ))}
                {lista.length > 3 && <span className="text-[11px] font-bold text-ink-500 px-1">+{lista.length - 3} más</span>}
              </span>
              <span className="sm:hidden flex flex-wrap gap-0.5 px-0.5">
                {lista.slice(0, 4).map((m, j) => (
                  <span key={j} className={`w-1.5 h-1.5 rounded-full ${PUNTOS[m.tono] || PUNTOS.gris}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {leyenda && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-2 sm:px-3 pt-3 pb-1 text-xs font-semibold text-ink-600">
          {leyenda.map(([tono, texto]) => (
            <span key={texto} className="inline-flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${PUNTOS[tono]}`} />
              {texto}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// Selector "Calendario | Lista".
export function SelectorVista({ vista, setVista }) {
  return (
    <div role="tablist" aria-label="Forma de ver" className="inline-flex vidrio-panel rounded-full p-1 gap-1">
      {[
        ["calendario", "Calendario", "calendario"],
        ["lista", "Lista", "lista"],
      ].map(([id, texto, icono]) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={vista === id}
          onClick={() => setVista(id)}
          className={`inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full text-sm font-bold ${vista === id ? "boton-liquido" : "text-primary hover:bg-white/80"}`}
        >
          <Icono nombre={icono} size={16} strokeWidth={2.2} />
          {texto}
        </button>
      ))}
    </div>
  );
}
