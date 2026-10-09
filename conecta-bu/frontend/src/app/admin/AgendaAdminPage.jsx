import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
function AgendaDelDia({ api = "/admin" }) {
  const [params] = useSearchParams();
  // ?fecha=AAAA-MM-DD abre la agenda en ese dia (desde el calendario de Estadisticas).
  const [fecha, setFecha] = useState(/^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") || "") ? params.get("fecha") : hoyISO());
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
      setMensaje(
        `Quedó registrado que ${cita.usuario?.nombre?.split(" ")[0] || "el estudiante"} ${asistio ? "asistió" : "no asistió"} a su cita de las ${formatearHora(cita.horario?.horaInicio)}.`,
      );
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
    <div>
      <div className="flex justify-between items-center gap-5 flex-wrap mb-6">
        <div>
          <h2 className="m-0 text-[26px] sm:text-[30px] leading-tight font-extrabold">{fechaLarga(fecha)}</h2>
          <p className="mt-0.5 mb-0 text-ink-500 tabular-nums">
            {citas
              ? `${activas} ${activas === 1 ? "cita" : "citas"}${pendientes ? ` · ${pendientes} ${pendientes === 1 ? "espera" : "esperan"} registro de asistencia` : ""}`
              : "Cargando…"}
          </p>
        </div>
        <div role="group" aria-label="Cambiar de día" className="flex items-center gap-1.5 bg-white p-1.5 rounded-full flex-wrap">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => irA(moverDia(fecha, -1))}
            className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light"
          >
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
            <input
              type="date"
              value={fecha}
              onChange={(e) => e.target.value && irA(e.target.value)}
              className="bg-transparent font-bold text-primary-dark text-sm"
            />
          </label>
          <button
            type="button"
            aria-label="Día siguiente"
            onClick={() => irA(moverDia(fecha, 1))}
            className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light"
          >
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
                  <span
                    className={`shrink-0 w-[76px] sm:w-[92px] pt-3.5 font-extrabold text-sm sm:text-base ${c.estado === "Cancelada" ? "text-ink-500" : "text-ink-900"}`}
                  >
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
                      <span className="text-sm font-extrabold text-cyan">
                        {{ Atendida: "Asistió", NoAsistio: "No asistió", Cancelada: "Cancelada" }[c.estado]}
                      </span>
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
                  <h2 id="detalle-cita" className="m-0 text-[22px] font-extrabold leading-tight">
                    {elegida.usuario?.nombre}
                  </h2>
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
                  {elegida.estado === "Cancelada"
                    ? "El estudiante canceló esta cita; el horario volvió a quedar libre."
                    : "La asistencia de esta cita ya está registrada."}
                </p>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

// Fila de una cita en la vista de pendientes y proximas.
function FilaCita({ cita, conAsistencia, registrando, onRegistrar }) {
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
      {conAsistencia && cita.estado === "Agendada" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={registrando}
            onClick={() => onRegistrar(cita, true)}
            className="min-h-[44px] px-4 rounded-full bg-primary text-white text-sm font-extrabold hover:bg-primary-dark disabled:opacity-60"
          >
            Asistió
          </button>
          <button
            type="button"
            disabled={registrando}
            onClick={() => onRegistrar(cita, false)}
            className="min-h-[44px] px-4 rounded-full border-[1.5px] border-primary text-primary text-sm font-extrabold hover:bg-primary-light disabled:opacity-60"
          >
            No asistió
          </button>
        </div>
      ) : (
        <Estado estado={cita.estado} />
      )}
    </li>
  );
}

