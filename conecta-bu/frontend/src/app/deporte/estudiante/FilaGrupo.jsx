import { Insignia, botonPrimario, botonSecundario } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { DIAS, horas } from "../comunes/lib/deporte";

// Un grupo de la oferta con su botón de inscripción.

export function FilaGrupo({ grupo, onInscribir, onRetirar, ocupado, restriccion }) {
  const lleno = grupo.cuposDisponibles === 0 && !grupo.inscrito;
  const ocupacion = grupo.cupo ? Math.round(((grupo.cupo - grupo.cuposDisponibles) / grupo.cupo) * 100) : 0;
  return (
    <li className={`rounded-2xl border p-4 flex flex-col gap-3 ${grupo.inscrito ? "border-[#9ED9CB] bg-[#F1FAF7]" : "border-gray-200"}`}>
      <div className="flex justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="m-0 font-bold text-primary">{grupo.nombre}</p>
          <p className="m-0 text-sm text-ink-500">
            {[grupo.instructor && `Docente: ${grupo.instructor}`, grupo.lugar].filter(Boolean).join(" · ")}
          </p>
        </div>
        {grupo.inscrito && (
          <Insignia tono="verde">
            <Icono nombre="check" size={13} strokeWidth={3} /> Inscrito
          </Insignia>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {grupo.horario.map((h) => (
          <span key={`${h.dia}-${h.inicio}`} className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-1">
            {DIAS[h.dia]} {h.inicio}–{h.fin}
          </span>
        ))}
        <span className="text-xs font-semibold text-ink-500 px-1 py-1">{horas(grupo.horasSemana)} por semana</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${ocupacion >= 100 ? "bg-red-500" : ocupacion >= 80 ? "bg-[#D97706]" : "bg-[#0d9488]"}`} style={{ width: `${ocupacion}%` }} />
          </div>
          <p className="m-0 mt-1 text-xs text-ink-500">
            {grupo.cuposDisponibles} de {grupo.cupo} cupos disponibles
          </p>
        </div>
        {grupo.inscrito ? (
          (
            <button type="button" disabled={ocupado} onClick={() => onRetirar(grupo)} className={botonSecundario}>
              Retirarme
            </button>
          )
        ) : restriccion ? (
          <span className="text-sm font-semibold text-ink-500 inline-flex items-center gap-1.5">
            <Icono nombre="escudo" size={15} /> No disponible para tu categoría
          </span>
        ) : grupo.cruceCon ? (
          <span className="text-sm font-semibold text-[#B45309]">Se cruza con {grupo.cruceCon}</span>
        ) : !grupo.inscripcionesAbiertas ? (
          <span className="text-sm font-semibold text-ink-500">Inscripciones cerradas</span>
        ) : (
          <button type="button" disabled={lleno || ocupado} onClick={() => onInscribir(grupo)} className={botonPrimario}>
            {lleno ? "Sin cupos" : "Inscribirme"}
          </button>
        )}
      </div>
    </li>
  );
}
