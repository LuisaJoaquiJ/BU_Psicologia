import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { iniciales } from "../../components/Navbar";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Aviso, claseCampo } from "../../components/ui";

// Fecha de hoy en la hora local del navegador (Bogota). toISOString() da la
// fecha UTC, que despues de las 7 p. m. ya es la de manana.
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dia = (c) => String(c.horario?.fecha || "").slice(0, 10);
const orden = (a, b) => (dia(a) + String(a.horario?.horaInicio)).localeCompare(dia(b) + String(b.horario?.horaInicio));
const sinTildes = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// "Cuándo": la pregunta principal. Cada opcion dice en palabras que muestra.
const CUANDO = [
  { id: "proximas", texto: "Próximas", ayuda: "de hoy en adelante", filtro: (c, hoy) => dia(c) >= hoy && c.estado !== "Cancelada" },
  { id: "registrar", texto: "Por registrar", ayuda: "ya pasaron y falta decir si asistió", filtro: (c, hoy) => dia(c) < hoy && c.estado === "Agendada" },
  { id: "pasadas", texto: "Pasadas", ayuda: "antes de hoy", filtro: (c, hoy) => dia(c) < hoy },
  { id: "dia", texto: "Un día", ayuda: "", filtro: (c, hoy, fecha) => dia(c) === fecha },
  { id: "todas", texto: "Todas", ayuda: "sin importar la fecha", filtro: () => true },
];

// Estado de la cita, con nombres en lenguaje sencillo.
const ESTADOS = [
  { id: "todas", texto: "Todos los estados" },
  { id: "Agendada", texto: "Agendadas", punto: "#2a78d6" },
  { id: "Atendida", texto: "Asistieron", punto: "#0d9488" },
  { id: "NoAsistio", texto: "No asistieron", punto: "#d97706" },
  { id: "Cancelada", texto: "Canceladas", punto: "#9AA3B5" },
];
const INSIGNIA = {
  Agendada: ["Agendada", "bg-[#E3EEFB] text-[#1C5CAB]"],
  Atendida: ["Asistió", "bg-[#DDF3EA] text-[#0E6B4A]"],
  NoAsistio: ["No asistió", "bg-[#FFF1DC] text-[#8A4B00]"],
  Cancelada: ["Cancelada", "bg-gray-100 text-ink-600"],
};

function Pildora({ activa, onClick, children, cantidad }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 min-h-[42px] px-4 rounded-full text-sm font-bold border-[1.5px] transition-colors ${
        activa ? "bg-primary-dark text-white border-primary-dark" : "bg-white text-primary border-gray-200 hover:border-primary/40"
      }`}
    >
      {children}
      {cantidad !== undefined && (
        <span className={`min-w-[24px] px-1.5 rounded-full text-xs tabular-nums ${activa ? "bg-white/20 text-white" : "bg-gray-100 text-ink-600"}`}>
          {cantidad}
        </span>
      )}
    </button>
  );
}

function FilaCita({ cita, hoy, registrando, onRegistrar }) {
  const puedeRegistrar = cita.estado === "Agendada" && dia(cita) <= hoy;
  const [texto, clase] = INSIGNIA[cita.estado] || [cita.estado, "bg-gray-100 text-ink-600"];
  return (
    <li className="px-5 py-3.5 flex items-center justify-between flex-wrap gap-x-6 gap-y-2.5">
      <div className="flex items-center gap-4 min-w-0">
        <span className="w-[104px] shrink-0 whitespace-nowrap font-extrabold text-ink-900 tabular-nums">{formatearHora(cita.horario?.horaInicio)}</span>
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-primary-light text-primary font-extrabold text-sm flex items-center justify-center shrink-0">
            {iniciales(cita.usuario?.nombre)}
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-ink-900 truncate">{cita.usuario?.nombre}</span>
            <span className="block text-sm text-ink-500 truncate">{cita.horario?.servicio?.nombre}</span>
          </span>
        </span>
      </div>
      {puedeRegistrar ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-500 mr-1">¿Asistió?</span>
          <button
            type="button"
            disabled={registrando}
            onClick={() => onRegistrar(cita, true)}
            className="min-h-[44px] px-4 rounded-full bg-primary text-white text-sm font-extrabold hover:bg-primary-dark disabled:opacity-60"
          >
            Sí
          </button>
          <button
            type="button"
            disabled={registrando}
            onClick={() => onRegistrar(cita, false)}
            className="min-h-[44px] px-4 rounded-full border-[1.5px] border-primary text-primary text-sm font-extrabold hover:bg-primary-light disabled:opacity-60"
          >
            No
          </button>
        </div>
      ) : (
        <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${clase}`}>{texto}</span>
      )}
    </li>
  );
}

