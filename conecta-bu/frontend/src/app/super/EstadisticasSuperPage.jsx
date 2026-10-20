import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Aviso, Encabezado } from "./comunes/componentes/ui";
import { COLORES_ESTADO, ETIQUETA_ESTADO } from "./comunes/componentes/graficas/Graficas";
import {
  ActividadReciente,
  AreaTiempo,
  AZUL_ORDINAL,
  BarrasH,
  CalendarioActividad,
  Columnas,
  ColumnasApiladas,
  Dona,
  FilasApiladas,
  Leyenda,
  LineasMensuales,
  Pastel,
  NOMBRE_MODULO,
  SERIES_MODULOS,
  SelectorPeriodo,
  TarjetaKpi,
  VerDatos,
} from "./comunes/componentes/graficas/Tablero";

const ESTADOS_CITA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const PARTES_CITA = ESTADOS_CITA.map((e) => ({ clave: e, etiqueta: ETIQUETA_ESTADO[e], color: COLORES_ESTADO[e] }));

const PARTES_SST = [
  { clave: "Recibido", etiqueta: "Recibidos", color: "#163F86" },
  { clave: "Verificado", etiqueta: "Verificados", color: "#0d9488" },
  { clave: "RequiereAjustes", etiqueta: "Requieren ajustes", color: "#d97706" },
  { clave: "Cerrado", etiqueta: "Cerrados", color: "#CBD2DE" },
];

const POBLACION = { Estudiante: "Estudiantes", Docente: "Docentes", Administrativo: "Administrativos", Egresado: "Egresados", Externo: "Externos" };
const ROL = { Estudiante: "Estudiantes", Administrador: "Personal de módulos", SuperAdministrador: "Superadministradores" };

const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO"));
const pct = (n) => (n === null || n === undefined ? "—" : `${n.toLocaleString("es-CO")} %`);

