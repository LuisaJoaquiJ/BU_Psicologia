import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Aviso, Estado, Vacio, botonPrimario, botonSecundario } from "../../components/ui";

// HU-12: solo se cancela con al menos 24 horas de anticipacion (el backend
// lo valida; aqui se avisa antes para no ofrecer un boton que va a fallar).
const HORAS_MINIMAS_CANCELACION = 24;

function horasHastaLaCita(horario) {
  if (!horario?.fecha) return Infinity;
  const fecha = new Date(horario.fecha);
  const hora = horario.horaInicio ? new Date(horario.horaInicio) : new Date(0);
  // Hora de Bogota (UTC-5): la hora guardada es la hora local del horario.
  const inicio = Date.UTC(
    fecha.getUTCFullYear(),
    fecha.getUTCMonth(),
    fecha.getUTCDate(),
    hora.getUTCHours() + 5,
    hora.getUTCMinutes()
  );
  return (inicio - Date.now()) / 3600000;
}

// RF-006 · HU-11, HU-12: consulta y cancelacion de citas propias.
export function MisCitasPage({ modulo = "desarrollo-humano" }) {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [cancelando, setCancelando] = useState(null);

  function cargarCitas() {
    return http
      .get("/citas/mias", { params: { modulo } })
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

  const agendar = modulo === "salud" ? "/mi-salud" : "/estudiante/agendar";
  const proximas = (citas || []).filter((c) => c.estado === "Agendada");
  // Historial: lo mas reciente primero.
  const historial = (citas || [])
    .filter((c) => c.estado !== "Agendada")
    .sort((a, b) => (b.horario?.fecha || "").localeCompare(a.horario?.fecha || ""));

  function Fila({ cita }) {
    const cancelable = cita.estado === "Agendada" && horasHastaLaCita(cita.horario) >= HORAS_MINIMAS_CANCELACION;
    return (
      <li className="p-4 sm:p-5 flex items-center justify-between flex-wrap gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="m-0 font-bold text-ink-900">{fechaLarga(cita.horario?.fecha)}</p>
          <p className="m-0 mt-0.5 text-sm text-ink-500">
            <span className="tabular-nums">
              {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
            </span>
            {cita.horario?.servicio?.nombre ? ` · ${cita.horario.servicio.nombre}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Estado estado={cita.estado} />
          {cita.estado === "Agendada" &&
            (cancelable ? (
              <button onClick={() => cancelar(cita.id)} disabled={cancelando === cita.id} className={botonSecundario}>
                {cancelando === cita.id ? "Cancelando…" : "Cancelar cita"}
              </button>
            ) : (
              <span className="text-[13px] text-ink-500 max-w-[240px]">
                Faltan menos de 24 horas: para cancelar, comunícate con Bienestar.
              </span>
            ))}
        </div>
      </li>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
        <div>
          <h1 className="m-0 text-3xl sm:text-[34px] font-semibold">Mis citas</h1>
          <p className="mt-1.5 mb-0 text-ink-500">
            {modulo === "salud" ? "Tus citas de salud." : "Tus citas de orientación."} Puedes cancelar hasta 24 horas antes.
          </p>
        </div>
        <Link to={agendar} className={botonPrimario}>
          Agendar una cita
        </Link>
      </div>

      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {!citas && !error && <p className="text-ink-500">Cargando tus citas…</p>}

      {citas && citas.length === 0 && (
        <Vacio>
          Todavía no tienes citas.{" "}
          <Link to={agendar} className="font-bold text-primary-soft underline underline-offset-4">
            Agenda la primera
          </Link>
          .
        </Vacio>
      )}

      {citas && citas.length > 0 && (
        <div className="flex flex-col gap-9">
          <section aria-labelledby="proximas">
            <h2 id="proximas" className="m-0 mb-3 font-sans text-lg font-bold text-primary">
              Próximas
            </h2>
            {proximas.length ? (
              <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-[22px] divide-y divide-gray-200">
                {proximas.map((c) => (
                  <Fila key={c.id} cita={c} />
                ))}
              </ul>
            ) : (
              <Vacio>No tienes citas próximas.</Vacio>
            )}
          </section>
          {historial.length > 0 && (
            <section aria-labelledby="historial">
              <h2 id="historial" className="m-0 mb-3 font-sans text-lg font-bold text-primary">
                Historial
              </h2>
              <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-[22px] divide-y divide-gray-200">
                {historial.map((c) => (
                  <Fila key={c.id} cita={c} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