function GrupoDias({ titulo, descripcion, citas, conAsistencia, registrando, onRegistrar, destacado }) {
  if (!citas.length) return null;
  const dias = [];
  for (const c of citas) {
    const d = String(c.horario?.fecha).slice(0, 10);
    if (!dias.length || dias.at(-1).dia !== d) dias.push({ dia: d, fecha: c.horario?.fecha, citas: [] });
    dias.at(-1).citas.push(c);
  }
  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-xl font-extrabold">
          {titulo} <span className="text-base font-semibold text-ink-500">({citas.length})</span>
        </h2>
        {descripcion && <p className="mt-0.5 mb-0 text-sm text-ink-500">{descripcion}</p>}
      </div>
      {dias.map((g) => (
        <div key={g.dia} className={`bg-white rounded-[22px] border overflow-hidden ${destacado ? "border-[#F2C46D]" : "border-gray-200"}`}>
          <h3 className={`m-0 px-5 py-3 text-base font-extrabold ${destacado ? "bg-[#FFF6E0] text-[#7A5405]" : "bg-gray-50 text-ink-900"}`}>
            {fechaLarga(g.fecha)}
          </h3>
          <ul className="list-none m-0 p-0 divide-y divide-[#EEF2F7]">
            {g.citas.map((c) => (
              <FilaCita key={c.id} cita={c} conAsistencia={conAsistencia} registrando={registrando} onRegistrar={onRegistrar} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// Citas pendientes: las que esperan registro de asistencia, las de hoy y las proximas.
function CitasPendientes({ api, alVerDia }) {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [registrando, setRegistrando] = useState(false);

  const cargar = () =>
    http
      .get(`${api}/citas`)
      .then((res) => setCitas(res.data.citas))
      .catch(() => setError("No pudimos cargar las citas. Revisa tu conexión e intenta de nuevo."));

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
  const dia = (c) => String(c.horario?.fecha).slice(0, 10);
  const orden = (a, b) => (dia(a) + String(a.horario?.horaInicio)).localeCompare(dia(b) + String(b.horario?.horaInicio));
  const lista = [...(citas || [])].sort(orden);
  const porRegistrar = lista.filter((c) => c.estado === "Agendada" && dia(c) < hoy);
  const deHoy = lista.filter((c) => dia(c) === hoy && c.estado !== "Cancelada");
  const proximas = lista.filter((c) => c.estado === "Agendada" && dia(c) > hoy);

  return (
    <div className="flex flex-col gap-8">
      {mensaje && (
        <div role="status">
          <Aviso tono="verde">{mensaje}</Aviso>
        </div>
      )}
      {error && <Aviso>{error}</Aviso>}
      {!citas && !error && <p className="text-ink-500">Cargando citas…</p>}
      {citas && !porRegistrar.length && !deHoy.length && !proximas.length && (
        <div className="bg-white rounded-[22px] border border-gray-200 px-6 py-12 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="calendario" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">No tienes citas pendientes</p>
          <p className="m-0 text-ink-500 max-w-[36em]">
            Cuando un estudiante pida una cita en uno de tus horarios, aparecerá aquí. Si no llegan citas, revisa que tengas horarios publicados.
          </p>
          <button
            type="button"
            onClick={alVerDia}
            className="mt-2 min-h-[44px] px-5 rounded-full border-[1.5px] border-gray-200 bg-white text-primary font-bold hover:bg-gray-50"
          >
            Ver las citas de un día
          </button>
        </div>
      )}
      <GrupoDias
        destacado
        titulo="Falta registrar asistencia"
        descripcion="Citas que ya pasaron y todavía no dicen si el estudiante asistió."
        citas={porRegistrar}
        conAsistencia
        registrando={registrando}
        onRegistrar={registrar}
      />
      <GrupoDias titulo="Hoy" citas={deHoy} conAsistencia registrando={registrando} onRegistrar={registrar} />
      <GrupoDias titulo="Próximas citas" citas={proximas} />
    </div>
  );
}

// RF-008 · HU-15, HU-16: citas del modulo. Por defecto muestra lo pendiente
// (asistencia por registrar, hoy y proximas); "Por día" abre la agenda de una fecha.
export function AgendaAdminPage({ api = "/admin" }) {
  const [params] = useSearchParams();
  const [vista, setVista] = useState(params.get("fecha") ? "dia" : "pendientes");
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Citas</h1>
          <p className="mt-1 mb-0 text-ink-500">Quién pidió cita contigo y el registro de si asistió.</p>
        </div>
        <div role="tablist" aria-label="Vista" className="inline-flex border-b-2 border-gray-200">
          {[
            ["pendientes", "Pendientes y próximas"],
            ["dia", "Por día"],
          ].map(([id, texto]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={vista === id}
              onClick={() => setVista(id)}
              className={`-mb-[2px] px-4 min-h-[44px] text-[15px] font-bold border-b-2 ${
                vista === id ? "border-primary-dark text-primary-dark" : "border-transparent text-ink-500 hover:text-primary"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>
      {vista === "pendientes" ? <CitasPendientes api={api} alVerDia={() => setVista("dia")} /> : <AgendaDelDia api={api} />}
    </main>
  );
}
