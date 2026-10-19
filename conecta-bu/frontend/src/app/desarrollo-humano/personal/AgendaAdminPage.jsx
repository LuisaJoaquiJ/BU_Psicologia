import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { iniciales } from "../comunes/componentes/Navbar";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { Aviso, claseCampo } from "../comunes/componentes/ui";
import { BotonFlotante, Ventana } from "../comunes/componentes/Ventana";
import { FormularioSinCita } from "./AtencionSinCita";
import { CalendarioMes, SelectorVista } from "../comunes/componentes/CalendarioMes";

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
            <span className="block text-sm text-ink-500 truncate">
              {cita.horario?.servicio?.nombre}
              {cita.horario?.sinCita && <span className="ml-1.5 font-bold text-[#8A4B00]">· Sin cita</span>}
            </span>
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
  const [params, setParams] = useSearchParams();
  // ?sincita=1 (desde el inicio) abre de una vez el registro de atencion sin cita.
  const [sinCita, setSinCita] = useState(Boolean(params.get("sincita")));
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
  const [vista, setVista] = useState(fechaInicial ? "lista" : "calendario");
  const [diaSel, setDiaSel] = useState(fechaInicial || hoyISO());
  const [bloqueos, setBloqueos] = useState([]);

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
    http
      .get(`${api}/horarios/bloqueos`)
      .then((res) => setBloqueos(res.data.bloqueos))
      .catch(() => setBloqueos([]));
    if (params.get("sincita")) setParams({}, { replace: true });
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

  // Calendario: todas las fechas, con los filtros de servicio, estudiante y estado.
  const enCalendario = todas
    .filter((c) => !servicio || c.horario?.servicio?.nombre === servicio)
    .filter((c) => !buscar || sinTildes(c.usuario?.nombre).includes(sinTildes(buscar)))
    .filter((c) => estado === "todas" || c.estado === estado);
  const TONO_CAL = {
    Agendada: ["azul", "agendada", "agendadas"],
    Atendida: ["verde", "asistió", "asistieron"],
    NoAsistio: ["rojo", "no asistió", "no asistieron"],
    Cancelada: ["gris", "cancelada", "canceladas"],
  };
  const marcas = {};
  for (const c of enCalendario) {
    const d = dia(c);
    marcas[d] ||= {};
    marcas[d][c.estado] = (marcas[d][c.estado] || 0) + 1;
  }
  const marcasCal = Object.fromEntries(
    Object.entries(marcas).map(([d, conteo]) => [
      d,
      ["Agendada", "Atendida", "NoAsistio", "Cancelada"]
        .filter((e) => conteo[e])
        .map((e) => ({ texto: `${conteo[e]} ${conteo[e] === 1 ? TONO_CAL[e][1] : TONO_CAL[e][2]}`, tono: TONO_CAL[e][0] })),
    ]),
  );
  for (const b of bloqueos) {
    for (let d = new Date(`${b.fechaInicio}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (k > b.fechaFin) break;
      (marcasCal[k] ||= []).unshift({ texto: b.motivo, tono: "ambar" });
    }
  }
  const citasDelDia = enCalendario.filter((c) => dia(c) === diaSel);
  const bloqueosDelDia = bloqueos.filter((b) => b.fechaInicio <= diaSel && b.fechaFin >= diaSel);

  const contarCuando = (o) => todas.filter((c) => o.filtro(c, hoy, fecha)).length;
  const contarEstado = (id) => porNombre.filter((c) => id === "todas" || c.estado === id).length;
  const hayFiltrosExtra = cuando !== "proximas" || estado !== "todas" || servicio || buscar;
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
      <p className="mt-1 mb-6 text-ink-500 max-w-[48em]">
        Quién pidió cita contigo y si asistió. Si alguien llega sin cita y lo atiendes, regístralo con{" "}
        <strong className="text-ink-900">Atender sin cita</strong>.
      </p>

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

      {/* Filtros: cuatro listas desplegables en una sola fila */}
      <div className="mb-4">
        <SelectorVista vista={vista} setVista={setVista} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 items-end">
        {vista === "lista" && (
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
            ¿Cuándo?
            <select value={cuando} onChange={(e) => setCuando(e.target.value)} className={claseCampo}>
              {CUANDO.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id === "dia" ? "Un día en particular…" : `${o.texto} (${contarCuando(o)})`}
                </option>
              ))}
            </select>
          </label>
        )}
        {vista === "lista" && cuando === "dia" && (
          <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
            Día
            <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className={claseCampo} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={claseCampo}>
            {ESTADOS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.texto} ({contarEstado(e.id)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold text-ink-900">
          Servicio
          <select value={servicio} onChange={(e) => setServicio(e.target.value)} className={claseCampo}>
            <option value="">Todos los servicios</option>
            {servicios.map((x) => (
              <option key={x} value={x}>
                {x}
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
            <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre" className={`${claseCampo} pl-10`} />
          </span>
        </label>
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

      {citas && vista === "lista" && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="m-0 font-bold text-ink-900" aria-live="polite">
            Mostrando {resumen}
          </p>
          {hayFiltrosExtra && (
            <button
              type="button"
              onClick={() => {
                setCuando("proximas");
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

      {citas && vista === "calendario" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)] items-start">
          <CalendarioMes
            marcas={marcasCal}
            seleccionado={diaSel}
            onSeleccionar={setDiaSel}
            leyenda={[
              ["azul", "Agendadas"],
              ["verde", "Asistieron"],
              ["rojo", "No asistieron"],
              ["gris", "Canceladas"],
              ["ambar", "No disponible"],
            ]}
          />
          <section aria-label={fechaLarga(`${diaSel}T12:00:00Z`)} className="bg-white rounded-xl border border-gray-200 overflow-hidden xl:sticky xl:top-4">
            <h2
              className={`m-0 px-5 py-3 text-base font-extrabold flex items-center justify-between gap-3 ${diaSel === hoy ? "bg-primary-dark text-white" : "bg-gray-50 text-ink-900"}`}
            >
              <span>
                {fechaLarga(`${diaSel}T12:00:00Z`)}
                {diaSel === hoy && <span className="ml-2 text-cyan">· Hoy</span>}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${diaSel === hoy ? "text-[#B9C7DE]" : "text-ink-500"}`}>
                {citasDelDia.length} {citasDelDia.length === 1 ? "cita" : "citas"}
              </span>
            </h2>
            {bloqueosDelDia.map((b) => (
              <p key={b.id} className="m-0 px-5 py-3 bg-[#FFF1DC] text-[#5C4206] text-sm">
                <strong>No disponible: {b.motivo}</strong> · {b.todoElDia ? "todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`}
              </p>
            ))}
            {citasDelDia.length === 0 ? (
              <p className="m-0 px-5 py-8 text-center text-ink-500">
                No hay citas este día{estado !== "todas" || servicio || buscar ? " con estos filtros" : ""}.
              </p>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-[#EEF2F7]">
                {[...citasDelDia].sort(orden).map((c) => (
                  <FilaCita key={c.id} cita={c} hoy={hoy} registrando={registrando} onRegistrar={registrar} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {citas && vista === "lista" && visibles.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-10 text-center flex flex-col items-center gap-3">
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
        {vista === "lista" &&
          grupos.map((g) => (
            <section key={g.dia} aria-label={fechaLarga(g.fecha)} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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

      {!sinCita && (
        <BotonFlotante icono="persona" onClick={() => setSinCita(true)}>
          Atender sin cita
        </BotonFlotante>
      )}

      {sinCita && (
        <Ventana titulo="Atención sin cita" alCerrar={() => setSinCita(false)}>
          <FormularioSinCita
            api={api}
            alGuardar={async (cita) => {
              setSinCita(false);
              setError("");
              setMensaje(`Quedó registrada la atención de ${cita.usuario?.nombre || "el estudiante"} (${cita.horario?.servicio?.nombre}).`);
              setCuando("dia");
              setFecha(dia(cita));
              setDiaSel(dia(cita));
              setEstado("todas");
              setServicio("");
              setBuscar("");
              await cargar();
            }}
          />
        </Ventana>
      )}
    </main>
  );
}
