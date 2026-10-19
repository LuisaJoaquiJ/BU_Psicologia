import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Panel } from "../../comunes/Panel";
import { Aviso } from "../../comunes/componentes/ui";
import { Icono } from "../../comunes/componentes/Iconos";
import { ActividadReciente, BarrasAgrupadas, BarrasH, CalendarioActividad, ColumnasApiladas, Dona, FilasApiladas, Leyenda, RadarComparado, SelectorPeriodo, TarjetaKpi, VerDatos } from "../../../../components/graficas/Tablero";
import { http } from "../../../../lib/api/http";
import { horas } from "../../comunes/lib/deporte";
import { descargar } from "../../comunes/lib/salud";
import { ASISTENCIA, AVANCE, ICONOS, MESES, OCUPACION, ORIGEN, PERFIL_DISCIPLINA, fmt } from "./series";

// Estadísticas de Deporte: indicadores del periodo y gráficas (Recharts).

export function TableroDeporte() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("mes");
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    setError("");
    http
      .get("/deporte/admin/tablero", { params: { periodo } })
      .then((r) => setD(r.data))
      .catch(() => setError("No fue posible cargar las estadísticas. Revisa tu conexión e intenta de nuevo."))
      .finally(() => setCargando(false));
  }, [periodo]);

  const pctOcupacion = d && d.ocupacion.reduce((s, o) => s + o.cupo, 0) ? Math.round((d.ocupacion.reduce((s, o) => s + o.inscritos, 0) / d.ocupacion.reduce((s, o) => s + o.cupo, 0)) * 100) : null;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-5">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <p className="m-0 text-sm font-bold text-ink-500">Deporte</p>
          <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">Estadísticas</h1>
          <p className="mt-1.5 mb-0 text-ink-500">Cómo va Deporte: asistencia a clases, horas otorgadas, avance de los estudiantes, cupos e inventario.</p>
        </div>
        <button
          type="button"
          onClick={() => descargar("/deporte/admin/reporte", d?.periodoAcademico ? { periodo: d.periodoAcademico } : {}, "deporte-horas.xlsx")}
          className="min-h-[44px] px-5 rounded-full border border-gray-200 bg-white font-bold text-sm text-primary inline-flex items-center gap-2 hover:bg-gray-50"
        >
          <Icono nombre="descarga" size={16} /> Reporte en Excel
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        {d && (
          <span className="text-sm text-ink-500">
            Mostrando {d.texto}, comparado con {d.textoAnterior}.
          </span>
        )}
      </div>

      {error && <Aviso>{error}</Aviso>}
      {!d && !error && <p className="text-ink-500">Cargando estadísticas…</p>}

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
                serie={k.serie.filter((v) => v !== null)}
              />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <Panel titulo="Asistencia a clases" subtitulo="Estudiantes presentes y ausentes en las clases de cada día (o semana, o mes).">
              <div className="mb-3">
                <Leyenda series={ASISTENCIA} />
              </div>
              <ColumnasApiladas datos={d.serie} partes={ASISTENCIA} />
              <VerDatos columnas={["Fecha", "Presentes", "Ausentes", "Clases", "Horas"]} filas={d.serie.map((s) => [s.etiqueta, s.Presentes, s.Ausentes, s.sesiones, s.horas])} />
            </Panel>
            <Panel titulo="¿De dónde salen las horas?" subtitulo={`${horas(d.kpis.find((k) => k.id === "horas").valor)} otorgadas en ${d.texto}`}>
              <div className="flex-1 flex items-center">
                <Dona
                  partes={ORIGEN.map((p) => ({ ...p, valor: d.origen[p.clave] }))}
                  centro={horas(d.kpis.find((k) => k.id === "horas").valor)}
                  etiquetaCentro="horas otorgadas"
                  porcentajes
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              titulo="Avance hacia el requisito"
              subtitulo={`${fmt(d.avance.total)} estudiantes en Deporte · ${d.requeridas} horas requeridas`}
              accion={
                <Link to="/deporte/estudiantes" className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver estudiantes
                </Link>
              }
            >
              <div className="flex-1 flex items-center">
                <Dona
                  partes={AVANCE.map((p) => ({ ...p, valor: d.avance[p.clave] }))}
                  centro={d.avance.total ? `${Math.round((d.avance.Completaron / d.avance.total) * 100)} %` : "—"}
                  etiquetaCentro="ya completaron"
                />
              </div>
            </Panel>
            <Panel
              titulo={`Cupos por disciplina · ${d.periodoAcademico}`}
              subtitulo={pctOcupacion === null ? "Sin grupos activos en el periodo." : `${pctOcupacion} % de los cupos ocupados`}
              accion={
                <Link to="/deporte/grupos" className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver grupos
                </Link>
              }
            >
              <div className="mb-3">
                <Leyenda series={OCUPACION} />
              </div>
              <FilasApiladas
                partes={OCUPACION}
                filas={d.ocupacion.map((o) => ({
                  id: o.id,
                  nombre: o.nombre,
                  detalle: `${o.inscritos} de ${o.cupo} · ${o.grupos} grupo${o.grupos === 1 ? "" : "s"}`,
                  valores: { inscritos: o.inscritos, libres: Math.max(0, o.cupo - o.inscritos) },
                }))}
              />
              <VerDatos columnas={["Disciplina", "Inscritos", "Cupos", "Grupos", `Horas en ${d.texto}`]} filas={d.ocupacion.map((o) => [o.nombre, o.inscritos, o.cupo, o.grupos, o.horas])} />
            </Panel>
          </div>

          <PerfilDisciplinas ocupacion={d.ocupacion} />

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel titulo="Horas por disciplina" subtitulo={`Otorgadas en ${d.texto}`}>
              <BarrasH
                color="#eb6834"
                formato={(n) => Number(n).toLocaleString("es-CO")}
                unidad=" h"
                filas={d.horasPorDisciplina.map((x) => ({ id: x.nombre, nombre: x.nombre, total: x.horas }))}
                vacio="No se otorgaron horas en este periodo."
              />
            </Panel>
            <Panel titulo="Asistencia por grupo" subtitulo="Porcentaje de presentes en sus clases del periodo">
              <BarrasH
                color="#0d9488"
                unidad=" %"
                filas={d.asistenciaGrupos.map((g) => ({ id: g.id, nombre: g.nombre, total: g.asistencia }))}
                vacio="No se tomó asistencia en este periodo."
              />
              <VerDatos columnas={["Grupo", "Asistencia (%)", "Clases"]} filas={d.asistenciaGrupos.map((g) => [g.nombre, g.asistencia, g.sesiones])} />
            </Panel>
            <Panel titulo="Clases por docente" subtitulo={`Dictadas en ${d.texto}`} className="lg:col-span-2 xl:col-span-1">
              <BarrasH
                color="#2a78d6"
                filas={d.docentes.map((x) => ({ id: x.nombre, nombre: x.nombre, total: x.sesiones }))}
                vacio="No hubo clases en este periodo."
              />
              <VerDatos columnas={["Docente", "Clases", "Horas"]} filas={d.docentes.map((x) => [x.nombre, x.sesiones, x.horas])} />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel titulo="Calendario del mes" subtitulo="Clases dictadas y eventos. Toca un día para ver los grupos.">
              <CalendarioActividad
                mes={d.calendario.mes}
                hoy={d.calendario.hoy}
                dias={d.calendario.dias}
                cantidad={(x) => x.clases + x.eventos}
                describir={(x) => `${x.clases} ${x.clases === 1 ? "clase" : "clases"}${x.eventos ? ` y ${x.eventos} ${x.eventos === 1 ? "evento" : "eventos"}` : ""}`}
                alElegir={() => navigate("/deporte/grupos")}
              />
            </Panel>

            <Panel
              titulo="Próximos eventos"
              subtitulo="Inscritos frente a cupos"
              accion={
                <Link to="/deporte/eventos" className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver todos
                </Link>
              }
            >
              {d.proximosEventos.length === 0 ? (
                <p className="m-0 text-sm text-ink-500">No hay eventos próximos publicados.</p>
              ) : (
                <ul className="list-none m-0 p-0 flex flex-col gap-3">
                  {d.proximosEventos.map((e) => {
                    const [, m, dia] = e.fecha.split("-").map(Number);
                    const pct = e.cupo ? Math.min(100, Math.round((e.inscritos / e.cupo) * 100)) : 0;
                    return (
                      <li key={e.id}>
                        <Link to={`/deporte/eventos/${e.id}`} className="flex items-center gap-3 rounded-xl hover:bg-gray-50 -mx-1 px-1 py-0.5">
                          <span className="w-12 h-12 rounded-xl bg-[#FDE8DE] text-[#A8431B] flex flex-col items-center justify-center shrink-0 leading-none">
                            <strong className="text-base">{String(dia).padStart(2, "0")}</strong>
                            <span className="text-[10px] font-bold uppercase tracking-wide">{MESES[m - 1]}</span>
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-ink-900 truncate" title={e.nombre}>
                              {e.nombre}
                            </span>
                            {e.cupo ? (
                              <span className="mt-1.5 flex items-center gap-2">
                                <span className="flex-1 h-2 rounded-full bg-[#FDE8DE] overflow-hidden">
                                  <span className="block h-full rounded-full bg-[#eb6834]" style={{ width: `${pct}%` }} />
                                </span>
                                <span className="text-xs font-bold text-ink-700 tabular-nums whitespace-nowrap">
                                  {e.inscritos}/{e.cupo}
                                </span>
                              </span>
                            ) : (
                              <span className="block mt-1 text-xs text-ink-500">{e.inscritos} inscritos · sin límite de cupos</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              titulo="Inventario"
              subtitulo="Lo que necesita atención"
              accion={
                <Link to="/deporte/inventario" className="text-sm font-bold text-primary-soft whitespace-nowrap py-2">
                  Ver inventario
                </Link>
              }
              className="lg:col-span-2 xl:col-span-1"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["En préstamo", `${fmt(d.inventario.enPrestamo)} de ${fmt(d.inventario.unidades)}`, `${d.inventario.prestamosActivos} préstamos activos`, "bg-[#E3EEFB] text-[#1C5CAB]"],
                  ["Vencidos", fmt(d.inventario.vencidos), "sin devolver a tiempo", d.inventario.vencidos ? "bg-[#FDECEC] text-[#A32020]" : "bg-gray-100 text-ink-700"],
                  ["Bajo stock", fmt(d.inventario.bajoStock.length), "implementos", d.inventario.bajoStock.length ? "bg-[#FFF4DB] text-[#8A4B00]" : "bg-gray-100 text-ink-700"],
                  ["Dañados", fmt(d.inventario.danados), "unidades por reparar", "bg-gray-100 text-ink-700"],
                ].map(([t, v, detalle, tono]) => (
                  <div key={t} className={`rounded-2xl p-3.5 ${tono}`}>
                    <p className="m-0 text-xs font-bold opacity-80">{t}</p>
                    <p className="m-0 text-2xl font-extrabold tabular-nums">{v}</p>
                    <p className="m-0 text-xs opacity-80">{detalle}</p>
                  </div>
                ))}
              </div>
              {d.inventario.bajoStock.length > 0 && (
                <p className="m-0 mt-3 text-sm text-ink-600">
                  Reponer:{" "}
                  {d.inventario.bajoStock.map((i, n) => (
                    <span key={i.id}>
                      {n ? ", " : ""}
                      <Link to={`/deporte/inventario/${i.id}`} className="font-bold text-primary">
                        {i.nombre}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </Panel>
          </div>

          <Panel titulo="Actividad reciente" subtitulo="Lo último que pasó en el módulo">
            <ActividadReciente items={d.actividad} />
          </Panel>
        </div>
      )}
    </main>
  );
}

// Ocupacion de cupos y asistencia a clases de cada disciplina (en %). Con 3
// o mas disciplinas se ve como radar; con menos, como barras agrupadas.
function PerfilDisciplinas({ ocupacion }) {
  if (!ocupacion.length) return null;
  const filas = ocupacion.map((o) => ({ id: o.id, nombre: o.nombre, ocupacion: o.cupo ? Math.round((o.inscritos / o.cupo) * 100) : 0, asistencia: o.asistencia }));
  const pct = (v) => (v === null || v === undefined ? "—" : `${v} %`);
  return (
    <Panel titulo="Perfil de las disciplinas" subtitulo="Porcentaje de cupos ocupados y de estudiantes presentes en clase, por disciplina">
      <div className="mb-3">
        <Leyenda series={PERFIL_DISCIPLINA} forma={filas.length >= 3 ? "linea" : "barra"} />
      </div>
      {filas.length >= 3 ? (
        <RadarComparado ejes={filas} series={PERFIL_DISCIPLINA} etiqueta="Cupos ocupados y asistencia por disciplina" />
      ) : (
        <BarrasAgrupadas series={PERFIL_DISCIPLINA} filas={filas} unidad=" %" />
      )}
      <VerDatos columnas={["Disciplina", "Cupos ocupados", "Asistencia a clases"]} filas={filas.map((f) => [f.nombre, pct(f.ocupacion), pct(f.asistencia)])} />
    </Panel>
  );
}
