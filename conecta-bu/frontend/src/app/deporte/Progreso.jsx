import { estiloDisciplina, horas } from "../../lib/deporte";
import { Icono } from "../../components/Iconos";

// Anillo de avance de horas (sobre fondo azul).
export function AnilloHoras({ total, requeridas, tamano = 168 }) {
  const r = tamano / 2 - 12;
  const c = 2 * Math.PI * r;
  const avance = Math.min(1, requeridas ? total / requeridas : 0);
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }} role="img" aria-label={`${total} de ${requeridas} horas`}>
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="12" />
        <circle
          cx={tamano / 2}
          cy={tamano / 2}
          r={r}
          fill="none"
          stroke="#E8B23A"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${c * avance} ${c}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[40px] leading-none font-semibold text-white tabular-nums">{Number(total).toLocaleString("es-CO", { maximumFractionDigits: 1 })}</span>
        <span className="text-[13px] text-[#D6DDEC] mt-1">de {requeridas} horas</span>
      </div>
    </div>
  );
}

// Chip con icono de la disciplina.
export function IconoDisciplina({ nombre, tamano = 44 }) {
  const e = estiloDisciplina(nombre);
  return (
    <span className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: tamano, height: tamano, background: e.fondo, color: e.color }}>
      <Icono nombre={e.icono} size={Math.round(tamano * 0.5)} strokeWidth={2} />
    </span>
  );
}

export function BarrasDisciplina({ datos, formato = horas }) {
  const max = Math.max(1, ...datos.map((d) => d.horas));
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-3">
      {datos.map((d) => {
        const e = estiloDisciplina(d.nombre);
        return (
          <li key={d.nombre}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-ink-900">{d.nombre}</span>
              <span className="font-bold tabular-nums">{formato(d.horas)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(d.horas / max) * 100}%`, background: e.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
