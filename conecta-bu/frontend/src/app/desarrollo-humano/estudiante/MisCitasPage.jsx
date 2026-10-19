import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaInputUTC, fechaLarga, formatearHora } from "../comunes/lib/format";
import { Icono } from "../comunes/componentes/Iconos";
import { CalendarioMes } from "../comunes/componentes/CalendarioMes";
import { Aviso, Estado, Vacio, botonPrimario, botonSecundario, textoEstado } from "../comunes/componentes/ui";

// HU-12: solo se cancela con al menos 24 horas de anticipacion (el backend
// lo valida; aqui se avisa antes para no ofrecer un boton que va a fallar).
const HORAS_MINIMAS_CANCELACION = 24;
const HORA_MS = 3600000;

// Instante real en que empieza (o termina) la cita. La hora guardada es la
// hora de Bogota (UTC-5), ver lib/format.js.
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

// «en 2 días y 4 horas», «en 3 h 20 min», «en curso»...
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

// Fecha y hora legibles de un instante, en hora de Bogota.
function momento(fecha) {
  return fecha.toLocaleString("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
}

// Archivo .ics para guardar la cita en Google Calendar, Outlook o el celular.
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
const ICONO_ESTADO = { Atendida: "check", Cancelada: "cerrar", NoAsistio: "alerta", Agendada: "calendario" };
const COLOR_ICONO = {
  Atendida: "bg-[#E3F4F1] text-[#0B6B61]",
  Cancelada: "bg-gray-100 text-ink-500",
  NoAsistio: "bg-gold-light text-[#7A5405]",
  Agendada: "bg-primary-light text-primary",
};

// Ficha de fecha: dia de la semana, numero grande y mes.
function FichaFecha({ fecha, oscura }) {
  const d = new Date(fecha);
  const corto = (op) => d.toLocaleDateString("es-CO", { ...op, timeZone: "UTC" }).replace(".", "");
  return (
    <div
      className={`shrink-0 w-[84px] rounded-2xl flex flex-col items-center justify-center py-3 ${
        oscura ? "bg-primary-dark text-white" : "bg-primary-light text-primary"
      }`}
      aria-hidden="true"
    >
      <span className="text-[12px] font-bold uppercase tracking-wide opacity-80">{corto({ weekday: "short" })}</span>
      <span className="text-[34px] leading-none font-extrabold tabular-nums">{d.getUTCDate()}</span>
      <span className="text-[12px] font-bold uppercase tracking-wide opacity-80">{corto({ month: "short" })}</span>
    </div>
  );
}

// RF-006 · HU-11, HU-12: consulta y cancelacion de citas propias.
export function MisCitasPage() {
  const [citas, setCitas] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cancelando, setCancelando] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [vista, setVista] = useState("lista");
  const [dia, setDia] = useState(null);
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
    // La cuenta regresiva se actualiza cada 30 segundos.
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
  const conAsistente = true;
  const proximas = (citas || [])
    .filter((c) => c.estado === "Agendada")
    .sort((a, b) => (instante(a.horario) || 0) - (instante(b.horario) || 0));
  // Historial: lo mas reciente primero.
  const historial = (citas || [])
    .filter((c) => c.estado !== "Agendada")
    .sort((a, b) => (b.horario?.fecha || "").localeCompare(a.horario?.fecha || ""));

  const conteo = useMemo(() => {
    const n = { todas: historial.length };
    for (const c of historial) n[c.estado] = (n[c.estado] || 0) + 1;
    return n;
  }, [citas]);

  const marcas = useMemo(() => {
    const m = {};
    for (const c of citas || []) {
      const k = fechaInputUTC(c.horario?.fecha);
      if (!k) continue;
      (m[k] ||= []).push({ texto: formatearHora(c.horario?.horaInicio), etiqueta: `${formatearHora(c.horario?.horaInicio)} ${textoEstado(c.estado)}`, tono: TONO_CALENDARIO[c.estado] || "gris" });
    }
    return m;
  }, [citas]);

  const filtradas = historial.filter((c) => filtro === "todas" || c.estado === filtro);
  const delDia = dia ? (citas || []).filter((c) => fechaInputUTC(c.horario?.fecha) === dia) : [];

  // Panel de confirmacion en linea (en vez de una ventana del navegador).
  function ConfirmarCancelacion({ cita }) {
    return (
      <div role="alertdialog" aria-labelledby={`conf-${cita.id}`} className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-col gap-3">
        <p id={`conf-${cita.id}`} className="m-0 font-bold text-red-800">
          ¿Seguro que quieres cancelar esta cita?
        </p>
        <p className="m-0 text-sm text-red-800/90">El horario quedará libre para otra persona y tendrás que agendar de nuevo si cambias de opinión.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cancelar(cita)}
            disabled={cancelando === cita.id}
            className="min-h-[44px] px-5 rounded-full bg-red-700 text-white font-bold text-sm hover:bg-red-800 disabled:opacity-60"
          >
            {cancelando === cita.id ? "Cancelando…" : "Sí, cancelar la cita"}
          </button>
          <button type="button" onClick={() => setConfirmar(null)} className={botonSecundario}>
            No, mantenerla
          </button>
        </div>
      </div>
    );
  }

  // Tarjeta grande de la proxima cita.
  function ProximaCita({ cita, destacada }) {
    const horas = horasHastaLaCita(cita.horario, ahora);
    const cancelable = horas >= HORAS_MINIMAS_CANCELACION;
    const limite = new Date(instante(cita.horario).getTime() - HORAS_MINIMAS_CANCELACION * HORA_MS);
    // Barra: cuanto falta del plazo para cancelar (sobre una semana).
    const hoyBogota = new Date(ahora - 5 * HORA_MS).toISOString().slice(0, 10);
    const manana = new Date(ahora - 5 * HORA_MS + 24 * HORA_MS).toISOString().slice(0, 10);
    const diaCita = fechaInputUTC(cita.horario?.fecha);
    const cuando = diaCita === hoyBogota ? "Es hoy" : diaCita === manana ? "Es mañana" : "";
    const avance = Math.max(0, Math.min(100, ((horas - HORAS_MINIMAS_CANCELACION) / (7 * 24)) * 100));
    return (
      <article
        className={`relative bg-white rounded-xl border p-5 sm:p-6 transition-shadow ${
          destacada ? "border-primary shadow-[0_0_0_4px_rgba(22,63,134,0.12)] animate-[aparecer_0.5s_ease-out]" : "border-gray-200"
        }`}
      >
        <div className="flex gap-4 sm:gap-5 items-start">
          <FichaFecha fecha={cita.horario?.fecha} oscura />
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Estado estado={cita.estado} />
              {cuando && <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-gold-light text-[#7A5405]">{cuando}</span>}
            </div>
            <h3 className="m-0 text-xl sm:text-2xl font-extrabold text-ink-900">{cita.horario?.servicio?.nombre || "Cita de Bienestar"}</h3>
            <p className="m-0 text-ink-600 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="calendario" size={16} strokeWidth={2} className="text-primary" />
                {fechaLarga(cita.horario?.fecha)}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icono nombre="reloj" size={16} strokeWidth={2} className="text-primary" />
                {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
              </span>
            </p>
            <p className="m-0 mt-1 text-lg font-extrabold text-primary" aria-live="polite">
              {cuentaRegresiva(cita, ahora)}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-100 p-4">
          {cancelable ? (
            <>
              <p className="m-0 text-sm text-ink-600">
                Puedes cancelar hasta el <strong className="text-ink-900">{momento(limite).replace(/\.$/, "")}</strong>.
              </p>
              <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-label="Tiempo para cancelar" aria-valuenow={Math.round(avance)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(avance, 4)}%` }} />
              </div>
            </>
          ) : (
            <p className="m-0 text-sm text-ink-600 flex items-start gap-2">
              <Icono nombre="alerta" size={16} strokeWidth={2} className="shrink-0 mt-0.5 text-[#7A5405]" />
              Faltan menos de 24 horas, ya no se puede cancelar en línea. Si no puedes asistir, comunícate con Bienestar.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => descargarCalendario(cita)} className={`${botonSecundario} inline-flex items-center gap-2`}>
            <Icono nombre="descarga" size={16} strokeWidth={2} />
            Agregar a mi calendario
          </button>
          {cancelable && confirmar !== cita.id && (
            <button
              type="button"
              onClick={() => setConfirmar(cita.id)}
              className="min-h-[44px] px-5 rounded-full border border-red-200 text-red-700 font-bold text-sm hover:bg-red-50 inline-flex items-center gap-2"
            >
              <Icono nombre="cerrar" size={16} strokeWidth={2} />
              Cancelar cita
            </button>
          )}
        </div>
        {confirmar === cita.id && <ConfirmarCancelacion cita={cita} />}
      </article>
    );
  }

  function FilaHistorial({ cita }) {
    return (
      <li className="p-4 sm:p-5 flex items-center gap-4">
        <span className={`shrink-0 w-11 h-11 rounded-full grid place-items-center ${COLOR_ICONO[cita.estado] || COLOR_ICONO.Cancelada}`} aria-hidden="true">
          <Icono nombre={ICONO_ESTADO[cita.estado] || "calendario"} size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-bold text-ink-900">{fechaLarga(cita.horario?.fecha)}</p>
          <p className="m-0 mt-0.5 text-sm text-ink-500">
            <span className="tabular-nums">
              {formatearHora(cita.horario?.horaInicio)} – {formatearHora(cita.horario?.horaFin)}
            </span>
            {cita.horario?.servicio?.nombre ? ` · ${cita.horario.servicio.nombre}` : ""}
          </p>
          <span className="sm:hidden inline-block mt-2">
            <Estado estado={cita.estado} />
          </span>
        </div>
        <span className="hidden sm:inline-flex">
          <Estado estado={cita.estado} />
        </span>
      </li>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-10">
      <style>{`@keyframes aparecer{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
        <div>
          <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">Mis citas</h1>
          <p className="mt-1.5 mb-0 text-ink-500">
            Tus citas de orientación. Puedes cancelar hasta 24 horas antes.
          </p>
        </div>
        <Link to={agendar} className={botonPrimario}>
          Pedir una cita
        </Link>
      </div>

      {recienAgendada && !error && (
        <div className="mb-6" role="status">
          <Aviso tono="verde">Listo: tu cita quedó agendada. Te esperamos; si no puedes ir, cancélala hasta 24 horas antes.</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-6" role="status">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}
      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {!citas && !error && (
        <div className="flex flex-col gap-3" aria-label="Cargando tus citas">
          <div className="h-44 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse" />
        </div>
      )}

      {citas && citas.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-primary-light text-primary grid place-items-center" aria-hidden="true">
            <Icono nombre="calendario" size={26} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold">Todavía no tienes citas</p>
          <p className="m-0 text-ink-500 max-w-md">Agenda tu primera cita en un par de clics{conAsistente ? " o pídesela al asistente con el día y la hora que prefieres" : ""}.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            <Link to={agendar} className={botonPrimario}>
              Agendar mi primera cita
            </Link>
            {conAsistente && (
              <Link to="/estudiante/asistente" className={`${botonSecundario} inline-flex items-center gap-2`}>
                <Icono nombre="chat" size={16} strokeWidth={2} />
                Pedírsela al asistente
              </Link>
            )}
          </div>
        </div>
      )}

      {citas && citas.length > 0 && (
        <div className="flex flex-col gap-9">
          <section aria-labelledby="proximas">
            <h2 id="proximas" className="m-0 mb-3 font-sans text-lg font-bold text-primary">
              {proximas.length > 1 ? "Próximas citas" : "Tu próxima cita"}
            </h2>
            {proximas.length ? (
              <div className="flex flex-col gap-4">
                {proximas.map((c, i) => (
                  <ProximaCita key={c.id} cita={c} destacada={recienAgendada && i === 0} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <p className="m-0 text-ink-600">No tienes citas próximas.</p>
                <div className="flex flex-wrap gap-2">
                  <Link to={agendar} className={botonPrimario}>
                    Agendar una cita
                  </Link>
                  {conAsistente && (
                    <Link to="/estudiante/asistente" className={`${botonSecundario} inline-flex items-center gap-2`}>
                      <Icono nombre="chat" size={16} strokeWidth={2} />
                      Con el asistente
                    </Link>
                  )}
                </div>
              </div>
            )}
          </section>

          {historial.length > 0 && (
            <section aria-labelledby="historial" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="historial" className="m-0 font-sans text-lg font-bold text-primary">
                  Historial
                </h2>
                <div className="inline-flex rounded-full bg-white border border-gray-200 p-1" role="tablist" aria-label="Vista del historial">
                  {[
                    ["lista", "Lista", "lista"],
                    ["calendario", "Calendario", "calendario"],
                  ].map(([id, texto, icono]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={vista === id}
                      onClick={() => setVista(id)}
                      className={`min-h-[38px] px-4 rounded-full text-sm font-bold inline-flex items-center gap-1.5 transition-colors ${
                        vista === id ? "bg-primary text-white" : "text-ink-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icono nombre={icono} size={15} strokeWidth={2} />
                      {texto}
                    </button>
                  ))}
                </div>
              </div>

              {vista === "lista" ? (
                <>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar historial">
                    {FILTROS.filter((f) => f.id === "todas" || conteo[f.id]).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={filtro === f.id}
                        onClick={() => setFiltro(f.id)}
                        className={`min-h-[40px] px-4 rounded-full border text-sm font-bold inline-flex items-center gap-2 transition-colors ${
                          filtro === f.id ? "bg-primary-dark border-primary-dark text-white" : "bg-white border-gray-200 text-ink-700 hover:border-primary/50"
                        }`}
                      >
                        {f.texto}
                        <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full grid place-items-center text-[12px] tabular-nums ${filtro === f.id ? "bg-white/20" : "bg-gray-100"}`}>
                          {conteo[f.id] || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                  {filtradas.length ? (
                    <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-xl divide-y divide-gray-200">
                      {filtradas.map((c) => (
                        <FilaHistorial key={c.id} cita={c} />
                      ))}
                    </ul>
                  ) : (
                    <Vacio>No hay citas con ese filtro.</Vacio>
                  )}
                </>
              ) : (
                <>
                  <CalendarioMes marcas={marcas} seleccionado={dia} onSeleccionar={setDia} />
                  <ul className="list-none m-0 p-0 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600" aria-label="Convenciones">
                    {[
                      ["bg-primary-dark", "Agendada"],
                      ["bg-[#1baf7a]", "Atendida"],
                      ["bg-[#d97706]", "No asistió"],
                      ["bg-gray-400", "Cancelada"],
                    ].map(([color, texto]) => (
                      <li key={texto} className="inline-flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${color}`} aria-hidden="true" />
                        {texto}
                      </li>
                    ))}
                  </ul>
                  {!dia && <p className="m-0 text-sm text-ink-500">Toca un día para ver el detalle de esa cita.</p>}
                  {dia && (
                    <div className="bg-white border border-gray-200 rounded-xl">
                      <p className="m-0 px-5 pt-4 font-bold text-ink-900">{fechaLarga(`${dia}T12:00:00Z`)}</p>
                      {delDia.length ? (
                        <ul className="list-none m-0 p-0 divide-y divide-gray-200">
                          {delDia.map((c) => (
                            <FilaHistorial key={c.id} cita={c} />
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 px-5 pb-5 pt-1 text-sm text-ink-500">No tuviste citas este día.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}

