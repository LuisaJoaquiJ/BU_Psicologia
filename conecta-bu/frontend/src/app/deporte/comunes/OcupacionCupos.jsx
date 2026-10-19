import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tarjeta, Vacio } from "./componentes/ui";
import { Icono } from "./componentes/Iconos";
import { Anillo } from "../../../components/graficas/Tablero";
import { Pastillas } from "./Pastillas";

// Ocupación de cupos (RF-012): anillo total y barras por disciplina o grupo.

// ---- Ocupacion (RF-012) ----------------------------------------------------------
function colorOcupacion(p) {
  return p >= 100 ? "#DC2626" : p >= 80 ? "#D97706" : "#0D9488";
}

export function OcupacionCupos({ ocupacion, actualizado, onActualizar, cargando }) {
  const [vista, setVista] = useState("disciplinas");
  const [soloLlenos, setSoloLlenos] = useState(false);
  const navigate = useNavigate();
  if (!ocupacion) return null;
  const filas =
    vista === "disciplinas"
      ? ocupacion.porDisciplina.map((d) => ({ id: d.nombre, nombre: d.nombre, detalle: `${d.grupos} grupo${d.grupos === 1 ? "" : "s"}`, cupos: d.cupos, ocupados: d.ocupados, libres: d.libres, porcentaje: d.porcentaje }))
      : ocupacion.porGrupo
          .filter((g) => !soloLlenos || g.porcentaje >= 80)
          .map((g) => ({ id: g.id, nombre: g.nombre, detalle: g.docente || "Sin docente", cupos: g.cupo, ocupados: Math.min(g.inscritos, g.cupo), libres: g.libres, porcentaje: g.porcentaje, ir: `/deporte/grupos/${g.id}` }));
  return (
    <Tarjeta
      titulo="Ocupación de cupos"
      subtitulo={`${ocupacion.ocupados} de ${ocupacion.cupos} cupos ocupados · ${ocupacion.llenos} grupo${ocupacion.llenos === 1 ? "" : "s"} lleno${ocupacion.llenos === 1 ? "" : "s"}`}
      acciones={
        <button type="button" onClick={onActualizar} disabled={cargando} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-soft min-h-[36px]" title="Actualizar ahora">
          <Icono nombre="deshacer" size={14} />
          {actualizado ? `Actualizado ${new Date(actualizado).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}` : "Actualizar"}
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-5 mb-4">
        {/* Anillo total (Recharts) */}
        <Anillo porcentaje={ocupacion.porcentaje} color={colorOcupacion(ocupacion.porcentaje)} tamano={96} grosor={9} etiqueta={`${ocupacion.porcentaje} % de ocupación`}>
          <span className="text-xl font-extrabold text-primary leading-none tabular-nums">{Math.round(ocupacion.porcentaje)}%</span>
          <span className="text-[10px] text-ink-500 mt-0.5">ocupado</span>
        </Anillo>
        <dl className="m-0 grid grid-cols-3 gap-4 flex-1 min-w-[220px]">
          {[
            ["Cupos", ocupacion.cupos, "text-primary"],
            ["Ocupados", ocupacion.ocupados, "text-[#0B6B61]"],
            ["Libres", ocupacion.libres, "text-[#8A4B00]"],
          ].map(([t, v, c]) => (
            <div key={t}>
              <dt className="text-xs text-ink-500">{t}</dt>
              <dd className={`m-0 text-2xl font-extrabold tabular-nums ${c}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Pastillas etiqueta="Ver ocupación por" opciones={[["disciplinas", "Por disciplina"], ["grupos", "Por grupo"]]} valor={vista} onCambio={setVista} />
        {vista === "grupos" && (
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-600 cursor-pointer">
            <input type="checkbox" checked={soloLlenos} onChange={(e) => setSoloLlenos(e.target.checked)} className="w-4 h-4 accent-[#0B2A5B]" />
            Solo casi llenos (80 % o más)
          </label>
        )}
      </div>
      {filas.length === 0 && <Vacio>No hay grupos con ese filtro.</Vacio>}
      <ul className="list-none m-0 p-0 flex flex-col gap-3">
        {filas.map((f) => {
          const contenido = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-bold text-ink-900">{f.nombre}</span>
                  <span className="text-xs text-ink-500"> · {f.detalle}</span>
                </span>
                <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: colorOcupacion(f.porcentaje) }}>
                  {f.ocupados}/{f.cupos}
                </span>
              </div>
              <div className="mt-1.5 h-3 rounded-full bg-gray-100 overflow-hidden flex" title={`${f.ocupados} ocupados · ${f.libres} libres`}>
                <div className="h-full transition-[width] duration-700" style={{ width: `${Math.min(100, f.porcentaje)}%`, background: colorOcupacion(f.porcentaje) }} />
              </div>
              <span className="block text-xs text-ink-500 mt-1">{f.libres > 0 ? `${f.libres} cupo${f.libres === 1 ? "" : "s"} libre${f.libres === 1 ? "" : "s"}` : "Sin cupos"}</span>
            </>
          );
          return (
            <li key={f.id}>
              {f.ir ? (
                <button type="button" onClick={() => navigate(f.ir)} className="w-full text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50">
                  {contenido}
                </button>
              ) : (
                <div className="px-0 py-1">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Tarjeta>
  );
}
