import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { formatearFecha, formatearHora, fechaLarga } from "../../lib/format";
import { imagenDeEvento, respaldoDeFoto } from "../../lib/imagenes";
import { Icono } from "../../components/Iconos";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
function usePorVista() {
  const calcular = () => (typeof window !== "undefined" && window.innerWidth >= 1280 ? 4 : 3);
  const [n, setN] = useState(calcular);
  useEffect(() => {
    const alCambiar = () => setN(calcular());
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);
  return n;
}

function diaMes(fechaIso) {
  const fecha = new Date(fechaIso);
  return { dia: String(fecha.getUTCDate()).padStart(2, "0"), mes: MESES[fecha.getUTCMonth()] };
}

function hoyLargo() {
  const texto = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Inicio del panel Estudiante (rediseño): saludo, proxima cita, carrusel de
// eventos con inscripcion directa (RF-010), accesos rapidos y asistente.
export function InicioEstudiante() {
  const { usuario } = useAuth();
  const primerNombre = usuario?.nombre?.split(" ")[0];
  const [proximaCita, setProximaCita] = useState(undefined);
  const [eventos, setEventos] = useState(null);
  const [inicio, setInicio] = useState(0);
  const [procesando, setProcesando] = useState(null);
  const [aviso, setAviso] = useState("");
  const POR_VISTA = usePorVista();

  function cargarEventos() {
    return http
      .get("/eventos")
      .then((res) => setEventos(res.data.eventos))
      .catch(() => setEventos([]));
  }

  useEffect(() => {
    http
      .get("/citas/mias")
      .then((res) => {
        const agendadas = res.data.citas
          .filter((c) => c.estado === "Agendada")
          .sort((a, b) => new Date(a.horario?.fecha) - new Date(b.horario?.fecha));
        setProximaCita(agendadas[0] || null);
      })
      .catch(() => setProximaCita(null));
    cargarEventos();
  }, []);

  async function alternarInscripcion(evento) {
    setAviso("");
    setProcesando(evento.id);
    const inscrito = evento.miInscripcion?.estado === "Confirmada";
    try {
      if (inscrito) {
        await http.patch(`/eventos/${evento.id}/inscripciones/cancelar`);
        setAviso(`Cancelaste tu inscripción a "${evento.nombre}".`);
      } else {
        await http.post(`/eventos/${evento.id}/inscripciones`);
        setAviso(`¡Listo! Quedaste inscrito/a en "${evento.nombre}".`);
      }
    } catch (err) {
      setAviso(err.response?.data?.message || "No fue posible completar la acción.");
    } finally {
      await cargarEventos();
      setProcesando(null);
    }
  }

  const total = eventos?.length || 0;
  const maxInicio = Math.max(0, total - POR_VISTA);
  const desde = Math.min(inicio, maxInicio);
  const visibles = (eventos || []).slice(desde, desde + POR_VISTA);

  return (
    <>
      {/* Banda de bienvenida a todo el ancho, con la próxima cita dentro */}
      <section className="relative overflow-hidden bg-primary-dark text-white">
        <svg viewBox="0 0 400 400" width="520" height="520" aria-hidden="true" className="absolute -right-28 -top-40 pointer-events-none">
          <circle cx="200" cy="200" r="190" fill="none" stroke="rgba(127,232,255,0.30)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="130" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
        </svg>
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14 flex gap-8 lg:gap-14 flex-wrap items-center">
          <div className="flex-[999_1_480px] min-w-0 flex flex-col gap-3.5">
            <h1 className="m-0 text-[40px] sm:text-[52px] leading-[1.05] font-extrabold text-white">
              Hola, <span className="text-cyan">{primerNombre}.</span>
            </h1>
            <p className="m-0 text-[15px] font-semibold text-[#B9C7DE]">{hoyLargo()}</p>
            <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC] max-w-[520px]">
              ¿Cómo te podemos acompañar hoy? Agenda una cita, revisa tus eventos o pregúntale al asistente.
            </p>
            <div className="flex gap-3 flex-wrap mt-2">
              <Link to="/estudiante/agendar" className="bg-cyan text-primary-dark font-extrabold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center hover:brightness-95">
                Pedir una cita
              </Link>
              <Link to="/estudiante/asistente" className="border-[1.5px] border-white/45 text-white font-semibold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center hover:bg-white/10">
                Preguntar al asistente
              </Link>
            </div>
          </div>

          <section aria-labelledby="titulo-proxima-cita" className="flex-[1_1_340px] max-w-[460px] min-w-0 bg-white text-ink-900 rounded-[24px] p-6 sm:p-7 flex flex-col gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <h2 id="titulo-proxima-cita" className="m-0 font-sans text-lg font-bold text-primary">Tu próxima cita</h2>
            {proximaCita === undefined && <p className="m-0 text-ink-500">Cargando…</p>}
            {proximaCita === null && (
              <>
                <p className="m-0 text-ink-600">No tienes citas agendadas.</p>
                <Link to="/estudiante/agendar" className="self-start font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-primary-light text-primary hover:bg-[#E2E9F6]">
                  Agendar una cita
                </Link>
              </>
            )}
            {proximaCita && (
              <>
                <div className="flex gap-4 items-center">
                  <div className="shrink-0 w-[68px] h-[76px] rounded-2xl bg-primary-light text-primary flex flex-col items-center justify-center tabular-nums">
                    <span className="font-display text-[28px] font-extrabold leading-none">{diaMes(proximaCita.horario?.fecha).dia}</span>
                    <span className="text-xs font-bold tracking-widest text-accent">{diaMes(proximaCita.horario?.fecha).mes}</span>
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-[17px] leading-snug text-primary">{proximaCita.horario?.servicio?.nombre}</strong>
                    <span className="text-sm text-ink-500 tabular-nums">
                      {fechaLarga(proximaCita.horario?.fecha).split(",")[0]} · {formatearHora(proximaCita.horario?.horaInicio)} a{" "}
                      {formatearHora(proximaCita.horario?.horaFin)}
                    </span>
                  </div>
                </div>
                <Link to="/estudiante/mis-citas" className="self-start font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-primary-light text-primary hover:bg-[#E2E9F6]">
                  Ver mis citas
                </Link>
              </>
            )}
          </section>
        </div>
      </section>

    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-20 flex flex-col gap-8">
      {/* Carrusel de eventos */}
      <section aria-label="Eventos para ti">
        <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
          <h2 className="m-0 text-[32px] font-extrabold">Eventos para ti</h2>
          {total > POR_VISTA && (
            <div className="flex gap-2.5 items-center">
              <span className="text-sm text-ink-500">
                {desde + 1}–{Math.min(desde + POR_VISTA, total)} de {total}
              </span>
              <button
                type="button"
                onClick={() => setInicio(Math.max(0, desde - 1))}
                disabled={desde === 0}
                aria-label="Eventos anteriores"
                className="w-11 h-11 rounded-full border-[1.5px] border-gray-200 bg-white text-primary flex items-center justify-center disabled:opacity-40"
              >
                <Icono nombre="izquierda" size={18} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setInicio(Math.min(maxInicio, desde + 1))}
                disabled={desde >= maxInicio}
                aria-label="Más eventos"
                className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"
              >
                <Icono nombre="derecha" size={18} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {aviso && <p className="text-sm text-primary bg-primary-light rounded-xl p-3 mb-5">{aviso}</p>}
        {!eventos && <p className="text-ink-500">Cargando eventos...</p>}
        {eventos && eventos.length === 0 && (
          <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">Por ahora no hay eventos publicados.</p>
        )}

        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {visibles.map((evento) => {
            const { dia, mes } = diaMes(evento.fecha);
            const imagen = imagenDeEvento(evento);
            const inscrito = evento.miInscripcion?.estado === "Confirmada";
            const ocupacion = Math.round((evento.inscritos / evento.cupos) * 100);
            const bloqueado = !inscrito && (!evento.inscripcionAbierta || evento.cuposDisponibles === 0);
            return (
              <article key={evento.id} className="bg-white border border-gray-200 rounded-3xl overflow-hidden flex flex-col">
                <div className="relative h-[190px] p-4 flex justify-between items-start bg-primary-soft">
                  <img src={imagen.src} alt={imagen.alt} onError={respaldoDeFoto(evento)} className="absolute inset-0 w-full h-full object-cover" />
                  <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,42,91,0)_40%,rgba(11,42,91,0.55)_100%)]" />
                  <span className="relative bg-white text-primary rounded-[14px] px-3 py-2 text-center leading-none">
                    <strong className="block font-display text-[22px]">{dia}</strong>
                    <span className="text-[11px] font-bold tracking-widest">{mes}</span>
                  </span>
                  {inscrito && (
                    <span className="relative bg-white text-[#1D6B4A] text-xs font-bold rounded-full px-3 py-1.5">Inscrito/a</span>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-2.5 flex-1">
                  <h3 className="m-0 text-lg font-bold text-primary">{evento.nombre}</h3>
                  <p className="m-0 text-sm text-ink-500">
                    {formatearHora(evento.horaInicio)}
                    {evento.lugar ? ` · ${evento.lugar}` : ""}
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-1.5 rounded-full bg-primary-light overflow-hidden">
                      <div className="h-full bg-primary-soft" style={{ width: `${ocupacion}%` }} />
                    </div>
                    <span className="text-[13px] font-bold text-primary">{evento.cuposDisponibles} cupos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => alternarInscripcion(evento)}
                    disabled={procesando === evento.id || bloqueado}
                    className={`mt-auto min-h-[44px] rounded-full font-bold text-sm transition-colors disabled:bg-gray-100 disabled:text-ink-500 disabled:border-transparent ${
                      inscrito
                        ? "border-[1.5px] border-[#1D6B4A] bg-[#E7F4EE] text-[#1D6B4A]"
                        : "bg-primary text-white hover:bg-primary-dark"
                    }`}
                  >
                    {inscrito
                      ? "Cancelar inscripción"
                      : !evento.inscripcionAbierta
                      ? "Inscripciones cerradas"
                      : evento.cuposDisponibles === 0
                      ? "Sin cupos"
                      : "Inscribirme"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Asistente */}
      <div className="flex">
        <Link
          to="/estudiante/asistente"
          className="flex-1 min-w-0 bg-white border border-gray-200 rounded-[22px] p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 hover:shadow-md hover:border-primary/30 transition-all"
        >
          <span className="flex gap-2.5 items-center">
            <span className="w-9 h-9 rounded-full bg-primary text-gold flex items-center justify-center">
              <Icono nombre="chat" size={18} strokeWidth={2} />
            </span>
            <strong className="text-base text-primary">Asistente de orientación</strong>
          </span>
          <span className="bg-cream rounded-[16px_16px_16px_4px] px-3.5 py-3 text-sm leading-normal text-ink-900 sm:max-w-[520px]">
            Hola, {primerNombre}. Puedo contarte qué servicios hay, cómo agendar o qué eventos se vienen.
          </span>
          <span className="sm:ml-auto inline-flex items-center gap-1.5 font-bold text-sm text-primary-soft whitespace-nowrap">
            Abrir el asistente
            <Icono nombre="flecha" size={17} strokeWidth={2.2} />
          </span>
        </Link>
      </div>
    </main>
    </>
  );
}
