import { useEffect, useMemo, useState } from "react";
import { http } from "../../../lib/api/http";
import { IMAGENES, urlDelServidor } from "../../../lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
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
  return n === 0 ? "Hoy" : n === 1 ? "Mañana" : n < 7 ? `En ${n} días` : null;
};

const FILTROS = [
  ["todos", "Todos"],
  ["semana", "Esta semana"],
  ["mes", "Este mes"],
  ["mios", "Mis inscripciones"],
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

function Accion({ evento, ocupado, alInscribir, alCancelar, claro }) {
  if (evento.inscrito) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-sm font-bold ${claro ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-800"}`}>
          <Icono nombre="check" size={16} strokeWidth={2.6} />
          Inscrito
        </span>
        <button type="button" disabled={ocupado} onClick={() => alCancelar(evento)} className={`min-h-[40px] px-3 rounded-full text-sm font-semibold ${claro ? "text-white/85 hover:bg-white/15" : "text-ink-500 hover:bg-white"}`}>
          Cancelar
        </button>
      </div>
    );
  }
  if (evento.cuposDisponibles < 1) return <span className={`inline-flex min-h-[44px] items-center px-4 rounded-full text-sm font-bold ${claro ? "bg-white/20 text-white" : "burbuja text-ink-500"}`}>Sin cupos</span>;
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
  const visibles = (eventos || []).filter((e) => {
    const n = diasHasta(e.fecha);
    const pasaFiltro = filtro === "todos" || (filtro === "semana" && n < 7) || (filtro === "mes" && n < 31) || (filtro === "mios" && e.inscrito);
    return pasaFiltro && (!tipo || e.categoriaId === tipo);
  });
  const [destacado, ...resto] = visibles;
  const props = { ocupado, alInscribir: (e) => accion(e, true), alCancelar: (e) => accion(e, false) };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-16">
      <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">Agenda cultural</h1>
      <p className="mt-2 mb-6 text-ink-500 max-w-2xl">Presentaciones, muestras y fechas especiales. Inscríbete y el día del evento registra tu asistencia con el código que te muestran.</p>

      <div className="flex flex-col gap-3 mb-6">
        <div role="group" aria-label="Cuándo" className="flex flex-wrap gap-2">
          {FILTROS.map(([id, texto]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`min-h-[40px] px-4 rounded-full text-sm font-bold ${filtro === id ? "boton-liquido" : "burbuja text-ink-600 hover:bg-white"}`}>
              {texto}
            </button>
          ))}
        </div>
        {tipos.length > 1 && (
          <div role="group" aria-label="Tipo de evento" className="flex flex-wrap gap-2">
            {[["", "Todos los tipos"], ...tipos].map(([id, texto]) => (
              <button key={id || "todos"} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)} className={`min-h-[36px] px-3.5 rounded-full text-[13px] font-semibold ${tipo === id ? "bg-primary-dark text-white" : "text-ink-600 hover:bg-white"}`}>
                {texto}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="m-0 mb-4 text-sm border rounded-xl px-4 py-3 bg-red-50 text-red-700 border-red-100">{error}</p>}
      {aviso && <p className="m-0 mb-4 text-sm border rounded-xl px-4 py-3 bg-emerald-50 text-emerald-800 border-emerald-100">{aviso}</p>}

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
          <p className="m-0 text-lg font-extrabold text-primary-dark">{eventos.length ? "No hay eventos con este filtro" : "Pronto habrá nuevos eventos"}</p>
          {eventos.length > 0 && (
            <button type="button" onClick={() => { setFiltro("todos"); setTipo(""); }} className="min-h-[40px] px-4 rounded-full burbuja text-primary-dark font-bold">
              Ver todos
            </button>
          )}
        </div>
      )}

      {destacado && (
        <article className="relative overflow-hidden rounded-[30px] min-h-[380px] sm:min-h-[420px] flex flex-col justify-end mb-6 shadow-[0_24px_60px_-24px_rgba(11,35,71,0.55)]">
          <Foto evento={destacado} />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,18,34,0.05)_15%,rgba(14,18,34,0.55)_55%,rgba(14,18,34,0.92)_100%)]" />
          <div className="absolute top-5 left-5 flex items-start gap-3">
            <Fecha iso={destacado.fecha} />
            <span className="mt-1 inline-flex items-center rounded-full bg-white/90 text-primary-dark px-3 py-1 text-xs font-bold">{destacado.categoria}</span>
            {cuando(destacado.fecha) && <span className="mt-1 inline-flex items-center rounded-full boton-liquido px-3 py-1 text-xs font-bold">{cuando(destacado.fecha)}</span>}
          </div>
          <div className="relative p-6 sm:p-8 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-end text-white">
            <div className="flex flex-col gap-3 min-w-0">
              <h2 className="m-0 font-sans text-[28px] sm:text-[38px] leading-[1.05] tracking-[-0.03em] font-extrabold text-white">{destacado.nombre}</h2>
              {destacado.descripcion && <p className="m-0 text-white/85 max-w-[46em] line-clamp-2">{destacado.descripcion}</p>}
              <Datos evento={destacado} claro />
            </div>
            <div className="flex flex-col gap-4 lg:items-stretch">
              <Cupos evento={destacado} claro />
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
                <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-white/90 text-primary-dark px-3 py-1 text-xs font-bold">{e.categoria}</span>
                {cuando(e.fecha) && <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full boton-liquido px-3 py-1 text-xs font-bold">{cuando(e.fecha)}</span>}
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <h2 className="m-0 font-sans text-lg font-extrabold leading-snug text-primary-dark">{e.nombre}</h2>
                <Datos evento={e} />
                <div className="mt-auto pt-2 flex flex-col gap-3">
                  <Cupos evento={e} />
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
