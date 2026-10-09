import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Aviso, Encabezado } from "../salud/ui";
import { COLORES_ESTADO, ETIQUETA_ESTADO } from "../../components/graficas/Graficas";
import { AZUL_ORDINAL, BarrasH, Columnas, FilasApiladas, Leyenda, LineasMensuales, NOMBRE_MODULO, SERIES_MODULOS, VerDatos } from "../../components/graficas/Tablero";

const RANGOS = [
  { meses: 3, texto: "Últimos 3 meses" },
  { meses: 6, texto: "Últimos 6 meses" },
  { meses: 12, texto: "Último año" },
];

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

function Cifra({ titulo, valor, detalle, a }) {
  const cuerpo = (
    <>
      <p className="m-0 text-[13px] text-ink-500">{titulo}</p>
      <p className="mt-1 mb-0 text-[30px] leading-tight font-extrabold text-primary-dark">{valor}</p>
      {detalle && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{detalle}</p>}
    </>
  );
  const clase = "bg-white border border-gray-200 rounded-[20px] p-5 min-w-0 block";
  return a ? (
    <Link to={a} className={`${clase} hover:border-primary/40 hover:shadow-[0_6px_18px_rgba(11,35,71,0.08)] transition-shadow`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function Panel({ titulo, subtitulo, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-[22px] p-5 sm:p-6 min-w-0 flex flex-col ${className}`}>
      <h2 className="m-0 text-lg font-sans font-bold text-ink-900">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{subtitulo}</p>}
      <div className="mt-5 flex-1 flex flex-col">{children}</div>
    </section>
  );
}

// Tablero del superadministrador: cifras de todos los modulos de Bienestar
// en el mismo rango de meses.
export function EstadisticasSuperPage() {
  const [meses, setMeses] = useState(6);
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    setError("");
    http
      .get("/super/estadisticas", { params: { meses } })
      .then((res) => setD(res.data))
      .catch(() => setError("No fue posible cargar las estadísticas. Revisa tu conexión e intenta de nuevo."))
      .finally(() => setCargando(false));
  }, [meses]);

  const totalesModulo = d
    ? SERIES_MODULOS.map((s) => ({ id: s.clave, nombre: s.etiqueta, total: d.tendencia.reduce((t, m) => t + (m[s.clave] || 0), 0) }))
    : [];
  const coloresModulo = Object.fromEntries(SERIES_MODULOS.map((s) => [s.clave, s.color]));

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        titulo="Estadísticas de Bienestar"
        descripcion="Las cifras de todos los módulos en un mismo periodo. Pasa el mouse sobre una gráfica para ver el detalle, o abre «Ver los datos» debajo de cada una."
      />

      <div role="group" aria-label="Periodo" className="flex gap-2 flex-wrap mb-6">
        {RANGOS.map((r) => (
          <button
            key={r.meses}
            type="button"
            aria-pressed={meses === r.meses}
            onClick={() => setMeses(r.meses)}
            className={`min-h-[44px] px-5 rounded-full text-sm font-bold border-[1.5px] ${
              meses === r.meses ? "bg-primary-dark text-white border-primary-dark" : "bg-white text-primary border-gray-200 hover:border-primary/40"
            }`}
          >
            {r.texto}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {!d && !error && <p className="text-ink-500">Cargando estadísticas…</p>}

      {d && (
        <div className={`flex flex-col gap-5 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          {/* Cifras principales */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
            <div className="col-span-2 lg:col-span-1 bg-primary-dark text-white rounded-[20px] p-5 min-w-0">
              <p className="m-0 text-[13px] text-[#B9C7DE]">Participaciones en Bienestar</p>
              <p className="mt-1 mb-0 text-[52px] leading-none font-extrabold text-white">{fmt(d.totales.participaciones)}</p>
              <p className="mt-2 mb-0 text-[13px] text-[#B9C7DE]">Citas, atenciones, inscripciones y asistencias del periodo</p>
            </div>
            <Cifra titulo="Citas" valor={fmt(d.totales.citas)} detalle="Desarrollo Humano y Salud" />
            <Cifra titulo="Atenciones de salud" valor={fmt(d.totales.atenciones)} detalle={`${fmt(d.salud.personas)} personas`} />
            <Cifra titulo="Inscritos a eventos" valor={fmt(d.totales.inscritosEventos)} detalle={`${fmt(d.eventos.total)} eventos`} />
            <Cifra titulo="Horas de deporte" valor={`${fmt(d.totales.horasDeporte)} h`} detalle={`${fmt(d.totales.estudiantesDeporte)} estudiantes`} />
            <Cifra titulo="Reportes SST" valor={fmt(d.totales.reportesSst)} detalle="Salidas y condiciones" a="/salud/salidas" />
          </div>

          {/* Tendencia + total por modulo */}
          <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
            <Panel titulo="Participación por mes" subtitulo="Cuántas veces la comunidad usó cada módulo">
              <div className="mb-3">
                <Leyenda series={SERIES_MODULOS} forma="linea" />
              </div>
              <LineasMensuales datos={d.tendencia} series={SERIES_MODULOS} />
              <VerDatos
                columnas={["Mes", ...SERIES_MODULOS.map((s) => s.etiqueta)]}
                filas={d.tendencia.map((m) => [m.etiqueta, ...SERIES_MODULOS.map((s) => m[s.clave] || 0)])}
              />
            </Panel>
            <Panel titulo="Total por módulo" subtitulo="Participaciones en el periodo">
              <BarrasH filas={totalesModulo} colores={coloresModulo} />
              <VerDatos columnas={["Módulo", "Participaciones"]} filas={totalesModulo.map((f) => [f.nombre, f.total])} />
            </Panel>
          </div>

          {/* Citas y eventos */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel titulo="Citas por estado" subtitulo="Agenda de Desarrollo Humano y de Salud Integral">
              <div className="mb-4">
                <Leyenda series={PARTES_CITA} />
              </div>
              <FilasApiladas
                partes={PARTES_CITA}
                filas={["desarrollo-humano", "salud"].map((m) => ({
                  id: m,
                  nombre: NOMBRE_MODULO[m],
                  valores: d.citas[m],
                  detalle: `${fmt(d.citas[m].total)} citas · asistencia ${pct(d.citas[m].tasaAsistencia)}`,
                }))}
              />
              <VerDatos
                columnas={["Módulo", ...PARTES_CITA.map((p) => p.etiqueta), "Asistencia"]}
                filas={["desarrollo-humano", "salud"].map((m) => [NOMBRE_MODULO[m], ...ESTADOS_CITA.map((e) => d.citas[m][e]), pct(d.citas[m].tasaAsistencia)])}
              />
            </Panel>
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
              <VerDatos columnas={["Evento", "Inscritos", "Cupos", "Asistieron"]} filas={d.eventos.top.map((e) => [e.nombre, e.inscritos, e.cupos, e.asistieron])} />
            </Panel>
          </div>

          {/* Salud */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel titulo="Atenciones de salud por población" subtitulo={`${fmt(d.salud.atenciones)} atenciones · ${fmt(d.salud.remisiones)} remisiones`}>
              <BarrasH color="#1baf7a" filas={d.salud.porPoblacion.map((f) => ({ ...f, nombre: POBLACION[f.id] || f.nombre }))} />
              <VerDatos columnas={["Población", "Atenciones"]} filas={d.salud.porPoblacion.map((f) => [POBLACION[f.id] || f.nombre, f.total])} />
            </Panel>
            <Panel titulo="Atenciones por tipo de actividad" subtitulo="Según el catálogo de actividades de Salud Integral">
              <BarrasH color="#1baf7a" filas={d.salud.porCategoria} />
              <VerDatos columnas={["Actividad", "Atenciones"]} filas={d.salud.porCategoria.map((f) => [f.nombre, f.total])} />
            </Panel>
          </div>

          {/* Deporte */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel titulo="Inscritos por disciplina" subtitulo={`Periodo ${d.deporte.periodo} · ${fmt(d.deporte.inscritos)} estudiantes en ${fmt(d.deporte.gruposActivos)} grupos`}>
              <BarrasH color="#eb6834" filas={d.deporte.porDisciplina.filter((f) => f.total > 0)} />
              {d.deporte.porDisciplina.some((f) => !f.total) && (
                <p className="mt-3 mb-0 text-[13px] text-ink-500">Sin inscritos: {d.deporte.porDisciplina.filter((f) => !f.total).map((f) => f.nombre).join(", ")}.</p>
              )}
              <VerDatos columnas={["Disciplina", "Inscritos"]} filas={d.deporte.porDisciplina.map((f) => [f.nombre, f.total])} />
            </Panel>
            <Panel titulo="Avance de horas de deporte" subtitulo={`Estudiantes según sus horas acumuladas · se requieren ${d.deporte.requeridas} h`}>
              <Columnas filas={d.deporte.avanceHoras} colores={AZUL_ORDINAL} />
              <p className="mt-4 mb-0 text-sm text-ink-600">
                <strong className="text-ink-900">{fmt(d.deporte.cumplieron)}</strong> {d.deporte.cumplieron === 1 ? "estudiante completó" : "estudiantes completaron"} sus horas.
              </p>
              <VerDatos columnas={["Horas acumuladas", "Estudiantes"]} filas={d.deporte.avanceHoras.map((f) => [f.nombre, f.total])} />
            </Panel>
          </div>

          {/* SST y usuarios */}
          <div className="grid gap-5 lg:grid-cols-2">
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
            <Panel titulo="Usuarios de Conecta BU" subtitulo={`${fmt(d.usuarios.total)} usuarios registrados`}>
              <p className="m-0 mb-2 text-sm font-bold text-ink-900">Nuevos registros por mes</p>
              <Columnas alto={120} filas={d.usuarios.nuevosPorMes.map((m) => ({ id: m.mes, nombre: m.etiqueta, total: m.total }))} />
              <p className="mt-6 mb-2 text-sm font-bold text-ink-900">Por rol</p>
              <BarrasH
                color="#2a78d6"
                filas={Object.entries(d.usuarios.porRol)
                  .map(([id, total]) => ({ id, nombre: ROL[id] || id, total }))
                  .sort((a, b) => b.total - a.total)}
              />
              <VerDatos
                columnas={["Dato", "Usuarios"]}
                filas={[
                  ...d.usuarios.nuevosPorMes.map((m) => [`Nuevos en ${m.etiqueta}`, m.total]),
                  ...Object.entries(d.usuarios.porRol).map(([id, total]) => [ROL[id] || id, total]),
                ]}
              />
            </Panel>
          </div>
        </div>
      )}
    </main>
  );
}
