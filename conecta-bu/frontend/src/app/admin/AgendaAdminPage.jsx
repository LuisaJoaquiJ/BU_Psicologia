import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Aviso, Campo, Estado, Vacio, botonPrimario, botonSecundario, claseCampoCorto } from "../../components/ui";

// Fecha de hoy en la hora local del navegador (Bogota). toISOString() da la
// fecha UTC, que despues de las 7 p. m. ya es la de manana.
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// RF-008 · HU-15, HU-16: agenda administrativa del dia (con filtro por
// fecha) y registro de asistencia de cada cita agendada.
export function AgendaAdminPage({ api = "/admin" }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(null);

  function cargarAgenda(fechaFiltro) {
    setCitas(null);
    return http
      .get(`${api}/citas`, { params: fechaFiltro ? { fecha: fechaFiltro } : {} })
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
      await http.patch(`${api}/citas/${citaId}/asistencia`, { asistio });
      await cargarAgenda(fecha);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible registrar la asistencia.");
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
      <h1 className="m-0 text-3xl sm:text-[34px] font-semibold">Agenda de citas</h1>
      <p className="mt-1.5 mb-7 text-ink-500">Consulta las citas agendadas y registra la asistencia de cada estudiante.</p>

      <form onSubmit={buscar} className="flex items-end gap-2.5 mb-8 flex-wrap">
        <Campo etiqueta="Fecha">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseCampoCorto} />
        </Campo>
        <button type="submit" className={botonPrimario}>
          Buscar
        </button>
        <button
          type="button"
          onClick={() => {
            setFecha("");
            setError("");
            cargarAgenda("");
          }}
          className={botonSecundario}
        >
          Ver todas
        </button>
      </form>

      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {!citas && !error && <p className="text-ink-500">Cargando agenda…</p>}
      {citas && citas.length === 0 && <Vacio>No hay citas para este filtro.</Vacio>}

      {citas && citas.length > 0 && (
        <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-[22px] divide-y divide-gray-200">
          {citas.map((cita) => (
            <li
              key={cita.id}
              className="p-4 sm:px-6 sm:py-4 grid gap-x-6 gap-y-2 items-center grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)_auto]"
            >
              <div className="tabular-nums">
                <p className="m-0 font-bold text-ink-900 whitespace-nowrap">
                  {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
                </p>
                {!fecha && <p className="m-0 text-[13px] text-ink-500">{fechaLarga(cita.horario?.fecha)}</p>}
              </div>
              <div className="min-w-0">
                <p className="m-0 font-semibold text-ink-900 truncate">{cita.usuario?.nombre}</p>
                <p className="m-0 text-[13px] text-ink-500 truncate">
                  {cita.horario?.servicio?.nombre}
                  {cita.usuario?.emailInstitucional ? ` · ${cita.usuario.emailInstitucional}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap md:justify-end">
                {cita.estado === "Agendada" ? (
                  <>
                    <button
                      onClick={() => registrarAsistencia(cita.id, true)}
                      disabled={registrando === cita.id}
                      className={botonPrimario}
                    >
                      <Icono nombre="check" size={17} strokeWidth={2.2} />
                      Asistió
                    </button>
                    <button
                      onClick={() => registrarAsistencia(cita.id, false)}
                      disabled={registrando === cita.id}
                      className={botonSecundario}
                    >
                      No asistió
                    </button>
                  </>
                ) : (
                  <Estado estado={cita.estado} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
