import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { formatearHora, fechaLarga } from "../comunes/lib/format";
import { imagenDeEvento, respaldoDeFoto } from "../comunes/lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
import { EstadoVacio, botonSecundario, Esqueleto } from "../comunes/componentes/ui";
import { useAvisos } from "../../../components/avisos/Avisos";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function usePorVista() {
  const calcular = () => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth >= 1280) return 3;
    if (window.innerWidth >= 768) return 2;
    return 1;
  };
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

const ESTILO_INSCRIBIRSE = "boton-liquido";
const ESTILO_CANCELAR =
  "border-[1.5px] border-gray-300 bg-white text-ink-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700";

export function InicioEstudiante() {
  const { usuario } = useAuth();
  const primerNombre = usuario?.nombre?.split(" ")[0] || "estudiante";
  const [proximaCita, setProximaCita] = useState(undefined);
  const [totalCitasActivas, setTotalCitasActivas] = useState(null);
  const [eventos, setEventos] = useState(null);
  const [soloInscritos, setSoloInscritos] = useState(false);
  const [inicio, setInicio] = useState(0);
  const [procesando, setProcesando] = useState(null);
  const avisos = useAvisos();
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
        setTotalCitasActivas(agendadas.length);
        setProximaCita(agendadas[0] || null);
      })
      .catch(() => {
        setTotalCitasActivas(0);
        setProximaCita(null);
      });
    cargarEventos();
  }, []);

  async function alternarInscripcion(evento) {
    setProcesando(evento.id);
    const inscrito = evento.miInscripcion?.estado === "Confirmada";
    try {
      if (inscrito) {
        await http.patch(`/eventos/${evento.id}/inscripciones/cancelar`);
        avisos.exito(`Cancelaste tu inscripción a "${evento.nombre}".`);
      } else {
        await http.post(`/eventos/${evento.id}/inscripciones`);
        avisos.exito(`¡Listo! Quedaste inscrito/a en "${evento.nombre}".`);
      }
    } catch (err) {
      avisos.error(err.response?.data?.message || "No fue posible completar la acción.");
    } finally {
      await cargarEventos();
      setProcesando(null);
    }
  }

  const listaBase = eventos || [];
  const inscritosCount = listaBase.filter((e) => e.miInscripcion?.estado === "Confirmada").length;
  const listaFiltrada = soloInscritos
    ? listaBase.filter((e) => e.miInscripcion?.estado === "Confirmada")
    : listaBase;

  const total = listaFiltrada.length;
  const maxInicio = Math.max(0, total - POR_VISTA);
  const desde = Math.min(inicio, maxInicio);
  const visibles = listaFiltrada.slice(desde, desde + POR_VISTA);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 sm:pt-7 pb-20">
      {/* 1. CABECERA AURORA */}
      <section className="relative overflow-hidden bg-[#071A38] text-white rounded-[30px] px-6 sm:px-10 pt-8 sm:pt-10 pb-24 sm:pb-28">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[620px] h-[620px] -left-40 -top-64 rounded-full blur-[32px] bg-[radial-gradient(circle,rgba(29,78,158,0.95)_0%,transparent_70%)] animate-deriva-a motion-reduce:animate-none" />
          <div className="absolute w-[560px] h-[560px] left-[38%] -top-32 rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(30,158,154,0.8)_0%,transparent_70%)] animate-deriva-b motion-reduce:animate-none" />
          <div className="absolute w-[520px] h-[520px] left-[18%] -bottom-[330px] rounded-full blur-[40px] bg-[radial-gradient(circle,rgba(201,162,63,0.55)_0%,transparent_70%)] animate-deriva-c motion-reduce:animate-none" />
        </div>

        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="min-w-0 flex flex-col gap-3">
            <span className="self-start inline-flex items-center px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8D6EC]">
              {hoyLargo()}
            </span>
            <h1 className="m-0 font-sans text-[38px] sm:text-[52px] leading-[1.03] tracking-[-0.035em] font-extrabold text-white">
              Hola, <span className="text-cyan">{primerNombre}.</span>
            </h1>
            <p className="m-0 text-[15px] sm:text-[17px] leading-relaxed text-[#D6DDEC] max-w-[540px]">
              Tu espacio de Bienestar Universitario. Gestiona tus citas, inscríbete a talleres o consulta al asistente.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap shrink-0">
            <Link
              to="/estudiante/agendar"
              className="bg-[linear-gradient(100deg,#7FE8FF_0%,#3FD0C9_55%,#1E9E9A_100%)] text-[#071A38] font-extrabold text-sm sm:text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center gap-2 shadow-[0_8px_22px_rgba(127,232,255,0.28)] transition-transform duration-200 hover:-translate-y-px motion-reduce:hover:translate-y-0"
            >
              Pedir una cita
              <Icono nombre="flecha" size={17} strokeWidth={2.2} />
            </Link>
            <Link
              to="/estudiante/servicios"
              className="bg-white/10 border-[1.5px] border-white/30 text-white font-bold text-sm sm:text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center hover:bg-white/[0.18] transition-colors"
            >
              Explorar servicios
            </Link>
          </div>
        </div>
      </section>

      {/* 2. FILA BENTO FLOTANTE (Sobrepuesta al hero) */}
      <section
        aria-label="Resumen personal"
        className="relative z-10 -mt-16 sm:-mt-20 px-2 sm:px-5 grid grid-cols-1 lg:grid-cols-12 gap-5"
      >
        {/* Tarjeta 1: Tu próxima cita (5 columnas) */}
        <article
          aria-labelledby="titulo-proxima-cita"
          className="lg:col-span-5 bg-white text-ink-900 rounded-[24px] p-6 border border-gray-200/80 shadow-[0_18px_40px_rgba(7,26,56,0.08)] flex flex-col justify-between gap-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="titulo-proxima-cita" className="m-0 font-sans text-base font-extrabold text-primary">
              Tu próxima cita
            </h2>
            <Link to="/estudiante/mis-citas" className="text-xs font-bold text-primary-soft hover:text-primary transition-colors">
              Ver todas →
            </Link>
          </div>

          {proximaCita === undefined && <Esqueleto forma="linea" etiqueta="Cargando tu próxima cita…" />}

          {proximaCita === null && (
            <div className="flex items-center justify-between gap-4 flex-wrap my-auto">
              <p className="m-0 text-sm text-ink-600">No tienes citas agendadas.</p>
              <Link
                to="/estudiante/agendar"
                className="font-bold text-sm px-4 min-h-[42px] inline-flex items-center rounded-full burbuja text-primary hover:bg-white"
              >
                Agendar ahora
              </Link>
            </div>
          )}

          {proximaCita && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-3.5 items-center min-w-0">
                <div className="shrink-0 w-16 h-[72px] rounded-2xl bg-primary-light text-primary flex flex-col items-center justify-center tabular-nums">
                  <span className="font-display text-[26px] font-extrabold leading-none">
                    {diaMes(proximaCita.horario?.fecha).dia}
                  </span>
                  <span className="text-[11px] font-bold tracking-widest text-accent mt-0.5">
                    {diaMes(proximaCita.horario?.fecha).mes}
                  </span>
                </div>
                <div className="min-w-0">
                  <strong className="block text-base sm:text-[17px] leading-snug text-primary truncate">
                    {proximaCita.horario?.servicio?.nombre}
                  </strong>
                  <span className="block text-xs sm:text-sm text-ink-500 tabular-nums mt-0.5">
                    {fechaLarga(proximaCita.horario?.fecha).split(",")[0]} · {formatearHora(proximaCita.horario?.horaInicio)} a{" "}
                    {formatearHora(proximaCita.horario?.horaFin)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </article>

        {/* Tarjeta 2: Asistente de orientación (4 columnas) */}
        <Link
          to="/estudiante/asistente"
          className="lg:col-span-4 group bg-cream text-ink-900 rounded-[24px] p-6 border border-amber-900/10 shadow-[0_18px_40px_rgba(7,26,56,0.08)] hover:shadow-[0_20px_44px_rgba(7,26,56,0.12)] transition-all flex flex-col justify-between gap-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary text-gold flex items-center justify-center shrink-0">
                <Icono nombre="chat" size={18} strokeWidth={2} />
              </span>
              <strong className="text-base font-extrabold text-primary">Asistente</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-soft group-hover:translate-x-0.5 transition-transform">
              Abrir chat
              <Icono nombre="flecha" size={15} strokeWidth={2.2} />
            </span>
          </div>

          <p className="m-0 bg-white rounded-[16px_16px_16px_4px] px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed text-ink-900 shadow-2xs">
            Hola, {primerNombre}. Pregúntame qué servicios hay, cómo agendar o qué eventos se vienen.
          </p>
        </Link>

        {/* Tarjeta 3: Actividad rápida (3 columnas) */}
        <div className="lg:col-span-3 bg-white text-ink-900 rounded-[24px] p-6 border border-gray-200/80 shadow-[0_18px_40px_rgba(7,26,56,0.08)] flex flex-col justify-between gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Tu actividad</span>

          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/estudiante/mis-citas"
              className="rounded-2xl bg-primary-light/60 hover:bg-primary-light p-3 transition-colors"
            >
              <strong className="block font-display text-2xl font-extrabold text-primary tabular-nums">
                {totalCitasActivas === null ? "—" : totalCitasActivas}
              </strong>
              <span className="text-xs font-semibold text-ink-600">
                {totalCitasActivas === 1 ? "Cita activa" : "Citas activas"}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setSoloInscritos((v) => !v);
                setInicio(0);
              }}
              className={`text-left rounded-2xl p-3 transition-colors ${
                soloInscritos
                  ? "bg-primary text-white"
                  : "bg-primary-light/60 hover:bg-primary-light text-primary"
              }`}
            >
              <strong className="block font-display text-2xl font-extrabold tabular-nums">
                {eventos === null ? "—" : inscritosCount}
              </strong>
              <span className={`text-xs font-semibold ${soloInscritos ? "text-white/85" : "text-ink-600"}`}>
                {inscritosCount === 1 ? "Evento inscrito" : "Eventos inscritos"}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. SECCIÓN DE EVENTOS */}
      <main className="mt-12 flex flex-col gap-5">
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <h2 id="titulo-eventos" className="m-0 text-[26px] sm:text-[32px] font-extrabold text-ink-900 tracking-tight">
              Eventos para ti
            </h2>
            <p className="mt-1 mb-0 text-sm text-ink-500">
              Talleres y actividades de Bienestar abiertos para inscripción.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro rápido */}
            {eventos && eventos.length > 0 && (
              <div className="inline-flex p-1 rounded-full bg-gray-100 border border-gray-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setSoloInscritos(false);
                    setInicio(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    !soloInscritos ? "bg-white text-primary shadow-2xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Todos ({listaBase.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSoloInscritos(true);
                    setInicio(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    soloInscritos ? "bg-white text-primary shadow-2xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  Mis inscritos ({inscritosCount})
                </button>
              </div>
            )}

            {/* Paginación */}
            {total > POR_VISTA && (
              <div className="flex gap-2 items-center">
                <span className="text-xs sm:text-sm font-semibold text-ink-500 tabular-nums mr-1">
                  {desde + 1}–{Math.min(desde + POR_VISTA, total)} de {total}
                </span>
                <button
                  type="button"
                  onClick={() => setInicio(Math.max(0, desde - 1))}
                  disabled={desde === 0}
                  aria-label="Eventos anteriores"
                  className="w-10 h-10 rounded-full border-[1.5px] border-gray-200 bg-white text-primary flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                >
                  <Icono nombre="izquierda" size={18} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => setInicio(Math.min(maxInicio, desde + 1))}
                  disabled={desde >= maxInicio}
                  aria-label="Más eventos"
                  className="w-10 h-10 rounded-full boton-liquido flex items-center justify-center disabled:opacity-40"
                >
                  <Icono nombre="derecha" size={18} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        </div>

        {!eventos && <Esqueleto forma="tarjetas" etiqueta="Cargando eventos…" />}

        {eventos && eventos.length === 0 && (
          <EstadoVacio
            icono="estrella"
            titulo="No hay eventos próximos"
            texto="Aquí aparecerán los talleres y eventos de Bienestar cuando se publiquen."
            accion={
              <Link to="/estudiante/servicios" className={botonSecundario}>
                Ver servicios
              </Link>
            }
          />
        )}

        {eventos && eventos.length > 0 && listaFiltrada.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center">
            <p className="m-0 text-sm font-semibold text-ink-700">Aún no estás inscrito/a en ningún evento.</p>
            <button
              type="button"
              onClick={() => setSoloInscritos(false)}
              className="mt-2.5 text-xs font-bold text-primary hover:underline"
            >
              Ver todos los eventos disponibles
            </button>
          </div>
        )}

        {visibles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibles.map((evento) => {
              const { dia, mes } = diaMes(evento.fecha);
              const imagen = imagenDeEvento(evento);
              const inscrito = evento.miInscripcion?.estado === "Confirmada";
              const ocupacion = evento.cupos ? Math.min(100, Math.round((evento.inscritos / evento.cupos) * 100)) : 0;
              const bloqueado = !inscrito && (!evento.inscripcionAbierta || evento.cuposDisponibles === 0);

              return (
                <article
                  key={evento.id}
                  className="group bg-white border border-gray-200/90 rounded-3xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative h-[184px] p-4 flex justify-between items-start bg-primary-soft overflow-hidden">
                    <img
                      src={imagen.src}
                      alt={imagen.alt}
                      onError={respaldoDeFoto(evento)}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,42,91,0)_40%,rgba(11,42,91,0.58)_100%)]"
                    />
                    <span className="relative bg-white/95 backdrop-blur-xs text-primary rounded-2xl px-3 py-2 text-center leading-none shadow-sm">
                      <strong className="block font-display text-[22px]">{dia}</strong>
                      <span className="text-[11px] font-bold tracking-widest">{mes}</span>
                    </span>
                    {inscrito && (
                      <span className="relative bg-white text-[#1D6B4A] text-xs font-bold rounded-full px-3 py-1.5 shadow-sm">
                        Inscrito/a
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex flex-col gap-3.5 flex-1">
                    <div>
                      <h3 className="m-0 text-lg font-bold text-primary leading-snug line-clamp-2">{evento.nombre}</h3>
                      <p className="mt-1 mb-0 text-sm text-ink-500 truncate">
                        {formatearHora(evento.horaInicio)}
                        {evento.lugar ? ` · ${evento.lugar}` : ""}
                      </p>
                    </div>

                    <div className="mt-auto pt-1 flex flex-col gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-primary-light overflow-hidden">
                          <div className="h-full bg-primary-soft rounded-full transition-all" style={{ width: `${ocupacion}%` }} />
                        </div>
                        <span className="text-[13px] font-bold text-primary tabular-nums whitespace-nowrap">
                          {evento.cuposDisponibles} {evento.cuposDisponibles === 1 ? "cupo" : "cupos"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => alternarInscripcion(evento)}
                        disabled={procesando === evento.id || bloqueado}
                        className={`min-h-[44px] w-full rounded-full font-bold text-sm transition-colors disabled:bg-gray-100 disabled:text-ink-500 disabled:border-transparent ${
                          inscrito ? ESTILO_CANCELAR : ESTILO_INSCRIBIRSE
                        }`}
                      >
                        {inscrito
                          ? "Cancelar inscripción"
                          : !evento.inscripcionAbierta
                            ? "Inscripciones cerradas"
                            : evento.cuposDisponibles === 0
                              ? "Sin cupos"
                              : procesando === evento.id
                                ? "Inscribiendo…"
                                : "Inscribirme"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}