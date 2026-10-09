import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora } from "../../lib/format";

const ESTADO_ESTILOS = {
  Agendada: "bg-emerald-50 text-emerald-700",
  Cancelada: "bg-gray-100 text-gray-500",
  Atendida: "bg-sky-50 text-sky-700",
  NoAsistio: "bg-amber-50 text-amber-700",
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// RF-008 · HU-15, HU-16: agenda administrativa del dia (con filtro por
// fecha) y registro de asistencia de cada cita agendada.
export function AgendaAdminPage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(null);

  function cargarAgenda(fechaFiltro) {
    setCitas(null);
    return http
      .get("/admin/citas", { params: fechaFiltro ? { fecha: fechaFiltro } : {} })
      .then((res) => setCitas(res.data.citas))
      .catch(() => setError("No fue posible cargar la agenda."));
  }

  useEffect(() => {
    cargarAgenda(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buscar(e) {
    e.preventDefault();
    setError("");
    cargarAgenda(fecha);
  }

  async function registrarAsistencia(citaId, asistio) {
    setError("");
    setRegistrando(citaId);
    try {
      await http.patch(`/admin/citas/${citaId}/asistencia`, { asistio });
      await cargarAgenda(fecha);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible registrar la asistencia.");
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-semibold text-primary mb-1">Agenda de citas</h1>
      <p className="text-gray-500 mb-6">Consulta las citas agendadas y registra la asistencia de cada estudiante.</p>

      <form onSubmit={buscar} className="flex items-end gap-3 mb-8 flex-wrap">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <button
          type="submit"
          className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors"
        >
          Buscar
        </button>
        <button
          type="button"
          onClick={() => {
            setFecha("");
            setError("");
            cargarAgenda("");
          }}
          className="text-sm border border-gray-200 rounded-full px-4 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Ver todas
        </button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}

      {!citas && !error && <p className="text-gray-500">Cargando agenda...</p>}
      {citas && citas.length === 0 && <p className="text-gray-500">No hay citas para este filtro.</p>}

      <div className="flex flex-col gap-4">
        {citas?.map((cita) => (
          <div
            key={cita.id}
            className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between flex-wrap gap-4"
          >
            <div>
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">
                {cita.horario?.servicio?.nombre}
              </p>
              <p className="font-semibold text-ink-900">{cita.usuario?.nombre}</p>
              <p className="text-xs text-gray-500 mb-1">{cita.usuario?.emailInstitucional}</p>
              <p className="text-sm text-gray-500 capitalize">
                {formatearFecha(cita.horario?.fecha)} · {formatearHora(cita.horario?.horaInicio)} –{" "}
                {formatearHora(cita.horario?.horaFin)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium rounded-full px-3 py-1 ${
                  ESTADO_ESTILOS[cita.estado] || "bg-gray-100 text-gray-600"
                }`}
              >
                {cita.estado}
              </span>
              {cita.estado === "Agendada" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => registrarAsistencia(cita.id, true)}
                    disabled={registrando === cita.id}
                    className="text-sm font-medium bg-emerald-50 text-emerald-700 rounded-full px-4 py-1.5 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                  >
                    Asistió
                  </button>
                  <button
                    onClick={() => registrarAsistencia(cita.id, false)}
                    disabled={registrando === cita.id}
                    className="text-sm font-medium bg-amber-50 text-amber-700 rounded-full px-4 py-1.5 hover:bg-amber-100 transition-colors disabled:opacity-60"
                  >
                    No asistió
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
