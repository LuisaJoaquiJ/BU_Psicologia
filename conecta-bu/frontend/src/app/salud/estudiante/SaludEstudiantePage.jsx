import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { formatearFecha, formatearHora, fechaLarga } from "../comunes/lib/format";
import { IMAGENES } from "../comunes/lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../comunes/componentes/ui";

// Salud integral para el estudiante (/mi-salud): horarios para agendar una
// cita de salud y servicios de la Unidad de Salud.
export function SaludEstudiantePage() {
  const [servicios, setServicios] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [servicioId, setServicioId] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [enviando, setEnviando] = useState(null);

  function cargarHorarios() {
    return http
      .get("/salud/estudiante/citas/horarios-disponibles")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setHorarios([]));
  }

  useEffect(() => {
    http.get("/salud/servicios").then((res) => setServicios(res.data.servicios)).catch(() => setServicios([]));
    cargarHorarios();
  }, []);

  async function agendar(horario) {
    setError("");
    setExito("");
    setEnviando(horario.id);
    try {
      await http.post("/salud/estudiante/citas", { horarioId: horario.id });
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
    <>
      <BandaInicio
        imagen={IMAGENES.salud.src}
        titulo={
          <>
            Tu salud también es parte de <span className="text-cyan">tu carrera.</span>
          </>
        }
        fecha={hoyLargo()}
        texto="Agenda una consulta de enfermería o médica en la Unidad de Salud Integral."
        acciones={
          <>
            <a href="#horarios" className={botonBandaPrincipal}>Ver horarios disponibles</a>
            <Link to="/mi-salud/mis-citas" className={botonBandaSecundario}>Mis citas</Link>
          </>
        }
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary">¿Es una emergencia?</h2>
            <div className="flex gap-4 items-center">
              <span className="shrink-0 w-[76px] h-[68px] rounded-2xl bg-[#FDECEC] text-[#9B1C1C] font-extrabold flex items-center justify-center tabular-nums text-[28px]">123</span>
              <span className="min-w-0 text-ink-600">
                <strong className="block text-[17px] text-primary">Llama a la línea 123</strong>
                No esperes una cita: la línea atiende las 24 horas.
              </span>
            </div>
          </>
        }
      />
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16 flex flex-col gap-8">

      <section id="horarios" className="scroll-mt-6">
        <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
          <div>
            <h2 className="m-0 text-[28px] font-extrabold">Horarios disponibles</h2>
          </div>
          <Link to="/mi-salud/mis-citas" className="text-sm font-bold text-primary-soft">
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
        {!horarios && <div className="h-32 bg-white/60 border border-gray-200 rounded-xl animate-pulse" />}
        {horarios && visibles.length === 0 && (
          <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">No hay horarios de salud disponibles por ahora. Vuelve a consultar pronto.</p>
        )}
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {visibles.map((h) => (
            <article key={h.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-2">
              <p className="m-0 text-xs font-bold uppercase tracking-wide text-accent">{h.servicio?.nombre}</p>
              <p className="m-0 font-bold text-ink-900">{fechaLarga(h.fecha)}</p>
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

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="m-0 mb-4 font-sans text-lg font-bold text-primary">Servicios de la Unidad de Salud</h2>
        <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-3">
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
      </section>
    </main>
    </>
  );
}

// Jornadas, campañas y atenciones en las que participó el estudiante (sin
// datos clínicos), asociadas por su correo institucional.
export function SaludParticipacionesPage() {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    http
      .get("/salud/estudiante/mis-participaciones")
      .then((res) => setDatos(res.data))
      .catch(() => setDatos({ vinculado: false, participaciones: [] }));
  }, []);
  return (
    <main className="max-w-[900px] mx-auto px-5 sm:px-8 pt-8 pb-16">
      <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Salud integral</p>
      <h1 className="m-0 text-3xl font-extrabold">Mis participaciones</h1>
      <p className="mt-1.5 mb-6 text-ink-500">Jornadas, campañas y atenciones registradas con tu correo institucional.</p>
      {!datos && <div className="h-32 bg-white/60 border border-gray-200 rounded-xl animate-pulse" />}
      {datos && !datos.vinculado && (
        <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">
          Aún no tienes participaciones asociadas a tu correo. Cuando asistas a una jornada, pide que registren tu correo institucional.
        </p>
      )}
      {datos?.vinculado && datos.participaciones.length === 0 && (
        <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">Todavía no hay participaciones registradas.</p>
      )}
      {datos?.participaciones?.length > 0 && (
        <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-xl px-6 py-2">
          {datos.participaciones.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-3.5 border-t border-gray-100 first:border-t-0 text-sm">
              <span>
                <strong className="block text-ink-900">{p.actividad}</strong>
                <span className="text-ink-500">{p.categoria}</span>
              </span>
              <span className="text-ink-500 shrink-0">{fechaLarga(p.fecha)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
