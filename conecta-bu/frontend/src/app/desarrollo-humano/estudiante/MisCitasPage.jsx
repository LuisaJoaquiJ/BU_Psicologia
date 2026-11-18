import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaInputUTC, fechaLarga, formatearHora } from "../comunes/lib/format";
import { Icono } from "../comunes/componentes/Iconos";
import { CalendarioMes } from "../comunes/componentes/CalendarioMes";
import { Aviso, Estado, Vacio, botonPrimario, botonSecundario, textoEstado, Segmentos } from "../comunes/componentes/ui";

// HU-12: solo se cancela con al menos 24 horas de anticipación.
const HORAS_MINIMAS_CANCELACION = 24;
const HORA_MS = 3600000;

// Instante real de inicio (o fin) de la cita. La hora guardada es la de Bogotá (UTC-5).
function instante(horario, campo = "horaInicio") {
  if (!horario?.fecha) return null;
  const fecha = new Date(horario.fecha);
  const hora = horario[campo] ? new Date(horario[campo]) : new Date(0);
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hora.getUTCHours() + 5, hora.getUTCMinutes()));
}

function horasHastaLaCita(horario, ahora = Date.now()) {
  const inicio = instante(horario);
  return inicio ? (inicio - ahora) / HORA_MS : Infinity;
}

function cuentaRegresiva(cita, ahora) {
  const inicio = instante(cita.horario);
  const fin = instante(cita.horario, "horaFin") || inicio;
  if (!inicio) return "";
  const ms = inicio - ahora;
  if (ms <= 0) return ahora < fin ? "Tu cita está en curso" : "La hora de la cita ya pasó";
  const min = Math.floor(ms / 60000);
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const minutos = min % 60;
  if (dias >= 1) return `Faltan ${dias} ${dias === 1 ? "día" : "días"}${horas ? ` y ${horas} ${horas === 1 ? "hora" : "horas"}` : ""}`;
  if (horas >= 1) return `Faltan ${horas} h ${minutos} min`;
  return `Faltan ${minutos} min`;
}