function Panel({ titulo, subtitulo, accion, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-5 sm:p-6 min-w-0 flex flex-col ${className}`}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="m-0 text-lg font-sans font-bold text-ink-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      <div className="mt-5 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

// Interruptor pequeño de dos o mas opciones (tipo de grafica, modulo).
function Interruptor({ opciones, valor, onCambio, etiqueta }) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex bg-gray-100 rounded-full p-1 gap-0.5">
      {opciones.map(([id, texto]) => (
        <button
          key={id}
          type="button"
          aria-pressed={valor === id}
          onClick={() => onCambio(id)}
          className={`px-3.5 min-h-[34px] rounded-full text-[13px] font-bold ${valor === id ? "bg-white text-primary-dark shadow-sm" : "text-ink-600 hover:text-primary"}`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

const ICONOS_KPI = {
  participaciones: ["grafica", "azul"],
  citas: ["calendario", "morado"],
  atenciones: ["pulso", "verde"],
  inscritos: ["estrella", "cian"],
  horas: ["balon", "naranja"],
  sst: ["alerta", "gris"],
};

// Tablero del superadministrador: cifras de todos los modulos de Bienestar
// en el mismo rango de meses.
export function EstadisticasSuperPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [vista, setVista] = useState("columnas");
  const [moduloCitas, setModuloCitas] = useState("desarrollo-humano");
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    setError("");
    http
      .get("/super/estadisticas", { params: { periodo } })
      .then((res) => setD(res.data))
      .catch(() => setError("No fue posible cargar las estadísticas. Revisa tu conexión e intenta de nuevo."))
      .finally(() => setCargando(false));
  }, [periodo]);

  const totalesModulo = d
    ? SERIES_MODULOS.map((s) => ({ id: s.clave, nombre: s.etiqueta, total: d.tendencia.reduce((t, m) => t + (m[s.clave] || 0), 0) }))
    : [];
  const coloresModulo = Object.fromEntries(SERIES_MODULOS.map((s) => [s.clave, s.color]));

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        titulo="Estadísticas de Bienestar"
        descripcion="Cómo va Bienestar en todos sus módulos. Pasa el mouse sobre una gráfica para ver el detalle."
      />

      <div className="flex items-center gap-3 flex-wrap mb-6">
        <SelectorPeriodo valor={periodo} onCambio={setPeriodo} />
        {d && (
          <span className="text-sm text-ink-500">
            Mostrando {d.texto}, comparado con {d.textoAnterior}.
          </span>
        )}
      </div>

      {error && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {!d && !error && <p className="text-ink-500">Cargando estadísticas…</p>}

      {d && (
        <div className={`flex flex-col gap-5 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          {/* Cifras principales, con su cambio frente al periodo anterior */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {d.kpis.map((k) => (
              <TarjetaKpi
                key={k.id}
                icono={ICONOS_KPI[k.id]?.[0]}
                tono={ICONOS_KPI[k.id]?.[1]}
                titulo={k.titulo}
                valor={k.valor}
                unidad={k.unidad}
                variacion={k.variacion}
                subirEsBueno={k.id === "sst" ? null : true}
                textoAnterior={d.textoAnterior}
                serie={k.serie}
              />
            ))}
          </div>

          {/* Tendencia + participacion por modulo */}
          <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <Panel
              titulo="Participación en el periodo"
              subtitulo="Citas, atenciones, inscripciones y asistencias de cada módulo"
              accion={
                <Interruptor
                  etiqueta="Tipo de gráfica"
                  opciones={[
                    ["columnas", "Columnas"],
                    ["lineas", "Líneas"],
                    ["area", "Área"],
                  ]}
                  valor={vista}
                  onCambio={setVista}
                />
              }
            >
              <div className="mb-3">
                <Leyenda series={SERIES_MODULOS} forma={vista === "lineas" ? "linea" : "barra"} />
              </div>
              {vista === "lineas" ? (
                <LineasMensuales datos={d.tendencia} series={SERIES_MODULOS} />
              ) : vista === "area" ? (
                <AreaTiempo datos={d.tendencia} series={SERIES_MODULOS} apilada etiqueta="Participaciones por fecha, sumadas por módulo" />
              ) : (
                <ColumnasApiladas datos={d.tendencia} partes={SERIES_MODULOS} />
              )}
              <VerDatos
                columnas={["Fecha", ...SERIES_MODULOS.map((s) => s.etiqueta)]}
                filas={d.tendencia.map((m) => [m.etiqueta, ...SERIES_MODULOS.map((s) => m[s.clave] || 0)])}
              />
            </Panel>
            <Panel titulo="¿Qué módulo se usa más?" subtitulo={`Participaciones en ${d.texto}`}>
              <div className="flex-1 flex flex-col justify-center gap-5">
                <Dona
                  partes={SERIES_MODULOS.map((s) => ({
                    clave: s.clave,
                    etiqueta: s.etiqueta,
                    color: s.color,
                    valor: totalesModulo.find((t) => t.id === s.clave)?.total || 0,
                  }))}
                  centro={fmt(d.totales.participaciones)}
                  etiquetaCentro="participaciones"
                  tamano={180}
                />
                <ul className="list-none m-0 p-0 grid grid-cols-3 gap-2">
                  {d.porModulo.map((m) => (
                    <li key={m.id} className="bg-gray-50 rounded-2xl px-3 py-2.5 text-center">
                      <span className="block text-xs text-ink-500 truncate">{NOMBRE_MODULO[m.id].split(" ")[0]}</span>
                      <span
                        className={`block text-sm font-extrabold ${
                          m.variacion === null || m.variacion === 0 ? "text-ink-600" : m.variacion > 0 ? "text-[#0B6B2E]" : "text-[#A32020]"
                        }`}
                      >
                        {m.variacion === null
                          ? "—"
                          : m.variacion === 0
                            ? "= igual"
                            : `${m.variacion > 0 ? "↑" : "↓"} ${Math.abs(m.variacion).toLocaleString("es-CO")} %`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>

          {/* Calendario, citas por estado y actividad */}
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel titulo="Calendario del mes" subtitulo="Actividad de todos los módulos por día">
              <CalendarioActividad
                mes={d.calendario.mes}
                hoy={d.calendario.hoy}
                dias={d.calendario.dias}
                cantidad={(x) => (x["desarrollo-humano"] || 0) + (x.salud || 0) + (x.deporte || 0)}
                describir={(x) => SERIES_MODULOS.map((s) => `${NOMBRE_MODULO[s.clave]}: ${x[s.clave] || 0}`).join(" · ")}
              />
            </Panel>
            <Panel
              titulo="¿Cómo terminaron las citas?"
              subtitulo={`${fmt(d.citas[moduloCitas].total)} citas en ${d.texto}`}
              accion={
                <Interruptor
                  etiqueta="Módulo"
                  opciones={[
                    ["desarrollo-humano", "D. Humano"],
                    ["salud", "Salud"],
                  ]}
                  valor={moduloCitas}
                  onCambio={setModuloCitas}
                />
              }
            >
              <div className="flex-1 flex items-center">
                <Dona
                  tamano={170}
                  partes={PARTES_CITA.map((p) => ({ ...p, valor: d.citas[moduloCitas][p.clave] }))}
                  centro={d.citas[moduloCitas].tasaAsistencia === null ? "—" : `${Math.round(d.citas[moduloCitas].tasaAsistencia)} %`}
                  etiquetaCentro="asistieron"
                />
              </div>
            </Panel>
            <Panel titulo="Actividad reciente" subtitulo="Lo último en todos los módulos" className="lg:col-span-2 xl:col-span-1">
              <ActividadReciente items={d.actividad} />
            </Panel>
          </div>

          {/* Eventos y salidas */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              titulo="Eventos con más inscritos"
              subtitulo={`Ocupación de cupos ${pct(d.eventos.ocupacion)} · asistencia registrada ${pct(d.eventos.tasaAsistencia)}`}
            >
              <div className="mb-4">
                <Leyenda
                  series={[
                    { clave: "i", etiqueta: "Inscritos", color: "#2a78d6" },
                    { clave: "c", etiqueta: "Cupos libres", color: "#DCE6F5" },
                  ]}
                />
              </div>
              {d.eventos.top.length === 0 ? (
                <p className="m-0 text-sm text-ink-500">No hubo eventos publicados en este rango.</p>
              ) : (
                <FilasApiladas
                  partes={[
                    { clave: "inscritos", etiqueta: "Inscritos", color: "#2a78d6" },
                    { clave: "libres", etiqueta: "Cupos libres", color: "#DCE6F5" },
                  ]}
                  filas={d.eventos.top.map((e) => ({
                    id: e.id,
                    nombre: e.nombre,
                    valores: { inscritos: e.inscritos, libres: Math.max(0, e.cupos - e.inscritos) },
                    detalle: `${fmt(e.inscritos)} de ${fmt(e.cupos)}`,
                  }))}
                />
              )}
              <VerDatos
                columnas={["Evento", "Inscritos", "Cupos", "Asistieron"]}
                filas={d.eventos.top.map((e) => [e.nombre, e.inscritos, e.cupos, e.asistieron])}
              />
            </Panel>
            <Panel titulo="Salidas y reportes de seguridad" subtitulo={`${fmt(d.sst.total)} reportes en el periodo`}>
              <div className="mb-4">
                <Leyenda series={PARTES_SST} />
              </div>
              <FilasApiladas partes={PARTES_SST} filas={[{ id: "sst", nombre: "Estado de los reportes", valores: d.sst.porEstado }]} />
              <div className="mt-6">
                <BarrasH color="#2a78d6" filas={d.sst.porTipo} vacio="No hubo reportes en este rango." />
              </div>
              <VerDatos
                columnas={["Tipo de reporte", "Reportes"]}
                filas={[...d.sst.porTipo.map((f) => [f.nombre, f.total]), ...PARTES_SST.map((p) => [`Estado: ${p.etiqueta}`, d.sst.porEstado[p.clave] || 0])]}
              />
            </Panel>
          </div>

          {/* Salud */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel titulo="Atenciones de salud por población" subtitulo={`${fmt(d.salud.atenciones)} atenciones · ${fmt(d.salud.remisiones)} remisiones`}>
              <Pastel titulo="Atenciones por población" partes={d.salud.porPoblacion.map((f) => ({ clave: f.id, etiqueta: POBLACION[f.id] || f.nombre, valor: f.total }))} vacio="No hubo atenciones en este rango." />
              <VerDatos columnas={["Población", "Atenciones"]} filas={d.salud.porPoblacion.map((f) => [POBLACION[f.id] || f.nombre, f.total])} />
            </Panel>
            <Panel titulo="Atenciones por tipo de actividad" subtitulo="Según el catálogo de actividades de Salud Integral">
              <BarrasH color="#1baf7a" filas={d.salud.porCategoria} />
              <VerDatos columnas={["Actividad", "Atenciones"]} filas={d.salud.porCategoria.map((f) => [f.nombre, f.total])} />
            </Panel>
          </div>

          {/* Deporte */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              titulo="Inscritos por disciplina"
              subtitulo={`Periodo ${d.deporte.periodo} · ${fmt(d.deporte.inscritos)} estudiantes en ${fmt(d.deporte.gruposActivos)} grupos`}
            >
              <BarrasH color="#eb6834" filas={d.deporte.porDisciplina.filter((f) => f.total > 0)} />
              {d.deporte.porDisciplina.some((f) => !f.total) && (
                <p className="mt-3 mb-0 text-[13px] text-ink-500">
                  Sin inscritos:{" "}
                  {d.deporte.porDisciplina
                    .filter((f) => !f.total)
                    .map((f) => f.nombre)
                    .join(", ")}
                  .
                </p>
              )}
              <VerDatos columnas={["Disciplina", "Inscritos"]} filas={d.deporte.porDisciplina.map((f) => [f.nombre, f.total])} />
            </Panel>
            <Panel titulo="Avance de horas de deporte" subtitulo={`Estudiantes según sus horas acumuladas · se requieren ${d.deporte.requeridas} h`}>
              <Columnas filas={d.deporte.avanceHoras} colores={AZUL_ORDINAL} />
              <p className="mt-4 mb-0 text-sm text-ink-600">
                <strong className="text-ink-900">{fmt(d.deporte.cumplieron)}</strong>{" "}
                {d.deporte.cumplieron === 1 ? "estudiante completó" : "estudiantes completaron"} sus horas.
              </p>
              <VerDatos columnas={["Horas acumuladas", "Estudiantes"]} filas={d.deporte.avanceHoras.map((f) => [f.nombre, f.total])} />
            </Panel>
          </div>

          {/* Usuarios */}
          <Panel titulo="Usuarios de Conecta BU" subtitulo={`${fmt(d.usuarios.total)} usuarios registrados`}>
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="m-0 mb-2 text-sm font-bold text-ink-900">Nuevos registros en el periodo</p>
                <Columnas alto={120} filas={d.usuarios.nuevosPorMes.map((m) => ({ id: m.mes, nombre: m.etiqueta, total: m.total }))} />
              </div>
              <div>
                <p className="m-0 mb-2 text-sm font-bold text-ink-900">Por rol</p>
                <BarrasH
                  color="#2a78d6"
                  filas={Object.entries(d.usuarios.porRol)
                    .map(([id, total]) => ({ id, nombre: ROL[id] || id, total }))
                    .sort((a, b) => b.total - a.total)}
                />
              </div>
            </div>
            <VerDatos
              columnas={["Dato", "Usuarios"]}
              filas={[
                ...d.usuarios.nuevosPorMes.map((m) => [`Nuevos en ${m.etiqueta}`, m.total]),
                ...Object.entries(d.usuarios.porRol).map(([id, total]) => [ROL[id] || id, total]),
              ]}
            />
          </Panel>
        </div>
      )}
    </main>
  );
}
