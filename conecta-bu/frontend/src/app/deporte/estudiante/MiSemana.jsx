import { useState } from "react";
import { Link } from "react-router-dom";
import { DIAS_CORTOS, diaHoy, estiloDisciplina, fechaCorta } from "../comunes/lib/deporte";
import { IconoDisciplina } from "../comunes/Progreso";

// Semana del estudiante: sus clases y eventos.

// Semana con las franjas de los grupos del estudiante (RF-022). Al tocar
// una clase se ve el detalle del grupo y su porcentaje de asistencia.
export function MiSemana({ grupos, eventos = [] }) {
  const hoy = diaHoy();
  const [elegido, setElegido] = useState(null);
  const franjas = grupos.flatMap((g) => g.horario.map((h) => ({ ...h, grupo: g })));
  // Eventos inscritos de esta semana (lunes a domingo).
  const inicioSemana = new Date(Date.now() - 5 * 3600e3);
  inicioSemana.setUTCDate(inicioSemana.getUTCDate() - (hoy - 1));
  const finSemana = new Date(inicioSemana.getTime() + 7 * 864e5);
  const eventosSemana = eventos.filter((e) => e.inscrito && !e.yaPaso && new Date(`${e.fecha}T12:00:00Z`) < finSemana);
  const diaDe = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
  };
  const g = elegido ? grupos.find((x) => x.id === elegido) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <div key={d} className={`rounded-2xl p-2 min-h-[120px] ${d === hoy ? "bg-primary-light ring-2 ring-primary-soft/30" : "bg-gray-50"}`}>
              <p className={`m-0 mb-2 text-xs font-bold uppercase tracking-[0.08em] ${d === hoy ? "text-primary" : "text-ink-500"}`}>
                {DIAS_CORTOS[d]}
                {d === hoy && " · hoy"}
              </p>
              <div className="flex flex-col gap-1.5">
                {franjas
                  .filter((f) => f.dia === d)
                  .sort((a, b) => a.inicio.localeCompare(b.inicio))
                  .map((f) => {
                    const e = estiloDisciplina(f.grupo.disciplina?.nombre);
                    const activo = elegido === f.grupo.id;
                    return (
                      <button
                        type="button"
                        key={`${f.grupo.id}-${f.inicio}`}
                        onClick={() => setElegido(activo ? null : f.grupo.id)}
                        aria-pressed={activo}
                        className={`text-left rounded-lg px-2 py-1.5 text-[11px] leading-tight transition-shadow ${activo ? "ring-2 ring-primary shadow-md" : "hover:shadow"}`}
                        style={{ background: e.fondo, color: e.color }}
                      >
                        <span className="block font-bold">
                          {f.inicio}–{f.fin}
                        </span>
                        <span className="block font-semibold text-ink-900 truncate">{f.grupo.disciplina?.nombre}</span>
                        {f.grupo.lugar && <span className="block text-ink-500 truncate">{f.grupo.lugar}</span>}
                      </button>
                    );
                  })}
                {eventosSemana
                  .filter((ev) => diaDe(ev.fecha) === d)
                  .map((ev) => (
                    <Link key={ev.id} to="/mi-deporte/eventos" className="rounded-lg px-2 py-1.5 text-[11px] leading-tight bg-[#FFF1DC] text-[#8A4B00] border border-dashed border-[#F2C46D] no-underline">
                      <span className="block font-bold">
                        {ev.horaInicio} · {ev.tipo}
                      </span>
                      <span className="block font-semibold text-ink-900 truncate">{ev.nombre}</span>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {g ? (
        <div className="rounded-2xl border border-gray-200 p-4 flex flex-wrap gap-5 items-start animate-[aparecer_0.25s_ease-out]">
          <style>{`@keyframes aparecer{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
          <div className="flex gap-3 items-start flex-[1_1_240px] min-w-0">
            <IconoDisciplina nombre={g.disciplina?.nombre} tamano={44} imagen={g.disciplina?.imagenUrl} />
            <div className="min-w-0 leading-tight">
              <p className="m-0 font-extrabold text-ink-900">{g.nombre}</p>
              <p className="m-0 mt-1 text-sm text-ink-500">{g.horarioTexto}</p>
              <p className="m-0 mt-1 text-sm text-ink-500">{[g.instructor && `Docente: ${g.instructor}`, g.lugar].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="flex-[1_1_220px]">
            <p className="m-0 text-sm text-ink-600">
              Asistencia:{" "}
              <strong className={`text-lg ${g.asistencia?.porcentaje !== null && g.asistencia?.porcentaje < 70 ? "text-red-700" : "text-[#0B6B61]"}`}>{g.asistencia?.porcentaje === null || g.asistencia?.porcentaje === undefined ? "sin clases aún" : `${g.asistencia.porcentaje} %`}</strong>
            </p>
            <p className="m-0 text-xs text-ink-500">
              {g.asistencia?.presentes || 0} asistencias · {g.asistencia?.fallas || 0} fallas
            </p>
            {g.asistencia?.ultimas?.length > 0 && (
              <div className="flex gap-1 mt-2" aria-label="Últimas clases">
                {[...g.asistencia.ultimas].reverse().map((u) => (
                  <span
                    key={u.fecha}
                    title={`${fechaCorta(u.fecha)}: ${u.presente === null ? "sin registro" : u.presente ? "asististe" : "faltaste"}`}
                    className={`w-6 h-6 rounded-md grid place-items-center text-[10px] font-bold ${u.presente === null ? "bg-gray-100 text-ink-500" : u.presente ? "bg-[#DDF3EA] text-[#0E6B4A]" : "bg-red-50 text-red-700"}`}
                  >
                    {u.presente === null ? "·" : u.presente ? "✓" : "✕"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        grupos.length > 0 && <p className="m-0 text-sm text-ink-500">Toca una clase para ver tu asistencia en ese grupo.</p>
      )}
    </div>
  );
}
