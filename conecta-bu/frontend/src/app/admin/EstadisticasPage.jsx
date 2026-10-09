import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { formatearFecha } from "../../lib/format";

// Colores de asistencia (validados para daltonismo y contraste sobre blanco);
// "sin registrar" es un gris neutro de relleno y siempre lleva su numero.
const COLORES = { asistieron: "#0d9488", noAsistieron: "#d97706", sinRegistrar: "#e5e7eb" };
const SERIES = [
  { clave: "asistieron", label: "Asistieron" },
  { clave: "noAsistieron", label: "No asistieron" },
  { clave: "sinRegistrar", label: "Sin registrar" },
];

const campo = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900";

function formatoTasa(valor) {
  return valor === null || valor === undefined ? "—" : `${valor.toLocaleString("es-CO")} %`;
}

function Indicador({ titulo, valor, detalle }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className="text-3xl font-semibold text-ink-900 mt-1 tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-gray-500 mt-1">{detalle}</p>}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-xs text-gray-600 mb-4">
      {SERIES.map(({ clave, label }) => (
        <span key={clave} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: COLORES[clave] }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// Barra apilada horizontal: cada tramo muestra su valor al pasar el mouse
// (title) y los numeros tambien van escritos al lado, asi el color nunca es la
// unica forma de leer el dato.
function BarraAsistencia({ fila, maximo }) {
  const total = fila.asistieron + fila.noAsistieron + fila.sinRegistrar;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 flex gap-[2px]" style={{ maxWidth: `${maximo ? (total / maximo) * 100 : 0}%` }}>
        {SERIES.map(({ clave, label }) =>
          fila[clave] > 0 ? (
            <div
              key={clave}
              title={`${label}: ${fila[clave]}`}
              className="h-full first:rounded-l last:rounded-r"
              style={{ flexGrow: fila[clave], background: COLORES[clave] }}
            />
          ) : null
        )}
      </div>
      {total === 0 && <span className="text-xs text-gray-400">Sin datos</span>}
    </div>
  );
}

// RF-015: dashboard de participacion y asistencia a citas y eventos, con
// filtro por rango de fechas. RF-013: ultimas ejecuciones de n8n.
export function EstadisticasPage() {
  const [filtro, setFiltro] = useState({ desde: "", hasta: "" });
  const [datos, setDatos] = useState(null);
  const [automatizaciones, setAutomatizaciones] = useState([]);
  const [error, setError] = useState("");

  function cargar(f = filtro) {
    setError("");
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v));
    return Promise.all([
      http.get("/admin/estadisticas", { params }),
      http.get("/admin/estadisticas/automatizaciones"),
    ])
      .then(([resEstadisticas, resAutomatizaciones]) => {
        setDatos(resEstadisticas.data);
        setAutomatizaciones(resAutomatizaciones.data.ejecuciones);
      })
      .catch((err) => setError(err.response?.data?.message || "No fue posible cargar las estadísticas."));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const citas = datos?.citas;
  const eventos = datos?.eventos;
  const maximoEvento = Math.max(0, ...(datos?.eventosDetalle || []).map((e) => e.inscritos));
  const filasCitas = (datos?.citasPorServicio || []).map((s) => ({
    ...s,
    asistieron: s.atendidas,
    noAsistieron: s.noAsistieron,
    sinRegistrar: s.agendadas,
  }));
  const maximoServicio = Math.max(0, ...filasCitas.map((s) => s.atendidas + s.noAsistieron + s.agendadas));

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-semibold text-primary mb-1">Estadísticas</h1>
      <p className="text-gray-500 mb-6">Participación y asistencia de los estudiantes a citas y eventos.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          cargar();
        }}
        className="flex items-end gap-3 mb-8 flex-wrap"
      >
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Desde
          <input type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Hasta
          <input type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} className={campo} />
        </label>
        <button type="submit" className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors">
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => {
            const vacio = { desde: "", hasta: "" };
            setFiltro(vacio);
            cargar(vacio);
          }}
          className="text-sm border border-gray-200 rounded-full px-4 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Todo el periodo
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}
      {!datos && !error && <p className="text-gray-500">Cargando estadísticas...</p>}

      {datos && !datos.hayDatos && (
        <p className="text-sm text-gray-600 bg-gray-100 rounded-md p-3 mb-6">
          No hay información de citas ni eventos para este filtro.
        </p>
      )}

      {datos && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Indicador titulo="Estudiantes registrados" valor={datos.estudiantesRegistrados} />
            <Indicador
              titulo="Citas"
              valor={citas.total}
              detalle={`${citas.atendidas} atendidas · ${citas.noAsistieron} no asistieron · ${citas.canceladas} canceladas`}
            />
            <Indicador titulo="Asistencia a citas" valor={formatoTasa(citas.tasaAsistencia)} detalle="Sobre citas con asistencia registrada" />
            <Indicador
              titulo="Asistencia a eventos"
              valor={formatoTasa(eventos.tasaAsistencia)}
              detalle={`${eventos.inscritos} inscritos en ${eventos.eventos} eventos`}
            />
          </div>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-ink-900">Asistencia por evento</h2>
            <p className="text-xs text-gray-500 mb-4">Inscritos confirmados de eventos publicados o cerrados.</p>
            <Leyenda />
            {datos.eventosDetalle.length === 0 ? (
              <p className="text-sm text-gray-500">No hay eventos en este periodo.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {datos.eventosDetalle.map((evento) => (
                  <div key={evento.id} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-6 gap-y-1 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{evento.nombre}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {formatearFecha(evento.fecha)} · {evento.inscritos}/{evento.cupos} inscritos
                      </p>
                    </div>
                    <div>
                      <BarraAsistencia fila={evento} maximo={maximoEvento} />
                      <p className="text-xs text-gray-500 mt-1 tabular-nums">
                        {evento.asistieron} asistieron · {evento.noAsistieron} no asistieron · {evento.sinRegistrar} sin registrar
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-ink-900">Citas por servicio</h2>
            <p className="text-xs text-gray-500 mb-4">"Sin registrar" son citas aún agendadas. Las canceladas se muestran aparte.</p>
            <Leyenda />
            {filasCitas.length === 0 ? (
              <p className="text-sm text-gray-500">No hay citas en este periodo.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {filasCitas.map((fila) => (
                  <div key={fila.servicio} className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-6 gap-y-1 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{fila.servicio}</p>
                      <p className="text-xs text-gray-500">
                        {fila.total} citas · asistencia {formatoTasa(fila.tasaAsistencia)}
                      </p>
                    </div>
                    <div>
                      <BarraAsistencia fila={fila} maximo={maximoServicio} />
                      <p className="text-xs text-gray-500 mt-1 tabular-nums">
                        {fila.atendidas} atendidas · {fila.noAsistieron} no asistieron · {fila.agendadas} agendadas ·{" "}
                        {fila.canceladas} canceladas
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-ink-900">Automatizaciones (n8n)</h2>
            <p className="text-xs text-gray-500 mb-4">
              Últimos envíos a n8n desde que se inició el servidor. Un fallo no afecta la cita o inscripción.
            </p>
            {automatizaciones.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no se han ejecutado automatizaciones.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {automatizaciones.slice(0, 10).map((a, i) => (
                  <li key={`${a.fecha}-${i}`} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-mono text-xs text-ink-900">{a.tipo}</span>
                    <span className="text-xs text-gray-500">{new Date(a.fecha).toLocaleString("es-CO")}</span>
                    <span
                      className={`text-xs font-medium rounded-full px-3 py-0.5 ${
                        a.estado === "exitosa"
                          ? "bg-emerald-50 text-emerald-700"
                          : a.estado === "fallida"
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      title={a.detalle || ""}
                    >
                      {a.estado === "exitosa" ? "✓ Exitosa" : a.estado === "fallida" ? "✕ Fallida" : "– Omitida"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
