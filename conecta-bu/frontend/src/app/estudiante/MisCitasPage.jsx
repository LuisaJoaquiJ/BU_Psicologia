import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora } from "../../lib/format";

const ESTADO_ESTILOS = {
  Agendada: "bg-emerald-50 text-emerald-700",
  Cancelada: "bg-gray-100 text-gray-500",
  Atendida: "bg-sky-50 text-sky-700",
  NoAsistio: "bg-amber-50 text-amber-700",
};

// RF-006 · HU-11, HU-12: consulta y cancelacion de citas propias.
export function MisCitasPage() {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [cancelando, setCancelando] = useState(null);

  function cargarCitas() {
    return http
      .get("/citas/mias")
      .then((res) => setCitas(res.data.citas))
      .catch(() => setError("No fue posible cargar tus citas."));
  }

  useEffect(() => {
    cargarCitas();
  }, []);

  async function cancelar(citaId) {
    if (!window.confirm("¿Seguro que quieres cancelar esta cita?")) return;
    setError("");
    setCancelando(citaId);
    try {
      await http.patch(`/citas/${citaId}/cancelar`);
      await cargarCitas();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible cancelar la cita.");
    } finally {
      setCancelando(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-ink-900">Mis citas</h1>
        <Link
          to="/estudiante/agendar"
          className="text-sm font-medium bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors"
        >
          Agendar nueva cita
        </Link>
      </div>
      <p className="text-gray-500 mb-8">Consulta o cancela tus citas de orientación.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}

      {!citas && !error && <p className="text-gray-500">Cargando tus citas...</p>}

      {citas && citas.length === 0 && (
        <p className="text-gray-500">
          Todavía no tienes citas registradas.{" "}
          <Link to="/estudiante/agendar" className="text-primary font-medium hover:underline">
            Agenda la primera
          </Link>
          .
        </p>
      )}

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
              <p className="font-semibold text-ink-900 capitalize mt-1">
                {formatearFecha(cita.horario?.fecha)}
              </p>
              <p className="text-sm text-gray-500">
                {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
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
                <button
                  onClick={() => cancelar(cita.id)}
                  disabled={cancelando === cita.id}
                  className="text-sm font-medium border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {cancelando === cita.id ? "Cancelando..." : "Cancelar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
