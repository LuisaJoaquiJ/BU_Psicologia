import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora } from "../../lib/format";

// RF-004 / RF-005 · HU-07, HU-08, HU-09, HU-10: consulta de horarios
// disponibles y confirmacion de una cita.
export function AgendarCitaPage() {
  const navigate = useNavigate();
  const [horarios, setHorarios] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(null);

  function cargarHorarios() {
    return http
      .get("/citas/horarios-disponibles")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No fue posible cargar los horarios disponibles."));
  }

  useEffect(() => {
    cargarHorarios();
  }, []);

  async function confirmar(horarioId) {
    setError("");
    setEnviando(horarioId);
    try {
      await http.post("/citas", { horarioId });
      navigate("/estudiante/mis-citas");
    } catch (err) {
      // HU-09/HU-10: el backend puede rechazar porque alguien mas tomo el
      // horario, o porque ya tienes una cita activa. Mostramos el motivo y
      // refrescamos la lista para que no queden horarios "fantasma".
      setError(err.response?.data?.message || "No fue posible agendar la cita. Intenta de nuevo.");
      await cargarHorarios();
    } finally {
      setEnviando(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-semibold text-primary mb-1">Agendar una cita</h1>
      <p className="text-gray-500 mb-8">Elige un horario disponible y confirma tu cita de orientación.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}

      {!horarios && !error && <p className="text-gray-500">Cargando horarios...</p>}

      {horarios && horarios.length === 0 && (
        <p className="text-gray-500">No hay horarios disponibles por ahora. Vuelve a consultar más tarde.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {horarios?.map((horario) => (
          <div key={horario.id} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-3">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide">
              {horario.servicio?.nombre}
            </p>
            <p className="font-semibold text-ink-900 capitalize">{formatearFecha(horario.fecha)}</p>
            <p className="text-sm text-gray-500">
              {formatearHora(horario.horaInicio)} – {formatearHora(horario.horaFin)}
            </p>
            <button
              onClick={() => confirmar(horario.id)}
              disabled={enviando === horario.id}
              className="mt-2 text-sm font-medium bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {enviando === horario.id ? "Agendando..." : "Agendar este horario"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