function momento(fecha) {
  return fecha.toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

function fechaCorta(fecha) {
  const texto = fechaLarga(fecha) || "";
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

function descargarCalendario(cita) {
  const inicio = instante(cita.horario);
  const fin = instante(cita.horario, "horaFin") || new Date(inicio.getTime() + HORA_MS);
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const servicio = cita.horario?.servicio?.nombre || "Cita de Bienestar";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Conecta BU//Citas//ES",
    "BEGIN:VEVENT",
    `UID:${cita.id}@conectabu`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(inicio)}`,
    `DTEND:${f(fin)}`,
    `SUMMARY:${servicio} · Bienestar Universitario`,
    "DESCRIPTION:Cita agendada en Conecta BU. Si no puedes asistir\\, cancélala con al menos 24 horas de anticipación.",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu cita es en 1 hora",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "cita-bienestar.ics";
  a.click();
  URL.revokeObjectURL(url);
}

const FILTROS = [
  { id: "todas", texto: "Todas" },
  { id: "Atendida", texto: "Atendidas" },
  { id: "Cancelada", texto: "Canceladas" },
  { id: "NoAsistio", texto: "No asistí" },
];

const TONO_CALENDARIO = { Agendada: "marino", Atendida: "verde", Cancelada: "gris", NoAsistio: "ambar" };
const PUNTO_ESTADO = {
  Agendada: "bg-primary",
  Atendida: "bg-[#0B6B61]",
  NoAsistio: "bg-[#D97706]",
  Cancelada: "bg-gray-400",
};
const CONVENCIONES = [
  ["Agendada", "Agendada"],
  ["Atendida", "Atendida"],
  ["NoAsistio", "No asistió"],
  ["Cancelada", "Cancelada"],
];

const BOTON_CANCELAR =
  "inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full border border-red-200 bg-white text-sm font-bold text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors";
const BOTON_CONFIRMAR_CANCELAR =
  "min-h-[40px] px-4 rounded-full bg-red-700 text-white font-bold text-sm hover:bg-red-800 disabled:opacity-60 transition-colors";

// Resumen superior unificado en superficie blanca (sin bloques sólidos que parezcan botones).
function Resumen({ proxima, ahora, atendidas, canceladas }) {
  const celdas = [
    {
      titulo: "Próxima cita",
      valor: proxima ? cuentaRegresiva(proxima, ahora).replace("Faltan ", "") : "Ninguna",
      detalle: proxima ? proxima.horario?.servicio?.nombre || "Cita agendada" : "Pide una cita cuando la necesites",
      icono: "calendario",
      estiloIcono: proxima ? "bg-primary-light text-primary" : "bg-gray-100 text-ink-600",
      bordeDestacado: Boolean(proxima),
    },
    {
      titulo: "Atendidas",
      valor: atendidas,
      detalle: "Citas que sí realizaste",
      icono: "check",
      estiloIcono: "bg-emerald-50 text-[#0B6B61]",
      bordeDestacado: false,
    },
    {
      titulo: "Canceladas o sin asistir",
      valor: canceladas,
      detalle: "Incluye no asistidas",
      icono: "cerrar",
      estiloIcono: "bg-gray-100 text-ink-600",
      bordeDestacado: false,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {celdas.map((c) => (
        <div
          key={c.titulo}
          className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3.5 min-w-0 ${
            c.bordeDestacado ? "border-gray-200 border-l-4 border-l-primary" : "border-gray-200"
          }`}
        >
          <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${c.estiloIcono}`}>
            <Icono nombre={c.icono} size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-ink-500">{c.titulo}</p>
            <p className="m-0 mt-0.5 text-lg font-extrabold text-ink-900 tabular-nums truncate">{c.valor}</p>
            <p className="m-0 text-xs text-ink-500 truncate">{c.detalle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Panel de la cita seleccionada con cabecera clara y etiqueta sutil.
function DetalleCita({ cita, ahora, confirmar, cancelando, onAbrirConfirmar, onCerrarConfirmar, onConfirmar }) {
  const horas = horasHastaLaCita(cita.horario, ahora);
  const cancelable = horas >= HORAS_MINIMAS_CANCELACION;
  const inicioMs = instante(cita.horario)?.getTime() || 0;
  const limite = new Date(inicioMs - HORAS_MINIMAS_CANCELACION * HORA_MS);
  const avance = Math.max(0, Math.min(100, ((horas - HORAS_MINIMAS_CANCELACION) / (7 * 24)) * 100));

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Cabecera clara: evita confundirse con un botón y asegura contraste del título */}
      <div className="bg-slate-50/90 border-b border-gray-100 px-5 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-primary-light text-primary text-[11px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
            Cita agendada
          </span>
          <span className="text-xs font-bold text-primary tabular-nums" aria-live="polite">
            {cuentaRegresiva(cita, ahora)}
          </span>
        </div>
        <h3 className="m-0 mt-2.5 text-lg sm:text-xl font-extrabold text-ink-900 leading-snug">
          {cita.horario?.servicio?.nombre || "Cita de Bienestar"}
        </h3>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-5">
        <dl className="m-0 grid grid-cols-[72px_1fr] gap-x-4 gap-y-3 text-sm tabular-nums">
          <dt className="text-ink-500">Fecha</dt>
          <dd className="m-0 font-bold text-ink-900 first-letter:uppercase">{fechaLarga(cita.horario?.fecha)?.toLowerCase()}</dd>
          <dt className="text-ink-500">Hora</dt>
          <dd className="m-0 font-bold text-ink-900">
            {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
          </dd>
          <dt className="text-ink-500">Lugar</dt>
          <dd className="m-0 font-bold text-ink-900">Oficina de Bienestar Institucional</dd>
        </dl>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5">
          {cancelable ? (
            <>
              <p className="m-0 text-xs text-ink-600 leading-relaxed">
                Puedes cancelar hasta el <strong className="text-ink-900">{momento(limite).replace(/\.$/, "")}</strong>
              </p>
              <div
                className="mt-2.5 h-1.5 rounded-full bg-gray-200 overflow-hidden"
                role="progressbar"
                aria-label="Tiempo para cancelar"
                aria-valuenow={Math.round(avance)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-primary/80 transition-[width] duration-700" style={{ width: `${Math.max(avance, 4)}%` }} />
              </div>
            </>
          ) : (
            <p className="m-0 text-xs text-[#7A5405] flex items-start gap-2 leading-relaxed">
              <Icono nombre="alerta" size={14} strokeWidth={2} className="shrink-0 mt-0.5" />
              Faltan menos de 24 horas: ya no se puede cancelar en línea. Si no puedes asistir, comunícate con Bienestar.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => descargarCalendario(cita)} className={`${botonSecundario} inline-flex items-center gap-2`}>
            <Icono nombre="descarga" size={15} strokeWidth={2} />
            Agregar a calendario
          </button>
          {cancelable && confirmar !== cita.id && (
            <button type="button" onClick={() => onAbrirConfirmar(cita.id)} className={BOTON_CANCELAR}>
              <Icono nombre="cerrar" size={15} strokeWidth={2} />
              Cancelar cita
            </button>
          )}
        </div>

        {confirmar === cita.id && (
          <div role="alertdialog" aria-labelledby={`conf-${cita.id}`} className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
            <p id={`conf-${cita.id}`} className="m-0 font-extrabold text-sm text-red-800">
              ¿Seguro que quieres cancelar esta cita?
            </p>
            <p className="m-0 text-sm text-red-800/90">El horario quedará libre para otra persona y tendrás que agendar de nuevo si cambias de opinión.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onConfirmar(cita)} disabled={cancelando === cita.id} className={BOTON_CONFIRMAR_CANCELAR}>
                {cancelando === cita.id ? "Cancelando…" : "Sí, cancelar la cita"}
              </button>
              <button type="button" onClick={onCerrarConfirmar} className={botonSecundario}>
                No, mantenerla
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

// Historial agrupado por mes como línea de tiempo.
function HistorialLinea({ grupos }) {
  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => (
        <section key={g.clave} aria-label={g.titulo}>
          <h3 className="m-0 mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-500 first-letter:uppercase">{g.titulo}</h3>
          <ul className="list-none m-0 p-0 relative flex flex-col gap-2 pl-6 before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-px before:bg-gray-200">
            {g.citas.map((c) => (
              <li key={c.id} className="relative flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3 pr-4">
                <span
                  className={`absolute -left-6 top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-[3px] border-white ring-1 ring-gray-200 ${PUNTO_ESTADO[c.estado] || PUNTO_ESTADO.Cancelada}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-bold text-ink-900 truncate">{fechaCorta(c.horario?.fecha)}</p>
                  <p className="m-0 text-xs text-ink-500 tabular-nums truncate">
                    {formatearHora(c.horario?.horaInicio)} – {formatearHora(c.horario?.horaFin)}
                    {c.horario?.servicio?.nombre ? ` · ${c.horario.servicio.nombre}` : ""}
                  </p>
                </div>
                <Estado estado={c.estado} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// RF-006 · HU-11, HU-12: consulta y cancelación de citas propias.
export function MisCitasPage() {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cancelando, setCancelando] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [vista, setVista] = useState("calendario");
  const [filtro, setFiltro] = useState("todas");
  const [dia, setDia] = useState(null);
  const [citaActivaId, setCitaActivaId] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [params] = useSearchParams();
  const recienAgendada = params.get("agendada") === "1";

  function cargarCitas() {
    return http
      .get("/citas/mias")
      .then((res) => setCitas(res.data.citas))
      .catch(() => setError("No fue posible cargar tus citas."));
  }

  useEffect(() => {
    cargarCitas();
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function cancelar(cita) {
    setError("");
    setAviso("");
    setCancelando(cita.id);
    try {
      await http.patch(`/citas/${cita.id}/cancelar`);
      await cargarCitas();
      setConfirmar(null);
      setAviso(`Cancelaste tu cita del ${fechaLarga(cita.horario?.fecha).toLowerCase()}. El horario quedó libre para otra persona.`);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible cancelar la cita.");
    } finally {
      setCancelando(null);
    }
  }

  const agendar = "/estudiante/agendar";
  const proximas = useMemo(
    () =>
      (citas || [])
        .filter((c) => c.estado === "Agendada")
        .sort((a, b) => (instante(a.horario) || 0) - (instante(b.horario) || 0)),
    [citas]
  );

  const historial = useMemo(
    () =>
      (citas || [])
        .filter((c) => c.estado !== "Agendada")
        .sort((a, b) => (b.horario?.fecha || "").localeCompare(a.horario?.fecha || "")),
    [citas]
  );

  const citaEnFoco = proximas.find((c) => c.id === citaActivaId) || proximas[0];

  const conteo = useMemo(() => {
    const n = { todas: historial.length };
    for (const c of historial) n[c.estado] = (n[c.estado] || 0) + 1;
    return n;
  }, [historial]);

  const marcas = useMemo(() => {
    const m = {};
    for (const c of citas || []) {
      const k = fechaInputUTC(c.horario?.fecha);
      if (!k) continue;
      (m[k] ||= []).push({
        texto: formatearHora(c.horario?.horaInicio),
        etiqueta: `${formatearHora(c.horario?.horaInicio)} ${textoEstado(c.estado)}`,
        tono: TONO_CALENDARIO[c.estado] || "gris",
      });
    }
    return m;
  }, [citas]);

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const c of historial.filter((h) => filtro === "todas" || h.estado === filtro)) {
      const clave = (fechaInputUTC(c.horario?.fecha) || "").slice(0, 7);
      if (!mapa.has(clave)) {
        const titulo = new Date(`${clave}-01T12:00:00Z`).toLocaleDateString("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
        mapa.set(clave, { clave, titulo, citas: [] });
      }
      mapa.get(clave).citas.push(c);
    }
    return [...mapa.values()];
  }, [historial, filtro]);

  const citasDelDia = dia ? (citas || []).filter((c) => fechaInputUTC(c.horario?.fecha) === dia) : [];
  const proximasDelDia = citasDelDia.filter((c) => c.estado === "Agendada");
  const otrasDelDia = citasDelDia.filter((c) => c.estado !== "Agendada");

  const atendidas = (citas || []).filter((c) => c.estado === "Atendida").length;
  const canceladasONo = (citas || []).filter((c) => c.estado === "Cancelada" || c.estado === "NoAsistio").length;

  const detalleProps = {
    ahora,
    confirmar,
    cancelando,
    onAbrirConfirmar: setConfirmar,
    onCerrarConfirmar: () => setConfirmar(null),
    onConfirmar: cancelar,
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Orientación · Citas</p>
          <h1 className="m-0 font-sans text-[28px] sm:text-[34px] leading-tight tracking-[-0.02em] font-extrabold text-ink-900">Mis citas</h1>
          <p className="mt-1 mb-0 text-sm text-ink-500">Puedes cancelar hasta 24 horas antes de tu cita.</p>
        </div>
        <Link to={agendar} className={botonPrimario}>
          <Icono nombre="mas" size={16} strokeWidth={2.4} />
          Pedir una cita
        </Link>
      </header>

      <div className="flex flex-col gap-5">
        {recienAgendada && !error && (
          <div role="status">
            <Aviso tono="verde">Listo: tu cita quedó agendada. Te esperamos; si no puedes ir, cancélala hasta 24 horas antes.</Aviso>
          </div>
        )}
        {aviso && (
          <div role="status">
            <Aviso tono="verde">{aviso}</Aviso>
          </div>
        )}
        {error && <Aviso>{error}</Aviso>}

        {!citas && !error && (
          <div className="grid gap-3 sm:grid-cols-3" aria-label="Cargando tus citas">
            <div className="h-20 rounded-2xl bg-white border border-gray-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-white border border-gray-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-white border border-gray-200 animate-pulse" />
          </div>
        )}

        {citas && citas.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-12 text-center flex flex-col items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-primary-light text-primary grid place-items-center" aria-hidden="true">
              <Icono nombre="calendario" size={22} strokeWidth={2} />
            </span>
            <p className="m-0 text-base font-extrabold text-ink-900">Todavía no tienes citas</p>
            <p className="m-0 text-sm text-ink-500 max-w-md">Agenda tu primera cita en un par de clics o pídesela al asistente con el día y la hora que prefieres.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Link to={agendar} className={botonPrimario}>
                Agendar mi primera cita
              </Link>
              <Link to="/estudiante/asistente" className={`${botonSecundario} inline-flex items-center gap-2`}>
                <Icono nombre="chat" size={16} strokeWidth={2} />
                Pedírsela al asistente
              </Link>
            </div>
          </div>
        )}

        {citas && citas.length > 0 && (
          <>
            <Resumen proxima={proximas[0]} ahora={ahora} atendidas={atendidas} canceladas={canceladasONo} />

            {/* Barra de vista + selector discreto si hay varias citas próximas */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmentos
                etiqueta="Vista"
                valor={vista}
                alCambiar={(v) => {
                  setVista(v);
                  setDia(null);
                }}
                opciones={[
                  ["calendario", "Calendario", "calendario"],
                  ["lista", "Lista", "lista"],
                ]}
              />

              {vista === "calendario" && proximas.length > 1 && !dia && (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Citas próximas">
                  <span className="text-xs font-bold text-ink-500 mr-1">Agendadas:</span>
                  {proximas.map((p) => {
                    const activa = citaEnFoco?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCitaActivaId(p.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          activa
                            ? "bg-primary-light text-primary border-primary/25"
                            : "bg-white text-ink-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {fechaCorta(p.horario?.fecha).split(",")[0]} · {formatearHora(p.horario?.horaInicio)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {vista === "calendario" ? (
              <div className="grid gap-5 lg:grid-cols-12 items-start">
                {/* Columna izquierda: Calendario (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-5">
                    <CalendarioMes marcas={marcas} seleccionado={dia} onSeleccionar={setDia} />
                  </div>
                  <ul className="list-none m-0 px-1 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-600" aria-label="Convenciones">
                    {CONVENCIONES.map(([estado, texto]) => (
                      <li key={estado} className="inline-flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${PUNTO_ESTADO[estado]}`} aria-hidden="true" />
                        {texto}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Columna derecha: Panel de detalle anclado (5 cols) */}
                <aside className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col gap-4" aria-label="Detalle de cita">
                  {!dia ? (
                    citaEnFoco ? (
                      <DetalleCita cita={citaEnFoco} {...detalleProps} />
                    ) : (
                      <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300 text-center flex flex-col items-center gap-1.5">
                        <p className="m-0 text-sm font-bold text-ink-700">No tienes citas próximas</p>
                        <p className="m-0 text-xs text-ink-500">Toca un día del calendario para revisar su historial.</p>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                        <p className="m-0 text-sm font-extrabold text-ink-900 first-letter:uppercase">
                          {fechaLarga(`${dia}T12:00:00Z`)?.toLowerCase()}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDia(null)}
                          className="text-xs font-bold text-primary hover:underline shrink-0"
                        >
                          {proximas.length > 0 ? "Volver a próxima cita" : "Cerrar día"}
                        </button>
                      </div>

                      {proximasDelDia.map((p) => (
                        <DetalleCita key={p.id} cita={p} {...detalleProps} />
                      ))}

                      {otrasDelDia.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                          <p className="m-0 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                            Registro del día
                          </p>
                          <ul className="list-none m-0 p-0 divide-y divide-gray-100">
                            {otrasDelDia.map((c) => (
                              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                <span className="text-sm text-ink-700 tabular-nums">
                                  {formatearHora(c.horario?.horaInicio)} · {c.horario?.servicio?.nombre || "Cita"}
                                </span>
                                <Estado estado={c.estado} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {citasDelDia.length === 0 && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                          <p className="m-0 text-sm text-ink-500">No tuviste citas este día.</p>
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {proximas.length > 0 && (
                  <section aria-label="Próximas citas" className="flex flex-col gap-3">
                    <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-500">
                      Próximas citas ({proximas.length})
                    </h2>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {proximas.map((p) => (
                        <DetalleCita key={p.id} cita={p} {...detalleProps} />
                      ))}
                    </div>
                  </section>
                )}

                <section aria-label="Historial de citas" className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-500">Historial</h2>
                    <Segmentos
                      etiqueta="Filtrar historial"
                      opciones={FILTROS.filter((f) => f.id === "todas" || conteo[f.id]).map((f) => [f.id, f.texto])}
                      conteos={conteo}
                      valor={filtro}
                      alCambiar={setFiltro}
                    />
                  </div>
                  {historial.length === 0 ? (
                    <Vacio>Aún no tienes citas anteriores.</Vacio>
                  ) : grupos.length ? (
                    <HistorialLinea grupos={grupos} />
                  ) : (
                    <Vacio>No hay citas con ese filtro.</Vacio>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}