// RF-008 · HU-15, HU-16: citas del modulo, con filtros sencillos (cuando,
// estado, servicio y nombre) y el registro de asistencia en la misma fila.
export function AgendaAdminPage({ api = "/admin" }) {
  const [params] = useSearchParams();
  const fechaInicial = /^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") || "") ? params.get("fecha") : "";
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [cuando, setCuando] = useState(fechaInicial ? "dia" : "proximas");
  const [fecha, setFecha] = useState(fechaInicial || hoyISO());
  const [estado, setEstado] = useState("todas");
  const [servicio, setServicio] = useState("");
  const [buscar, setBuscar] = useState("");

  const cargar = () =>
    http
      .get(`${api}/citas`)
      .then((res) => {
        setCitas(res.data.citas);
        setError("");
      })
      .catch((err) => {
        setCitas([]);
        setError(
          err.response?.data?.message
            ? `No pudimos cargar las citas: ${err.response.data.message}`
            : "No pudimos cargar las citas. Revisa que el servidor esté encendido y tu conexión.",
        );
      });

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar(cita, asistio) {
    setError("");
    setMensaje("");
    setRegistrando(true);
    try {
      await http.patch(`${api}/citas/${cita.id}/asistencia`, { asistio });
      setMensaje(`Quedó registrado que ${cita.usuario?.nombre?.split(" ")[0] || "el estudiante"} ${asistio ? "asistió" : "no asistió"}.`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos registrar la asistencia. Intenta de nuevo.");
    } finally {
      setRegistrando(false);
    }
  }

  const hoy = hoyISO();
  const todas = useMemo(() => [...(citas || [])].sort(orden), [citas]);
  const servicios = useMemo(() => [...new Set(todas.map((c) => c.horario?.servicio?.nombre).filter(Boolean))].sort(), [todas]);
  const opcion = CUANDO.find((o) => o.id === cuando);

  // Filtros en cadena: cuando -> estado -> servicio -> nombre.
  const porCuando = todas.filter((c) => opcion.filtro(c, hoy, fecha));
  const porServicio = porCuando.filter((c) => !servicio || c.horario?.servicio?.nombre === servicio);
  const porNombre = porServicio.filter((c) => !buscar || sinTildes(c.usuario?.nombre).includes(sinTildes(buscar)));
  const visibles = porNombre.filter((c) => estado === "todas" || c.estado === estado);
  // Las pasadas se leen de la mas reciente a la mas antigua.
  if (cuando === "pasadas" || cuando === "registrar") visibles.reverse();

  const contarCuando = (o) => todas.filter((c) => o.filtro(c, hoy, fecha)).length;
  const contarEstado = (id) => porNombre.filter((c) => id === "todas" || c.estado === id).length;
  const hayFiltrosExtra = estado !== "todas" || servicio || buscar;
  const porRegistrar = todas.filter((c) => dia(c) < hoy && c.estado === "Agendada").length;

  // Agrupadas por dia.
  const grupos = [];
  for (const c of visibles) {
    if (!grupos.length || grupos.at(-1).dia !== dia(c)) grupos.push({ dia: dia(c), fecha: c.horario?.fecha, citas: [] });
    grupos.at(-1).citas.push(c);
  }

  // Frase que dice en palabras lo que se esta viendo.
  const resumen = (() => {
    const n = visibles.length;
    const cuandoFrase = {
      proximas: "de hoy en adelante",
      registrar: "que ya pasaron y esperan registro de asistencia",
      pasadas: "anteriores a hoy",
      dia: `del ${fechaLarga(`${fecha}T12:00:00Z`).toLowerCase()}`,
      todas: "en total",
    }[cuando];
    const estadoFrase = {
      todas: "",
      Agendada: "que siguen agendadas",
      Atendida: "en las que el estudiante asistió",
      NoAsistio: "en las que el estudiante no asistió",
      Cancelada: "canceladas",
    }[estado];
    return [
      `${n} ${n === 1 ? "cita" : "citas"}`,
      cuandoFrase,
      estadoFrase,
      servicio && `de ${servicio}`,
      buscar && `de estudiantes con «${buscar}» en el nombre`,
    ]
      .filter(Boolean)
      .join(" ");
  })();

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24">
      <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Citas</h1>
      <p className="mt-1 mb-6 text-ink-500 max-w-[48em]">Quién pidió cita contigo y si asistió. Usa los filtros para encontrar lo que buscas.</p>

      {porRegistrar > 0 && cuando !== "registrar" && (
        <button
          type="button"
          onClick={() => {
            setCuando("registrar");
            setEstado("todas");
          }}
          className="mb-5 w-full flex items-center justify-between gap-3 rounded-2xl bg-[#FFF6E0] border border-[#F2C46D] text-[#7A5405] px-5 py-3.5 text-left font-bold hover:brightness-[0.98]"
        >
          <span>
            {porRegistrar} {porRegistrar === 1 ? "cita ya pasó y falta" : "citas ya pasaron y falta"} registrar si el estudiante asistió.
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            Registrar ahora <Icono nombre="flecha" size={16} strokeWidth={2.2} />
          </span>
        </button>
      )}

      {/* Filtros: una fila por pregunta */}
      <div className="bg-white border border-gray-200 rounded-[22px] p-5 flex flex-col gap-4 mb-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-ink-900">¿Cuándo?</span>
          <div className="flex gap-2 items-center overflow-x-auto sm:flex-wrap -mx-1 px-1 pb-1 [scrollbar-width:none]">
            {CUANDO.map((o) => (
              <Pildora key={o.id} activa={cuando === o.id} onClick={() => setCuando(o.id)} cantidad={o.id === "dia" ? undefined : contarCuando(o)}>
                {o.texto}
              </Pildora>
            ))}
            {cuando === "dia" && (
              <label className="inline-flex items-center gap-2">
                <span className="sr-only">Fecha</span>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => e.target.value && setFecha(e.target.value)}
                  className={`${claseCampo} !w-auto min-h-[42px]`}
                />
              </label>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-ink-900">¿En qué estado?</span>
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap -mx-1 px-1 pb-1 [scrollbar-width:none]">
            {ESTADOS.map((e) => (
              <Pildora key={e.id} activa={estado === e.id} onClick={() => setEstado(e.id)} cantidad={contarEstado(e.id)}>
                {e.punto && <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.punto }} />}
                {e.texto}
              </Pildora>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
            Servicio
            <select value={servicio} onChange={(e) => setServicio(e.target.value)} className={claseCampo}>
              <option value="">Todos los servicios</option>
              {servicios.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
            Estudiante
            <span className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
                <Icono nombre="buscar" size={18} />
              </span>
              <input
                type="search"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Escribe un nombre"
                className={`${claseCampo} pl-10`}
              />
            </span>
          </label>
        </div>
      </div>

      {mensaje && (
        <div className="mb-4" role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {citas && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="m-0 font-bold text-ink-900" aria-live="polite">
            Mostrando {resumen}
          </p>
          {hayFiltrosExtra && (
            <button
              type="button"
              onClick={() => {
                setEstado("todas");
                setServicio("");
                setBuscar("");
              }}
              className="min-h-[40px] px-3 text-sm font-bold text-primary-soft hover:underline"
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}

      {!citas && <p className="text-ink-500">Cargando citas…</p>}

      {citas && visibles.length === 0 && !error && (
        <div className="bg-white rounded-[22px] border border-gray-200 px-6 py-10 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="calendario" size={28} strokeWidth={2} />
          </span>
          {todas.length === 0 ? (
            <>
              <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no hay citas en este módulo</p>
              <p className="m-0 text-ink-500 max-w-[38em]">
                Aquí aparecen las citas que los estudiantes piden en tus horarios publicados. Si ya hay citas y no salen, revisa que el servicio de la cita
                pertenezca a este módulo.
              </p>
            </>
          ) : (
            <>
              <p className="m-0 text-lg font-extrabold text-ink-900">Ninguna cita coincide con estos filtros</p>
              <p className="m-0 text-ink-500">
                En total hay {todas.length} {todas.length === 1 ? "cita" : "citas"} en este módulo.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCuando("todas");
                  setEstado("todas");
                  setServicio("");
                  setBuscar("");
                }}
                className="mt-1 min-h-[44px] px-5 rounded-full bg-primary text-white font-bold hover:bg-primary-dark"
              >
                Ver todas las citas
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {grupos.map((g) => (
          <section key={g.dia} aria-label={fechaLarga(g.fecha)} className="bg-white rounded-[22px] border border-gray-200 overflow-hidden">
            <h2
              className={`m-0 px-5 py-3 text-base font-extrabold flex items-center justify-between gap-3 ${
                g.dia === hoy ? "bg-primary-dark text-white" : "bg-gray-50 text-ink-900"
              }`}
            >
              <span>
                {fechaLarga(g.fecha)}
                {g.dia === hoy && <span className="ml-2 text-cyan">· Hoy</span>}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${g.dia === hoy ? "text-[#B9C7DE]" : "text-ink-500"}`}>
                {g.citas.length} {g.citas.length === 1 ? "cita" : "citas"}
              </span>
            </h2>
            <ul className="list-none m-0 p-0 divide-y divide-[#EEF2F7]">
              {g.citas.map((c) => (
                <FilaCita key={c.id} cita={c} hoy={hoy} registrando={registrando} onRegistrar={registrar} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
