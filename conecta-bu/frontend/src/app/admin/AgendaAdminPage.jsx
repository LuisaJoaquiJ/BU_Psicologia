import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { iniciales } from "../../components/Navbar";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Aviso, Estado, Vacio } from "../../components/ui";

// Fecha de hoy en la hora local del navegador (Bogota). toISOString() da la
// fecha UTC, que despues de las 7 p. m. ya es la de manana.
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function moverDia(fecha, delta) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Colores de cada fila de la línea de tiempo según el estado de la cita.
const FILA = {
  Agendada: "bg-white border-[1.5px] border-[#D3DBE8]",
  Atendida: "bg-[#E6F4EE]",
  NoAsistio: "bg-[#FFF6E0]",
  Cancelada: "bg-cream text-ink-500",
};

// RF-008 · HU-15, HU-16: agenda del día como línea de tiempo. Al tocar una
// cita se abre su detalle a la derecha, donde se registra la asistencia.
export function AgendaAdminPage({ api = "/admin" }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [citas, setCitas] = useState(null);
  const [elegidaId, setElegidaId] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [registrando, setRegistrando] = useState(false);

  function cargarAgenda(f) {
    setCitas(null);
    setError("");
    return http
      .get(`${api}/citas`, { params: { fecha: f } })
      .then((res) => {
        setCitas(res.data.citas);
        const pendiente = res.data.citas.find((c) => c.estado === "Agendada");
        setElegidaId((id) => (res.data.citas.some((c) => c.id === id) ? id : (pendiente || res.data.citas[0])?.id || null));
      })
      .catch(() => setError("No pudimos cargar la agenda. Revisa tu conexión e intenta de nuevo."));
  }

  useEffect(() => {
    cargarAgenda(fecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  function irA(f) {
    setMensaje("");
    setFecha(f);
  }

  async function registrarAsistencia(cita, asistio) {
    setError("");
    setMensaje("");
    setRegistrando(true);
    try {
      await http.patch(`${api}/citas/${cita.id}/asistencia`, { asistio });
      setMensaje(`Quedó registrado que ${cita.usuario?.nombre?.split(" ")[0] || "el estudiante"} ${asistio ? "asistió" : "no asistió"} a su cita de las ${formatearHora(cita.horario?.horaInicio)}.`);
      await cargarAgenda(fecha);
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos registrar la asistencia. Intenta de nuevo.");
    } finally {
      setRegistrando(false);
    }
  }

  const elegida = citas?.find((c) => c.id === elegidaId);
  const pendientes = (citas || []).filter((c) => c.estado === "Agendada").length;
  const activas = (citas || []).filter((c) => c.estado !== "Cancelada").length;
  const esHoy = fecha === hoyISO();

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-center gap-5 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">{fechaLarga(fecha)}</h1>
          <p className="mt-0.5 mb-0 text-ink-500 tabular-nums">
            {citas
              ? `${activas} ${activas === 1 ? "cita" : "citas"}${pendientes ? ` · ${pendientes} ${pendientes === 1 ? "espera" : "esperan"} registro de asistencia` : ""}`
              : "Cargando…"}
          </p>
        </div>
        <div role="group" aria-label="Cambiar de día" className="flex items-center gap-1.5 bg-white p-1.5 rounded-full flex-wrap">
          <button type="button" aria-label="Día anterior" onClick={() => irA(moverDia(fecha, -1))} className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light">
            <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => irA(hoyISO())}
            className={`min-h-[44px] px-5 rounded-full font-extrabold ${esHoy ? "bg-primary-dark text-white" : "bg-cream text-primary hover:bg-primary-light"}`}
          >
            Hoy
          </button>
          <label className="flex items-center min-h-[44px] px-3 rounded-full bg-cream">
            <span className="sr-only">Ir a una fecha</span>
            <input type="date" value={fecha} onChange={(e) => e.target.value && irA(e.target.value)} className="bg-transparent font-bold text-primary-dark text-sm" />
          </label>
          <button type="button" aria-label="Día siguiente" onClick={() => irA(moverDia(fecha, 1))} className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light">
            <Icono nombre="derecha" size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="mb-5" role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-5">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {citas && citas.length === 0 && <Vacio>No hay citas este día. Usa las flechas para ver otro día.</Vacio>}

      {citas && citas.length > 0 && (
        <div className="flex gap-6 flex-wrap items-start">
          <ol aria-label="Citas del día" className="flex-[999_1_560px] min-w-0 list-none m-0 p-3 sm:p-5 bg-white rounded-[18px] tabular-nums">
            {citas.map((c) => {
              const activa = c.id === elegidaId;
              return (
                <li key={c.id} className="flex gap-3 sm:gap-4 py-2 border-b border-[#EEF2F7] last:border-b-0">
                  <span className={`shrink-0 w-[76px] sm:w-[92px] pt-3.5 font-extrabold text-sm sm:text-base ${c.estado === "Cancelada" ? "text-ink-500" : "text-ink-900"}`}>
                    {formatearHora(c.horario?.horaInicio)}
                  </span>
                  <button
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setElegidaId(c.id)}
                    className={`flex-1 min-w-0 flex justify-between items-center gap-3 flex-wrap text-left px-4 py-3 rounded-xl transition-shadow ${
                      activa ? "bg-primary-dark text-white" : FILA[c.estado] || "bg-white"
                    } ${activa ? "" : "hover:shadow-[0_4px_14px_rgba(11,35,71,0.10)]"}`}
                  >
                    <span className="min-w-0">
                      <strong className={`block truncate ${c.estado === "Cancelada" && !activa ? "line-through" : ""}`}>{c.usuario?.nombre}</strong>
                      <span className={`block text-sm truncate ${activa ? "text-[#D9E2F2]" : "text-ink-600"}`}>{c.horario?.servicio?.nombre}</span>
                    </span>
                    {c.estado === "Agendada" ? (
                      <span className={`text-sm font-extrabold ${activa ? "text-cyan" : "text-primary"}`}>Registrar asistencia</span>
                    ) : activa ? (
                      <span className="text-sm font-extrabold text-cyan">{{ Atendida: "Asistió", NoAsistio: "No asistió", Cancelada: "Cancelada" }[c.estado]}</span>
                    ) : (
                      <Estado estado={c.estado} />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          {elegida && (
            <aside aria-labelledby="detalle-cita" className="flex-[1_1_340px] min-w-0 bg-white rounded-[18px] p-6 flex flex-col gap-4 lg:sticky lg:top-4">
              <div className="flex gap-3.5 items-center">
                <span className="w-[52px] h-[52px] rounded-full bg-primary-light text-primary font-extrabold text-lg flex items-center justify-center shrink-0">
                  {iniciales(elegida.usuario?.nombre)}
                </span>
                <div className="min-w-0">
                  <h2 id="detalle-cita" className="m-0 text-[22px] font-extrabold leading-tight">{elegida.usuario?.nombre}</h2>
                  <span className="text-sm text-ink-500 break-all">{elegida.usuario?.emailInstitucional}</span>
                </div>
              </div>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px] tabular-nums">
                <dt className="text-ink-500">Hora</dt>
                <dd className="m-0 font-bold">
                  {formatearHora(elegida.horario?.horaInicio)} a {formatearHora(elegida.horario?.horaFin)}
                </dd>
                <dt className="text-ink-500">Servicio</dt>
                <dd className="m-0 font-bold">{elegida.horario?.servicio?.nombre}</dd>
                <dt className="text-ink-500">Estado</dt>
                <dd className="m-0">
                  <Estado estado={elegida.estado} />
                </dd>
              </dl>
              {elegida.estado === "Agendada" ? (
                <div>
                  <p className="m-0 mb-2.5 font-extrabold">¿Asistió a la cita?</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => registrarAsistencia(elegida, true)}
                      disabled={registrando}
                      className="min-h-[52px] rounded-full bg-primary text-white font-extrabold hover:bg-primary-dark disabled:opacity-60"
                    >
                      Sí, asistió
                    </button>
                    <button
                      type="button"
                      onClick={() => registrarAsistencia(elegida, false)}
                      disabled={registrando}
                      className="min-h-[52px] rounded-full border-[1.5px] border-primary text-primary font-extrabold hover:bg-primary-light disabled:opacity-60"
                    >
                      No asistió
                    </button>
                  </div>
                  <p className="mt-2.5 mb-0 text-sm text-ink-500">Una vez registrada, la asistencia no se puede cambiar desde aquí.</p>
                </div>
              ) : (
                <p className="m-0 text-sm text-ink-500">
                  {elegida.estado === "Cancelada" ? "El estudiante canceló esta cita; el horario volvió a quedar libre." : "La asistencia de esta cita ya está registrada."}
                </p>
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
