import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora } from "../../lib/format";
import { IMAGENES } from "../../lib/imagenes";
import { Icono } from "../../components/Iconos";

// Salud integral para el estudiante: servicios, horarios para agendar una
// cita de salud y sus participaciones en jornadas y campañas.
export function SaludEstudiantePage() {
  const [servicios, setServicios] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [participaciones, setParticipaciones] = useState(null);
  const [servicioId, setServicioId] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(null);

  function cargarHorarios() {
    return http
      .get("/citas/horarios-disponibles", { params: { modulo: "salud" } })
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setHorarios([]));
  }

  useEffect(() => {
    http.get("/servicios", { params: { modulo: "salud" } }).then((res) => setServicios(res.data.servicios)).catch(() => setServicios([]));
    http.get("/salud/estudiante/mis-participaciones").then((res) => setParticipaciones(res.data)).catch(() => setParticipaciones(null));
    cargarHorarios();
  }, []);

  async function agendar(horario) {
    setError("");
    setExito("");
    setEnviando(horario.id);
    try {
      await http.post("/citas", { horarioId: horario.id });
      setExito(`Tu cita de ${horario.servicio?.nombre} quedó agendada para el ${formatearFecha(horario.fecha)} a las ${formatearHora(horario.horaInicio)}.`);
      await cargarHorarios();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible agendar la cita.");
      await cargarHorarios();
    } finally {
      setEnviando(null);
    }
  }

  const visibles = (horarios || []).filter((h) => !servicioId || h.servicioId === servicioId).slice(0, 24);

  return (
    <main className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-8 pb-16 flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[28px] bg-primary text-white isolate">
        <img src={IMAGENES.salud.src} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover -z-10 opacity-40" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(7,29,64,0.96)_0%,rgba(11,42,91,0.85)_55%,rgba(11,42,91,0.5)_100%)]" />
        <div className="px-7 py-10 sm:px-12 sm:py-12 max-w-[640px]">
          <p className="m-0 mb-2 text-[13px] font-bold tracking-[0.14em] uppercase text-gold">Salud integral</p>
          <h1 className="m-0 text-white text-[34px] sm:text-[44px] leading-tight font-semibold">Tu salud también es parte de tu carrera</h1>
          <p className="mt-3 mb-0 text-[#D6DDEC] text-lg">
            Agenda una consulta de enfermería o médica en la Unidad de Salud Integral. En una emergencia llama a la línea 123.
          </p>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
          <div>
            <p className="m-0 mb-1.5 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">Agenda tu cita</p>
            <h2 className="m-0 text-[28px] font-semibold">Horarios disponibles</h2>
          </div>
          <Link to="/estudiante/mis-citas" className="text-sm font-bold text-primary-soft">
            Mis citas →
          </Link>
        </div>
        {servicios && servicios.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-5">
            {[{ id: "", nombre: "Todos" }, ...servicios].map((s) => (
              <button
                key={s.id || "todos"}
                type="button"
                onClick={() => setServicioId(s.id)}
                aria-pressed={servicioId === s.id}
                className={`text-sm font-semibold rounded-full px-4 min-h-[40px] border ${
                  servicioId === s.id ? "bg-primary text-white border-primary" : "bg-white text-ink-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
        {exito && <p className="text-sm text-[#0B6B61] bg-[#E3F4F1] rounded-xl p-3 mb-4">{exito}</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mb-4">{error}</p>}
        {!horarios && <div className="h-32 bg-white/60 border border-gray-200 rounded-[22px] animate-pulse" />}
        {horarios && visibles.length === 0 && (
          <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">No hay horarios de salud disponibles por ahora. Vuelve a consultar pronto.</p>
        )}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {visibles.map((h) => (
            <article key={h.id} className="bg-white border border-gray-200 rounded-[20px] p-5 flex flex-col gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-wide text-accent">{h.servicio?.nombre}</p>
              <p className="m-0 font-bold text-ink-900 capitalize">{formatearFecha(h.fecha)}</p>
              <p className="m-0 text-sm text-ink-500">
                {formatearHora(h.horaInicio)} – {formatearHora(h.horaFin)}
              </p>
              <button
                type="button"
                onClick={() => agendar(h)}
                disabled={enviando === h.id}
                className="mt-2 text-sm font-bold bg-primary text-white rounded-full px-4 min-h-[42px] hover:bg-primary-dark disabled:opacity-60"
              >
                {enviando === h.id ? "Agendando..." : "Agendar"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-[22px] p-6">
          <h2 className="m-0 mb-4 font-sans text-lg font-bold text-primary">Servicios de la Unidad de Salud</h2>
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {(servicios || []).map((s) => (
              <li key={s.id} className="flex gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#E3F4F1] text-[#0B6B61] flex items-center justify-center shrink-0">
                  <Icono nombre="pulso" size={20} />
                </span>
                <span>
                  <strong className="block text-ink-900">{s.nombre}</strong>
                  <span className="text-sm text-ink-500">{s.descripcion}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-gray-200 rounded-[22px] p-6">
          <h2 className="m-0 mb-1 font-sans text-lg font-bold text-primary">Tus participaciones</h2>
          <p className="m-0 mb-4 text-sm text-ink-500">Jornadas, campañas y atenciones registradas con tu correo institucional.</p>
          {participaciones && !participaciones.vinculado && (
            <p className="m-0 text-sm text-ink-500 bg-gray-50 rounded-xl p-4">
              Aún no tienes participaciones asociadas a tu correo. Cuando asistas a una jornada, pide que registren tu correo institucional.
            </p>
          )}
          {participaciones?.vinculado && participaciones.participaciones.length === 0 && (
            <p className="m-0 text-sm text-ink-500 bg-gray-50 rounded-xl p-4">Todavía no hay participaciones registradas.</p>
          )}
          <ul className="list-none m-0 p-0 flex flex-col">
            {participaciones?.participaciones?.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2.5 border-t border-gray-100 first:border-t-0 text-sm">
                <span>
                  <strong className="block text-ink-900">{p.actividad}</strong>
                  <span className="text-ink-500">{p.categoria}</span>
                </span>
                <span className="text-ink-500 shrink-0 capitalize">{formatearFecha(p.fecha)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
