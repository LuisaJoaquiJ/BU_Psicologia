import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Aviso } from "../../components/ui";
import { COLORES_ESTADO, ETIQUETA_ESTADO } from "../../components/graficas/Graficas";
import {
  ActividadReciente,
  BarrasH,
  CalendarioActividad,
  ColumnasApiladas,
  Dona,
  Leyenda,
  SelectorPeriodo,
  TarjetaKpi,
  VerDatos,
} from "../../components/graficas/Tablero";

const ESTADOS = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const PARTES = ESTADOS.map((e) => ({ clave: e, etiqueta: ETIQUETA_ESTADO[e], color: COLORES_ESTADO[e] }));
const ICONOS = {
  citas: ["calendario", "azul"],
  asistencia: ["check", "verde"],
  inscritos: ["estrella", "morado"],
  personas: ["usuarios", "cian"],
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (n) => Number(n || 0).toLocaleString("es-CO");

export function Panel({ titulo, subtitulo, accion, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-[22px] p-5 sm:p-6 min-w-0 flex flex-col ${className}`}>
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-sans font-bold text-ink-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </section>
  );
}

function fechaCorta(iso) {
  const [, m, d] = iso.split("-").map(Number);
  return { dia: String(d).padStart(2, "0"), mes: MESES[m - 1] };
}

// Resumen de Desarrollo Humano: indicadores con su cambio frente al periodo
// anterior, citas por dia, estados, calendario, proximos eventos y actividad.
export function TableroDH({ alVerDetalle }) {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("mes");
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    setError("");
    http
      .get("/admin/estadisticas/tablero", { params: { periodo } })
      .then((res) => setD(res.data))
      .catch(() => setError("No fue posible cargar el resumen. Revisa tu conexión e intenta de nuevo."))
      .finally(() => setCargando(false));
  }, [periodo]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        {d && (
          <span className="text-sm text-ink-500">
            Mostrando {d.texto}, comparado con {d.textoAnterior}.
          </span>
        )}
      </div>

      {error && <Aviso>{error}</Aviso>}
      {!d && !error && <p className="text-ink-500">Cargando resumen…</p>}

      {d && (
        <div className={`flex flex-col gap-5 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
            {d.kpis.map((k) => (
              <TarjetaKpi
                key={k.id}
                icono={ICONOS[k.id]?.[0]}
                tono={ICONOS[k.id]?.[1]}
                titulo={k.titulo}
                valor={k.valor}
                unidad={k.unidad}
                variacion={k.variacion}
                puntos={k.id === "asistencia" ? k.puntos : undefined}
                textoAnterior={d.textoAnterior}
                serie={k.serie}
              />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <Panel titulo="Citas en el periodo" subtitulo="Cada columna es un día (o semana, o mes) y muestra cómo terminaron las citas.">
              <div className="mb-3">
                <Leyenda series={PARTES} />
              </div>
              <ColumnasApiladas datos={d.serie} partes={PARTES} />
              <VerDatos columnas={["Fecha", ...PARTES.map((p) => p.etiqueta)]} filas={d.serie.map((s) => [s.etiqueta, ...ESTADOS.map((e) => s[e])])} />
            </Panel>
            <Panel titulo="¿Cómo terminaron las citas?" subtitulo={`${fmt(d.estados.total)} citas en ${d.texto}`}>
              <div className="flex-1 flex items-center">
                <Dona
                  partes={PARTES.map((p) => ({ ...p, valor: d.estados[p.clave] }))}
                  centro={d.estados.tasaAsistencia === null ? "—" : `${Math.round(d.estados.tasaAsistencia)} %`}
                  etiquetaCentro="asistieron a su cita"
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel titulo="Calendario de citas" subtitulo="Toca un día para abrir su agenda.">
              <CalendarioActividad
                mes={d.calendario.mes}
                hoy={d.calendario.hoy}
                dias={d.calendario.dias}
                cantidad={(x) => x.citas + x.eventos}
                describir={(x) =>
                  `${x.citas} ${x.citas === 1 ? "cita" : "citas"}${x.eventos ? ` y ${x.eventos} ${x.eventos === 1 ? "evento" : "eventos"}` : ""}`
                }
                alElegir={(fecha) => navigate(`/admin/citas?fecha=${fecha}`)}
              />
            </Panel>

            <Panel
              titulo="Próximos eventos"
              subtitulo="Inscritos frente a cupos"
              accion={
                <Link to="/admin/eventos" className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver todos
                </Link>
              }
            >
              {d.proximosEventos.length === 0 ? (
                <p className="m-0 text-sm text-ink-500">No hay eventos próximos publicados.</p>
              ) : (
                <ul className="list-none m-0 p-0 flex flex-col gap-3">
                  {d.proximosEventos.map((e) => {
                    const { dia, mes } = fechaCorta(e.fecha);
                    const pct = e.cupos ? Math.min(100, Math.round((e.inscritos / e.cupos) * 100)) : 0;
                    return (
                      <li key={e.id} className="flex items-center gap-3">
                        <span className="w-12 h-12 rounded-xl bg-primary-light text-primary flex flex-col items-center justify-center shrink-0 leading-none">
                          <strong className="text-base">{dia}</strong>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-accent">{mes}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-ink-900 truncate" title={e.nombre}>
                            {e.nombre}
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="flex-1 h-2 rounded-full bg-[#E3EEFB] overflow-hidden">
                              <span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="text-xs font-bold text-ink-700 tabular-nums whitespace-nowrap">
                              {e.inscritos}/{e.cupos}
                            </span>
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel titulo="Actividad reciente" subtitulo="Lo último que pasó en el módulo" className="lg:col-span-2 xl:col-span-1">
              <ActividadReciente items={d.actividad} />
            </Panel>
          </div>

          <Panel
            titulo="Servicios más pedidos"
            subtitulo={`Citas por servicio en ${d.texto}`}
            accion={
              alVerDetalle && (
                <button type="button" onClick={alVerDetalle} className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver análisis detallado
                </button>
              )
            }
          >
            <BarrasH
              color="#2a78d6"
              filas={d.servicios.map((s) => ({ id: s.nombre, nombre: s.nombre, total: s.total }))}
              vacio="No hubo citas en este periodo."
            />
            <VerDatos columnas={["Servicio", "Citas", "Atendidas"]} filas={d.servicios.map((s) => [s.nombre, s.total, s.atendidas])} />
          </Panel>
        </div>
      )}
    </div>
  );
}
