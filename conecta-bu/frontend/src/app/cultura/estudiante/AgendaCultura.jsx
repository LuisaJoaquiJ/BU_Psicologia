import { AvisoFlotante } from "../../../components/avisos/Avisos";
import { useEffect, useMemo, useState } from "react";
import { http } from "../../../lib/api/http";
import { IMAGENES, urlDelServidor } from "../../../lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
import { Segmentos } from "../comunes/componentes/ui";
import { hoyISO, mensajeError } from "../comun/formato";

// Foto de cada tipo de evento cuando el area todavia no sube la suya.
const FOTO_TIPO = {
  especial: IMAGENES.auditorio,
  representativo: IMAGENES.integracion,
  promocion: IMAGENES.sede,
  taller: IMAGENES.permanencia,
  itinerante: IMAGENES.salud,
};

const fotoDe = (e) => (e.imagenUrl ? { src: urlDelServidor(e.imagenUrl), alt: `Foto de ${e.nombre}` } : FOTO_TIPO[e.categoriaId] || IMAGENES.auditorio);
const fecha = (iso) => new Date(`${iso}T12:00:00`);
const dia = (iso) => fecha(iso).getDate();
const mes = (iso) => fecha(iso).toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
const diaLargo = (iso) => fecha(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
function hora(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}
const diasHasta = (iso) => Math.round((fecha(iso) - fecha(hoyISO())) / 86400000);
const cuando = (iso) => {
  const n = diasHasta(iso);
  return n < 0 ? null : n === 0 ? "Hoy" : n === 1 ? "Mañana" : n < 7 ? `En ${n} días` : null;
};
// En el historial, lo que ya paso se marca como realizado.
const etiquetaCuando = (e) => (e.terminado ? "Realizado" : cuando(e.fecha));

const FILTROS = [
  ["todos", "Todos"],
  ["semana", "Semana"],
  ["mes", "Mes"],
  ["mios", "Inscrito"],
  ["historial", "Mi historial"],
];

// Si la foto subida no carga, se cambia una vez por la del tipo de evento.
function Foto({ evento, className }) {
  const foto = fotoDe(evento);
  return (
    <img
      src={foto.src}
      alt=""
      loading="lazy"
      onError={(ev) => {
        if (!ev.currentTarget.dataset.respaldo) {
          ev.currentTarget.dataset.respaldo = "1";
          ev.currentTarget.src = (FOTO_TIPO[evento.categoriaId] || IMAGENES.auditorio).src;
        }
      }}
      className={`absolute inset-0 w-full h-full object-cover ${className || ""}`}
    />
  );
}

function Fecha({ iso, className = "" }) {
  return (
    <span className={`w-[60px] h-[60px] rounded-[18px] bg-white/95 text-primary-dark shadow-[0_8px_24px_rgba(11,35,71,0.25)] flex flex-col items-center justify-center leading-none ${className}`}>
      <strong className="text-[22px] tabular-nums">{dia(iso)}</strong>
      <span className="text-xs font-bold text-primary">{mes(iso)}</span>
    </span>
  );
}

// Barra de cupos: se llena a medida que la gente se inscribe.
function Cupos({ evento, claro }) {
  const usados = Math.max(0, evento.cupo - evento.cuposDisponibles);
  const pct = evento.cupo ? Math.min(100, Math.round((usados / evento.cupo) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-2 rounded-full overflow-hidden ${claro ? "bg-white/25" : "bg-primary-light"}`}>
        <div className={`h-full rounded-full ${claro ? "bg-white" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${claro ? "text-white/85" : "text-ink-500"}`}>
        {evento.cuposDisponibles > 0 ? `Quedan ${evento.cuposDisponibles} de ${evento.cupo} cupos` : "Sin cupos"}
      </span>
    </div>
  );
}

const aMinutos = (h) => {
  const [hh, mm] = String(h || "").split(":").map(Number);
  return Number.isInteger(hh) && Number.isInteger(mm) ? hh * 60 + mm : null;
};
// Misma regla del servidor: se marca desde 15 minutos antes hasta 15 despues del final.
function momentoDeMarcar(evento) {
  if (String(evento.fecha).slice(0, 10) !== hoyISO()) return "otro-dia";
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  const ahora = d.getUTCHours() * 60 + d.getUTCMinutes();
  const inicio = aMinutos(evento.horaInicio);
  const fin = aMinutos(evento.horaFin);
  if (inicio === null || fin === null) return "otro-dia";
  if (ahora < inicio - 15) return "antes";
  if (ahora > fin + 15) return "despues";
  return "abierta";
}
const horaCorta = (h, resta = 0) => {
  const m = aMinutos(h) - resta;
  return hora(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
};

function Accion({ evento, ocupado, alInscribir, alCancelar, alMarcar, claro }) {
  // Ya se realizo: solo queda saber si se asistio.
  if (evento.terminado) {
    return evento.asistio ? (
      <span className={`inline-flex items-center gap-1.5 text-sm font-bold cursor-default select-none ${claro ? "text-white" : "text-emerald-800"}`}>
        <Icono nombre="check" size={16} strokeWidth={2.6} />
        Asististe
      </span>
    ) : (
      <span className={`inline-flex items-center text-sm font-bold cursor-default select-none ${claro ? "text-white/85" : "text-ink-500"}`}>No asististe</span>
    );
  }
  if (evento.inscrito) {
    const momento = momentoDeMarcar(evento);
    if (evento.asistio) {
      return (
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold cursor-default select-none ${claro ? "text-white" : "text-emerald-800"}`}>
          <Icono nombre="check" size={16} strokeWidth={2.6} />
          Asististe
        </span>
      );
    }
    if (momento === "abierta") {
      return (
        <div className="flex flex-col gap-1.5">
          <button type="button" disabled={ocupado} onClick={() => alMarcar(evento)} className={`min-h-[48px] px-5 rounded-full font-extrabold inline-flex items-center gap-2 disabled:opacity-60 ${claro ? "bg-white text-primary-dark" : "boton-liquido"}`}>
            <Icono nombre="ubicacion" size={18} strokeWidth={2.2} />
            {ocupado ? "Buscando tu ubicación…" : "Marcar mi asistencia"}
          </button>
          <span className={`text-[13px] ${claro ? "text-white/80" : "text-ink-500"}`}>Debes estar en el lugar del evento.</span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold cursor-default select-none ${claro ? "text-white" : "text-emerald-800"}`}>
          <Icono nombre="check" size={16} strokeWidth={2.6} />
          Inscrito
        </span>
        <button type="button" disabled={ocupado} onClick={() => alCancelar(evento)} className={`min-h-[40px] px-3 rounded-full text-sm font-semibold ${claro ? "text-red-200 hover:bg-white/15" : "text-red-700 hover:bg-red-50"}`}>
          Cancelar inscripción
        </button>
        {momento === "antes" && <span className={`text-[13px] ${claro ? "text-white/80" : "text-ink-500"}`}>Podrás marcar tu asistencia desde las {horaCorta(evento.horaInicio, 15)}.</span>}
      </div>
    );
  }
  if (evento.cuposDisponibles < 1) return <span className={`inline-flex items-center text-sm font-bold cursor-default select-none ${claro ? "text-white/85" : "text-ink-500"}`}>Sin cupos</span>;
  return (
    <button
      type="button"
      disabled={ocupado || !evento.abierta}
      onClick={() => alInscribir(evento)}
      className={`min-h-[44px] px-5 rounded-full font-extrabold disabled:opacity-60 ${claro ? "bg-white text-primary-dark" : "boton-liquido"}`}
    >
      {evento.abierta ? "Inscribirme" : "Inscripción cerrada"}
    </button>
  );
}

function Datos({ evento, claro }) {
  const tono = claro ? "text-white/90" : "text-ink-600";
  return (
    <ul className={`list-none m-0 p-0 flex flex-col gap-1.5 text-sm ${tono}`}>
      <li className="flex items-center gap-2">
        <Icono nombre="reloj" size={16} strokeWidth={2} className="shrink-0" />
        <span className="first-letter:uppercase">{diaLargo(evento.fecha)}, {hora(evento.horaInicio)} a {hora(evento.horaFin)}</span>
      </li>
      {evento.lugar && (
        <li className="flex items-center gap-2">
          <Icono nombre="ubicacion" size={16} strokeWidth={2} className="shrink-0" />
          {evento.lugar}
        </li>
      )}
      {evento.representacion && (
        <li className="flex items-center gap-2">
          <Icono nombre="estrella" size={16} strokeWidth={2} className="shrink-0" />
          {evento.representacion}
        </li>
      )}
    </ul>
  );
}

export function AgendaCultura() {
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [tipo, setTipo] = useState("");

  useEffect(() => {
    http.get("/cultura/agenda").then((r) => setEventos(r.data)).catch(() => setError("No fue posible cargar la agenda."));
  }, []);

  async function accion(evento, inscribir) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r = inscribir ? await http.post(`/cultura/agenda/${evento.id}/inscripcion`) : await http.delete(`/cultura/agenda/${evento.id}/inscripcion`);
      setEventos(r.data);
      setAviso(inscribir ? `Te inscribiste en ${evento.nombre}.` : `Cancelaste tu inscripción en ${evento.nombre}.`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
    } finally {
      setOcupado(false);
    }
  }

  const tipos = useMemo(() => [...new Map((eventos || []).map((e) => [e.categoriaId, e.categoria])).entries()], [eventos]);
  const enHistorial = filtro === "historial";
  const visibles = (eventos || []).filter((e) => {
    if (enHistorial) return e.terminado && (!tipo || e.categoriaId === tipo);
    if (e.terminado) return false;
    const n = diasHasta(e.fecha);
    const pasaFiltro = filtro === "todos" || (filtro === "semana" && n < 7) || (filtro === "mes" && n < 31) || (filtro === "mios" && e.inscrito);
    return pasaFiltro && (!tipo || e.categoriaId === tipo);
  });
  // El historial va en tarjetas iguales, sin una destacada.
  const [destacado, ...resto] = enHistorial ? [null, ...visibles] : visibles;
  const ERRORES_UBICACION = {
    1: "Permite el acceso a tu ubicación en el navegador para poder marcar tu asistencia.",
    2: "No pudimos saber dónde estás. Activa el GPS e inténtalo de nuevo.",
    3: "Tardamos demasiado en ubicarte. Sal a un lugar abierto e inténtalo de nuevo.",
  };
  // Marca la asistencia a este evento con la ubicacion actual.
  function marcar(evento) {
    setError("");
    setAviso("");
    if (!navigator.geolocation) {
      setError("Este navegador no permite usar la ubicación. Prueba con otro o avisa al responsable.");
      return;
    }
    setOcupado(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await http.post("/cultura/asistencia/ubicacion", { latitud: pos.coords.latitude, longitud: pos.coords.longitude, precision: pos.coords.accuracy, eventoId: evento.id });
          setEventos((await http.get("/cultura/agenda")).data);
          setAviso(`Quedó tu asistencia en ${evento.nombre}.`);
        } catch (err) {
          setError(mensajeError(err, "No fue posible registrar tu asistencia."));
        } finally {
          setOcupado(false);
        }
      },
      (err) => {
        setError(ERRORES_UBICACION[err.code] || "No pudimos obtener tu ubicación.");
        setOcupado(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
  const props = { ocupado, alInscribir: (e) => accion(e, true), alCancelar: (e) => accion(e, false), alMarcar: marcar };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-16">
      <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">Agenda cultural</h1>
      <p className="mt-2 mb-4 text-ink-500 max-w-2xl">Presentaciones, muestras y fechas especiales. Cuando empiece un evento en el que estás inscrito, marca tu asistencia desde su tarjeta. En Mi historial ves los que ya se realizaron.</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5">
        <Segmentos compacto className="!p-0.5" etiqueta="Cuándo" opciones={FILTROS} valor={filtro} alCambiar={setFiltro} />
        {tipos.length > 1 && <Segmentos compacto className="!p-0.5" etiqueta="Tipo de evento" opciones={[["", "Todos los tipos"], ...tipos]} valor={tipo} alCambiar={setTipo} />}
      </div>

      {error && <AvisoFlotante tono="error">{error}</AvisoFlotante>}
      {aviso && <AvisoFlotante tono="exito">{aviso}</AvisoFlotante>}

      {!eventos && !error && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Cargando la agenda">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[360px] rounded-[26px] bg-primary-light animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      )}

      {eventos && visibles.length === 0 && (
        <div className="vidrio-panel rounded-[26px] p-10 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-primary-light text-primary grid place-items-center">
            <Icono nombre="calendario" size={26} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-primary-dark">{enHistorial ? "Todavía no tienes eventos anteriores" : eventos.some((e) => !e.terminado) ? "No hay eventos con este filtro" : "Pronto habrá nuevos eventos"}</p>
          {enHistorial && <p className="m-0 text-ink-500 max-w-md">Aquí quedan los eventos en los que te inscribes, con tu asistencia.</p>}
          {!enHistorial && eventos.some((e) => !e.terminado) && (
            <button type="button" onClick={() => { setFiltro("todos"); setTipo(""); }} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold">
              Ver todos
            </button>
          )}
        </div>
      )}

      {destacado && (
        <article className="relative overflow-hidden rounded-[26px] min-h-[240px] sm:min-h-[280px] flex flex-col justify-end mb-5 shadow-[0_24px_60px_-24px_rgba(11,35,71,0.55)]">
          <Foto evento={destacado} />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,18,34,0.05)_15%,rgba(14,18,34,0.55)_55%,rgba(14,18,34,0.92)_100%)]" />
          <div className="absolute top-5 left-5 flex items-start gap-3">
            <Fecha iso={destacado.fecha} />
            <span className="mt-1 inline-flex items-center rounded-md bg-black/65 text-white px-2.5 py-1 text-[13px] font-bold backdrop-blur-sm select-none">{destacado.categoria}</span>
            {etiquetaCuando(destacado) && <span className="mt-1 inline-flex items-center rounded-md bg-white text-primary-dark px-2.5 py-1 text-[13px] font-extrabold ring-1 ring-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)] select-none">{etiquetaCuando(destacado)}</span>}
          </div>
          <div className="relative p-5 sm:p-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-end text-white">
            <div className="flex flex-col gap-2 min-w-0">
              <h2 className="m-0 font-sans text-[24px] sm:text-[30px] leading-[1.08] tracking-[-0.03em] font-extrabold text-white">{destacado.nombre}</h2>
              {destacado.descripcion && <p className="m-0 text-white/85 max-w-[46em] line-clamp-1">{destacado.descripcion}</p>}
              <Datos evento={destacado} claro />
            </div>
            <div className="flex flex-col gap-3 lg:items-stretch">
              {!destacado.terminado && <Cupos evento={destacado} claro />}
              <Accion evento={destacado} {...props} claro />
            </div>
          </div>
        </article>
      )}

      {resto.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {resto.map((e) => (
            <article key={e.id} className="vidrio-panel rounded-[26px] overflow-hidden flex flex-col transition-transform duration-200 ease-salida hover:-translate-y-1 motion-reduce:hover:translate-y-0">
              <div className="relative h-44">
                <Foto evento={e} />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,18,34,0)_50%,rgba(14,18,34,0.45)_100%)]" />
                <Fecha iso={e.fecha} className="absolute top-3 left-3" />
                <span className="absolute top-3 right-3 inline-flex items-center rounded-md bg-black/65 text-white px-2.5 py-1 text-[13px] font-bold backdrop-blur-sm select-none">{e.categoria}</span>
                {etiquetaCuando(e) && <span className="absolute bottom-3 left-3 inline-flex items-center rounded-md bg-white text-primary-dark px-2.5 py-1 text-[13px] font-extrabold ring-1 ring-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.25)] select-none">{etiquetaCuando(e)}</span>}
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <h2 className="m-0 font-sans text-lg font-extrabold leading-snug text-primary-dark">{e.nombre}</h2>
                <Datos evento={e} />
                <div className="mt-auto pt-2 flex flex-col gap-3">
                  {!e.terminado && <Cupos evento={e} />}
                  <Accion evento={e} {...props} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
