import { Icono as IconoBase } from "../Iconos";
import { TONOS } from "./Kpi";

// Calendario de actividad del mes y lista de actividad reciente.

// Calendario del mes con la actividad de cada dia (mas oscuro = mas actividad).
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const RAMPA = ["#E3EEFB", "#B7D3F6", "#6DA7EC", "#2A78D6", "#184F95"];

export function CalendarioActividad({ mes, hoy, dias, cantidad, describir, alElegir }) {
  const [anio, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(anio, m - 1, 1));
  const total = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const desfase = (primero.getUTCDay() + 6) % 7;
  const valores = Object.values(dias).map(cantidad);
  const max = Math.max(1, ...valores);
  const celdas = [...Array(desfase).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  return (
    <div>
      <p className="m-0 mb-3 font-bold text-ink-900">
        {NOMBRES_MES[m - 1]} {anio}
      </p>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="text-[11px] font-semibold text-ink-500 pb-1">
            {d}
          </span>
        ))}
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`v-${i}`} />;
          const clave = `${mes}-${String(dia).padStart(2, "0")}`;
          const info = dias[clave];
          const n = info ? cantidad(info) : 0;
          const nivel = n ? Math.min(RAMPA.length - 1, Math.ceil((n / max) * (RAMPA.length - 1))) : -1;
          const fondo = nivel >= 0 ? RAMPA[nivel] : "transparent";
          const oscuro = nivel >= 3;
          const esHoy = clave === hoy;
          const titulo = `${dia} de ${NOMBRES_MES[m - 1].toLowerCase()}: ${info ? describir(info) : "sin actividad"}`;
          const Etiqueta = alElegir ? "button" : "span";
          return (
            <Etiqueta
              key={clave}
              type={alElegir ? "button" : undefined}
              title={titulo}
              aria-label={titulo}
              onClick={alElegir ? () => alElegir(clave) : undefined}
              className={`aspect-square min-h-[34px] rounded-xl flex flex-col items-center justify-center text-sm tabular-nums ${
                oscuro ? "text-white font-bold" : "text-ink-900"
              } ${esHoy ? "ring-2 ring-offset-2 ring-offset-white/0 ring-[#1E9E9A] font-extrabold" : ""} ${alElegir ? "hover:outline hover:outline-2 hover:outline-primary/40" : ""}`}
              style={{ background: fondo }}
            >
              {dia}
            </Etiqueta>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500">
        Menos
        {RAMPA.map((c) => (
          <span key={c} className="w-3.5 h-3.5 rounded-[4px]" style={{ background: c }} />
        ))}
        Más
      </div>
    </div>
  );
}

// "hace 5 min", "hace 3 h", "ayer", "12 sep".
export function haceCuanto(fechaIso) {
  const ms = Date.now() - new Date(fechaIso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(fechaIso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

const ACTIVIDAD = {
  cita: { icono: "calendario", tono: "azul" },
  cancelada: { icono: "cerrar", tono: "gris" },
  inscripcion: { icono: "estrella", tono: "morado" },
  atencion: { icono: "pulso", tono: "verde" },
  sesion: { icono: "balon", tono: "naranja" },
  sst: { icono: "alerta", tono: "cian" },
  horas: { icono: "reloj", tono: "verde" },
  prestamo: { icono: "lista", tono: "cian" },
};

export function ActividadReciente({ items, Icono = IconoBase }) {
  if (!items.length) return <p className="m-0 text-sm text-ink-500">Todavía no hay actividad registrada.</p>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col">
      {items.map((a, i) => {
        const estilo = ACTIVIDAD[a.tipo] || ACTIVIDAD.cita;
        return (
          <li key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONOS[estilo.tono]}`}>
              <Icono nombre={estilo.icono} size={17} strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0 leading-snug">
              <span className="block text-sm font-semibold text-ink-900">{a.texto}</span>
              {a.detalle && <span className="block text-[13px] text-ink-500 truncate">{a.detalle}</span>}
            </span>
            <span className="text-xs text-ink-500 whitespace-nowrap pt-0.5">{haceCuanto(a.fecha)}</span>
          </li>
        );
      })}
    </ul>
  );
}
