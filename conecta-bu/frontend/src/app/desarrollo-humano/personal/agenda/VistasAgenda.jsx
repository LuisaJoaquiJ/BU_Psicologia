import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "../../comunes/componentes/Iconos";
import { iniciales } from "../../comunes/componentes/Navbar";
import { fechaLarga, formatearHora } from "../../comunes/lib/format";
import {
  ESTILOS,
  ORDEN_LEYENDA,
  bloqueosDelDia,
  celdasDelMes,
  claveVisual,
  colocar,
  correoDe,
  dia,
  diaCorto,
  diasVisibles,
  esPorRegistrar,
  fechaLegible,
  hora12,
  isoDe,
  limitesHoras,
  mesPrevio,
  minutosUTC,
  nombreMes,
  parseISO,
  puedeRegistrar,
  puedeReprogramar,
  cierreVigente,
  rangoHora,
  servicioCorto,
  tasaMes,
  tituloSemana,
} from "./modelo";

const ALTO_HORA = 64;

function cajaFlotante(ancla, ancho, alto) {
  const margen = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = ancla.right + 8;
  if (left + ancho > vw - margen) left = ancla.left - ancho - 8;
  left = Math.max(margen, Math.min(left, vw - ancho - margen));
  let top = ancla.top;
  if (top + alto > vh - margen) top = Math.max(margen, vh - alto - margen);
  return { left, top };
}

export function Flotante({ ancla, etiqueta, ancho = 340, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ancla) return undefined;
    const medir = () => setPos(cajaFlotante(ancla, el.offsetWidth || ancho, el.offsetHeight || 120));
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ancla, ancho, children]);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={etiqueta}
      data-popover
      style={{ position: "fixed", width: ancho, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}
      className="relative z-[45] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,34,56,0.18)]"
    >
      {children}
    </div>,
    document.body,
  );
}

function InsigniaEstado({ clave }) {
  const estilo = ESTILOS[clave] || ESTILOS.agendada;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${estilo.badge}`}>{estilo.texto}</span>;
}

export function BotonesAsistencia({ cita, registrando, onRegistrar, grande = false }) {
  const clase = grande ? "min-h-[44px] flex-1" : "min-h-[40px]";
  return (
    <div className={`flex items-center gap-2 ${grande ? "w-full" : "justify-end"}`}>
      <button
        type="button"
        disabled={registrando}
        onClick={() => onRegistrar(cita, true)}
        className={`${clase} inline-flex items-center justify-center gap-1.5 rounded-full border border-[#0E6B4A] bg-white px-3 text-sm font-bold text-[#0E6B4A] hover:bg-[#DDF3EA] disabled:opacity-60`}
      >
        <Icono nombre="check" size={16} strokeWidth={2.4} /> Asistió
      </button>
      <button
        type="button"
        disabled={registrando}
        onClick={() => onRegistrar(cita, false)}
        className={`${clase} inline-flex items-center justify-center gap-1.5 rounded-full border border-red-600 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60`}
      >
        <Icono nombre="cerrar" size={16} strokeWidth={2.4} /> No asistió
      </button>
    </div>
  );
}

function Linea({ icono, children }) {
  return (
    <p className="m-0 flex items-start gap-2.5 text-sm text-ink-900">
      <span className="mt-0.5 text-primary">
        <Icono nombre={icono} size={16} strokeWidth={2} />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function DetalleCita({ cita, hoy, ahoraMin, registrando, onRegistrar, onReprogramar, onCerrar }) {
  const clave = claveVisual(cita, hoy, ahoraMin);
  const { ini, fin } = rangoHora(cita);
  const correo = correoDe(cita);
  return (
    <>
      <button type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-ink-500 hover:bg-gray-100">
        <Icono nombre="cerrar" size={16} strokeWidth={2.2} />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-light text-sm font-extrabold text-primary">{iniciales(cita.usuario?.nombre)}</span>
        <span className="min-w-0">
          <span className="block truncate font-extrabold text-ink-900">{cita.usuario?.nombre}</span>
          {correo && <span className="block truncate text-xs text-ink-500">{correo}</span>}
        </span>
      </div>
      <InsigniaEstado clave={clave} />
      <div className="flex flex-col gap-2">
        <Linea icono="cuadricula">
          {cita.horario?.servicio?.nombre}
          {cita.horario?.sinCita && <span className="font-bold text-[#8A4B00]"> · Sin cita</span>}
        </Linea>
        <Linea icono="calendario">{fechaLegible(dia(cita))}</Linea>
        <Linea icono="reloj">
          {formatearHora(cita.horario?.horaInicio)} – {hora12(fin)}
        </Linea>
      </div>
      {clave === "registrar" && (
        <p className="m-0 rounded-xl border border-[#F2C46D] bg-[#FFF6E0] px-3 py-2 text-sm text-[#7A5405]">¿El estudiante vino a la cita? Regístralo aquí.</p>
      )}
      {clave === "cerrada" && (
        <p className="m-0 rounded-xl border border-[#D5DCE6] bg-[#EEF1F6] px-3 py-2 text-sm text-[#3D4C63]">
          El sistema la marcó como no asistió porque nadie registró la asistencia.
          {puedeRegistrar(cita, hoy) ? " Puedes corregirlo durante 7 días." : " Ya pasó el plazo de 7 días para corregirla."}
        </p>
      )}
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        {puedeRegistrar(cita, hoy) ? (
          <BotonesAsistencia cita={cita} registrando={registrando} onRegistrar={onRegistrar} grande />
        ) : cita.estado === "Cancelada" ? (
          <p className="m-0 text-sm text-ink-500">Horario liberado</p>
        ) : (
          !puedeReprogramar(cita) && <p className="m-0 text-sm text-ink-500">Inicio {hora12(ini)} · fin {hora12(fin)}</p>
        )}
        {puedeReprogramar(cita) && (
          <button type="button" onClick={() => onReprogramar(cita)} className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-primary bg-white px-3 text-sm font-bold text-primary hover:bg-primary-light">
            <Icono nombre="editar" size={16} strokeWidth={2.2} /> Reprogramar
          </button>
        )}
      </div>
    </>
  );
}

export function KpiAgenda({ hoy, ahoraMin, citas, semana, listo = true }) {
  if (!listo) {
    return (
      <section aria-label="Resumen de la agenda" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["Citas hoy", "Esta semana", "Por registrar", "Asistencia del mes"].map((titulo) => (
          <Tarjeta key={titulo} titulo={titulo} valor="…" detalle="Cargando citas" destacado={titulo === "Por registrar"} />
        ))}
      </section>
    );
  }
  const deHoy = citas.filter((c) => dia(c) === hoy && c.estado !== "Cancelada");
  const masTarde = deHoy.filter((c) => {
    const ini = minutosUTC(c.horario?.horaInicio);
    return c.estado === "Agendada" && ini != null && ini > ahoraMin;
  }).length;
  const deSemana = citas.filter((c) => dia(c) >= semana.desde && dia(c) <= semana.hasta && c.estado !== "Cancelada").length;
  const porRegistrar = citas.filter((c) => esPorRegistrar(c, hoy, ahoraMin)).length;
  const cerradas = citas.filter((c) => cierreVigente(c)).length;
  const previo = mesPrevio(hoy);
  const actual = tasaMes(citas, hoy.slice(0, 7));
  const anterior = tasaMes(citas, previo.clave);
  const delta = actual != null && anterior != null ? actual - anterior : null;
  return (
    <section aria-label="Resumen de la agenda" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta titulo="Citas hoy" valor={deHoy.length} detalle={masTarde ? `${masTarde} pendiente${masTarde > 1 ? "s" : ""} esta tarde` : "Sin citas pendientes"} />
      <Tarjeta titulo="Esta semana" valor={deSemana} detalle={semana.texto} />
      <Tarjeta
        titulo="Por registrar"
        valor={porRegistrar}
        detalle={cerradas ? `Marca la asistencia · ${cerradas} ${cerradas === 1 ? "la cerró" : "las cerró"} el sistema` : "Marca si el estudiante asistió"}
        destacado
      />
      <Tarjeta
        titulo="Asistencia del mes"
        valor={actual == null ? "Sin datos" : `${actual} %`}
        detalle={
          actual == null
            ? "Aún no hay asistencia registrada este mes"
            : delta == null
              ? "Asistieron frente a quienes ya tienen registro"
                : delta === 0
                ? `Igual que ${previo.nombre}`
                : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)} puntos vs. ${previo.nombre}`
        }
        detalleClase={delta > 0 ? "font-semibold text-[#0E6B4A]" : delta < 0 ? "font-semibold text-red-700" : ""}
      />
    </section>
  );
}

function Tarjeta({ titulo, valor, detalle, destacado, detalleClase = "" }) {
  return (
    <article className={`rounded-xl border p-4 ${destacado ? "border-[#F5D77E] bg-[#FFFCF2]" : "border-gray-200 bg-white"}`}>
      <p className="m-0 text-sm text-ink-500">{titulo}</p>
      <p className={`m-0 mt-1 font-display text-[32px] font-semibold leading-none tabular-nums ${destacado ? "text-[#7A5405]" : "text-ink-900"}`}>{valor}</p>
      {detalle && <p className={`m-0 mt-2 text-[13px] text-ink-500 ${detalleClase}`}>{detalle}</p>}
    </article>
  );
}

export function AvisoRegistrar({ cantidad, cerradas = 0, onVer }) {
  if (!cantidad) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#F2C46D] bg-[#FFF6E0] px-4 py-3 text-sm" role="status">
      <span className="text-[#7A5405]">
        <Icono nombre="alerta" size={18} strokeWidth={2} />
      </span>
      <p className="m-0 min-w-0 flex-1 text-ink-900">
        <strong className="text-[#7A5405]">
          Tienes {cantidad} {cantidad === 1 ? "cita" : "citas"} por registrar.
        </strong>{" "}
        <span className="text-ink-600">
          {cerradas
            ? `${cerradas === 1 ? "Una la cerró" : `${cerradas} las cerró`} el sistema; puedes corregirlas durante 7 días.`
            : "Registra la asistencia para que las estadísticas estén al día."}
        </span>
      </p>
      <button type="button" onClick={onVer} className="min-h-[40px] rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-ink-900 hover:bg-gray-50">
        Ver por registrar
      </button>
    </div>
  );
}

export function Leyenda() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-ink-600">
      {ORDEN_LEYENDA.map((id) => (
        <span key={id} className="inline-flex items-center gap-1.5">
          <i className={`block h-3 w-3 rounded-sm border-l-[3px] ${ESTILOS[id].bloque}`} />
          {ESTILOS[id].leyenda}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 sm:ml-auto">
        <i className="block h-3 w-3 rounded-sm border border-[#F5D77E] bg-[#FFFBEF]" /> Hoy
      </span>
    </div>
  );
}

export function MiniCalendario({ ancla, hoy, citas, seleccionado, onElegir }) {
  const [mes, setMes] = useState(() => {
    const base = parseISO(seleccionado || hoy);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const anio = mes.getFullYear();
  const m = mes.getMonth();
  const primero = (new Date(anio, m, 1).getDay() + 6) % 7;
  const dias = new Date(anio, m + 1, 0).getDate();
  const conCitas = new Set(citas.map((c) => dia(c)));
  const celdas = [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  return (
    <Flotante ancla={ancla} etiqueta="Ir a una fecha" ancho={300}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => setMes(new Date(anio, m - 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-primary-light">
          <Icono nombre="izquierda" size={16} strokeWidth={2.2} />
        </button>
        <p className="m-0 text-sm font-extrabold text-ink-900">
          {nombreMes(m)} {anio}
        </p>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMes(new Date(anio, m + 1, 1))} className="grid h-8 w-8 place-items-center rounded-full text-primary hover:bg-primary-light">
          <Icono nombre="derecha" size={16} strokeWidth={2.2} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((n, i) => {
          if (!n) return <span key={`v${i}`} />;
          const iso = isoDe(new Date(anio, m, n));
          const sel = iso === seleccionado;
          const esHoy = iso === hoy;
          const finde = [0, 6].includes(new Date(anio, m, n).getDay());
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onElegir(iso)}
              className={`relative grid h-9 place-items-center rounded-lg text-sm font-bold ${
                sel ? "bg-primary-dark text-white" : esHoy ? "bg-accent text-white" : finde ? "text-ink-500 hover:bg-primary-light" : "text-ink-900 hover:bg-primary-light"
              }`}
            >
              {n}
              {conCitas.has(iso) && <i className={`absolute bottom-1 h-1 w-1 rounded-full ${sel || esHoy ? "bg-gold" : "bg-primary"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <i className="h-1.5 w-1.5 rounded-full bg-primary" /> Días con citas
        </span>
        <button type="button" onClick={() => onElegir(hoy)} className="text-sm font-bold text-primary hover:underline">
          Ir a hoy
        </button>
      </div>
    </Flotante>
  );
}

function NotaBloqueo({ bloqueo }) {
  return (
    <p className="m-0 bg-[#FFF1DC] px-4 py-2 text-sm text-[#5C4206]">
      <strong>No disponible: {bloqueo.motivo}</strong>
      {bloqueo.detalle ? ` · ${bloqueo.detalle}` : ""}
      {bloqueo.todoElDia || !bloqueo.horaInicio ? " · todo el día" : ` · ${formatearHora(bloqueo.horaInicio)} a ${formatearHora(bloqueo.horaFin)}`}
    </p>
  );
}

export function VistaLista({ grupos, hoy, ahoraMin, bloqueos, registrando, onRegistrar, onReprogramar, onVer, vacio }) {
  if (!grupos.length) return vacio;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="hidden grid-cols-[128px_minmax(0,1.6fr)_minmax(0,1fr)_148px_minmax(210px,auto)] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500 md:grid">
        <span>Hora</span>
        <span>Estudiante</span>
        <span>Servicio</span>
        <span>Estado</span>
        <span className="text-right">Acciones</span>
      </div>
      {grupos.map((g) => {
        const esHoy = g.dia === hoy;
        return (
          <section key={g.dia} aria-label={fechaLarga(`${g.dia}T12:00:00Z`)}>
            <h2 className={`m-0 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-extrabold ${esHoy ? "bg-[#FFF6E0] text-ink-900" : "bg-gray-50 text-ink-900"}`}>
              <span>
                {esHoy ? `Hoy · ${fechaLarga(`${g.dia}T12:00:00Z`).toLowerCase()}` : fechaLarga(`${g.dia}T12:00:00Z`)}
                {esHoy && <span className="ml-2 inline-flex items-center rounded-full bg-accent px-2 py-0.5 align-middle text-[11px] font-bold text-white">Hoy</span>}
              </span>
              <span className="text-xs font-semibold tabular-nums text-ink-500">
                {g.citas.length} {g.citas.length === 1 ? "cita" : "citas"}
              </span>
            </h2>
            {bloqueosDelDia(bloqueos, g.dia).map((b) => (
              <NotaBloqueo key={b.id} bloqueo={b} />
            ))}
            <ul className="m-0 list-none p-0 divide-y divide-gray-100">
              {g.citas.map((c) => {
                const clave = claveVisual(c, hoy, ahoraMin);
                const fin = minutosUTC(c.horario?.horaFin);
                return (
                  <li key={c.id} className={`px-4 py-3 ${esHoy ? "bg-[#FFFCF2]" : "bg-white"}`}>
                    <div className="grid items-center gap-3 md:grid-cols-[128px_minmax(0,1.6fr)_minmax(0,1fr)_148px_minmax(210px,auto)]">
                      <div>
                        <span className="block font-extrabold tabular-nums text-ink-900">{formatearHora(c.horario?.horaInicio)}</span>
                        {fin != null && <span className="block text-xs text-ink-500">hasta {hora12(fin, { conSufijo: false })}</span>}
                      </div>
                      <button type="button" data-cita-ancla={c.id} onClick={(e) => onVer(c, e.currentTarget)} className="flex min-w-0 items-center gap-3 text-left">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-light text-sm font-extrabold text-primary">{iniciales(c.usuario?.nombre)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-ink-900">{c.usuario?.nombre}</span>
                          <span className="block truncate text-xs text-ink-500">{correoDe(c)}</span>
                        </span>
                      </button>
                      <span className="text-sm text-ink-600">
                        {c.horario?.servicio?.nombre}
                        {c.horario?.sinCita && <span className="font-bold text-[#8A4B00]"> · Sin cita</span>}
                      </span>
                      <span>
                        <InsigniaEstado clave={clave} />
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {puedeRegistrar(c, hoy) && <BotonesAsistencia cita={c} registrando={registrando} onRegistrar={onRegistrar} />}
                        {puedeReprogramar(c) && (
                          <button type="button" onClick={() => onReprogramar(c)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-sm font-bold text-primary hover:underline">
                            <Icono nombre="editar" size={15} strokeWidth={2.2} /> Reprogramar
                          </button>
                        )}
                        {!puedeRegistrar(c, hoy) && !puedeReprogramar(c) && c.estado === "Cancelada" && <p className="m-0 text-sm text-ink-500">Horario liberado</p>}
                        {!puedeRegistrar(c, hoy) && !puedeReprogramar(c) && c.estado !== "Cancelada" && (
                          <button type="button" data-cita-ancla={c.id} onClick={(e) => onVer(c, e.currentTarget)} className="min-h-[40px] px-2 text-sm font-bold text-primary hover:underline">
                            Ver
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function rangoBloqueo(b) {
  if (!b || b.todoElDia || !b.horaInicio || !b.horaFin) return null;
  const ini = minutosUTC(b.horaInicio);
  const fin = minutosUTC(b.horaFin);
  if (ini == null || fin == null || fin <= ini) return null;
  return { ini, fin };
}

export function VistaSemana({ lunes, citas, bloqueos, hoy, ahoraMin, activaId, onAbrir }) {
  const dias = diasVisibles(lunes, citas, bloqueos);
  const citasSemana = citas.filter((c) => dias.some((d) => isoDe(d) === dia(c)));
  const bloqueosSemana = bloqueos.filter((b) => dias.some((d) => isoDe(d) >= b.fechaInicio && isoDe(d) <= b.fechaFin));
  const { desde, hasta } = limitesHoras(citasSemana, bloqueosSemana);
  const alto = ((hasta - desde) / 60) * ALTO_HORA;
  const horas = [];
  for (let h = desde / 60 + 1; h < hasta / 60; h += 1) horas.push(h);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] overflow-hidden rounded-xl border border-gray-200 bg-white" style={{ "--dias": dias.length }}>
        <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: `64px repeat(${dias.length}, minmax(0, 1fr))` }}>
          <div />
          {dias.map((d) => {
            const iso = isoDe(d);
            const n = citas.filter((c) => dia(c) === iso && c.estado !== "Cancelada").length;
            const esHoy = iso === hoy;
            return (
              <div key={iso} className={`flex items-center gap-2 border-l border-gray-200 px-3 py-2.5 ${esHoy ? "bg-[#FFF6E0]" : ""}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-full text-lg font-extrabold ${esHoy ? "bg-accent text-white" : "text-ink-900"}`}>{d.getDate()}</span>
                <span className={`text-xs font-bold uppercase tracking-wide ${esHoy ? "text-[#8A4B00]" : "text-ink-500"}`}>{diaCorto(iso)}</span>
                <span className="ml-auto text-xs font-semibold text-ink-500">{n ? `${n} ${n === 1 ? "cita" : "citas"}` : ""}</span>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${dias.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: alto }}>
            {horas.map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-ink-500" style={{ top: (h - desde / 60) * ALTO_HORA }}>
                {hora12(h * 60)}
              </span>
            ))}
          </div>
          {dias.map((d) => {
            const iso = isoDe(d);
            const esHoy = iso === hoy;
            const delDia = citas.filter((c) => dia(c) === iso);
            const puestos = colocar(delDia);
            const delBloqueo = bloqueosDelDia(bloqueos, iso);
            const todoElDia = delBloqueo.some((b) => b.todoElDia || !rangoBloqueo(b));
            const ahora = esHoy && ahoraMin > desde && ahoraMin < hasta ? ((ahoraMin - desde) / 60) * ALTO_HORA : null;
            return (
              <div
                key={iso}
                className="relative border-l border-gray-200"
                style={{
                  height: alto,
                  backgroundColor: todoElDia ? "#FFF8E8" : esHoy ? "#FFFBEF" : "#fff",
                  backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 63px, #E8E8EC 63px 64px)",
                }}
              >
                {todoElDia && (
                  <div className="pointer-events-none absolute inset-x-1 top-1 z-0 truncate rounded-md bg-[#FFF6E0]/95 px-2 py-1 text-[11px] font-bold text-[#7A5405]" title={delBloqueo.map((b) => b.motivo).join(", ")}>
                    {delBloqueo.map((b) => b.motivo).join(" · ")}
                  </div>
                )}
                {delBloqueo.map((b) => {
                  const rango = rangoBloqueo(b);
                  if (!rango) return null;
                  const ini = Math.max(rango.ini, desde);
                  const finH = Math.min(rango.fin, hasta);
                  if (finH <= ini) return null;
                  return (
                    <div
                      key={b.id}
                      className="pointer-events-none absolute inset-x-1 z-0 overflow-hidden rounded-md bg-[#FFF6E0]/90 px-1 text-[11px] font-bold leading-4 text-[#7A5405]"
                      style={{ top: ((ini - desde) / 60) * ALTO_HORA, height: ((finH - ini) / 60) * ALTO_HORA }}
                    >
                      {b.motivo}
                    </div>
                  );
                })}
                {puestos.map(({ cita, ini, fin, col, cols }) => {
                  const clave = claveVisual(cita, hoy, ahoraMin);
                  const estilo = ESTILOS[clave];
                  const top = ((ini - desde) / 60) * ALTO_HORA + 1;
                  const height = Math.max(((fin - ini) / 60) * ALTO_HORA - 2, 0);
                  const ancho = `calc((100% - 8px) / ${cols})`;
                  return (
                    <button
                      key={cita.id}
                      type="button"
                      data-cita-ancla={cita.id}
                      onClick={(e) => onAbrir(cita, e.currentTarget)}
                      aria-label={`${formatearHora(cita.horario?.horaInicio)}, ${cita.usuario?.nombre}, ${estilo.texto}`}
                      className={`absolute z-[1] overflow-hidden rounded-lg border-0 border-l-4 px-2 py-1 text-left shadow-sm hover:brightness-95 ${estilo.bloque} ${activaId === cita.id ? "outline outline-2 outline-offset-1 outline-primary-dark" : ""}`}
                      style={{ top, height, width: ancho, left: `calc(4px + ${col} * (100% - 8px) / ${cols})` }}
                    >
                      <span className={`block truncate text-[12.5px] font-extrabold ${clave === "cancelada" ? "line-through" : ""}`}>{cita.usuario?.nombre}</span>
                      <span className="block truncate text-[11px]">
                        {hora12(ini, { conSufijo: false })}–{hora12(fin, { conSufijo: false })} · {servicioCorto(cita.horario?.servicio?.nombre)}
                      </span>
                      {height > 52 && <span className="block truncate text-[11px]">{estilo.texto}</span>}
                    </button>
                  );
                })}
                {ahora != null && (
                  <div className="pointer-events-none absolute left-0 right-0 z-[2]" style={{ top: ahora }} title={`Ahora · ${hora12(ahoraMin)}`}>
                    <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                    <span className="absolute left-0 right-0 top-0 h-0.5 bg-accent" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only">{tituloSemana(dias[0], dias)}</p>
    </div>
  );
}

export function VistaMes({ mes, citas, bloqueos, hoy, ahoraMin, onElegirDia }) {
  const celdas = celdasDelMes(mes.getFullYear(), mes.getMonth());
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 bg-gray-50 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d, i) => (
          <div key={d} className={`px-2 py-2.5 ${i === 0 ? "" : "border-l border-gray-200"}`}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d, i) => {
          const iso = isoDe(d);
          const fuera = d.getMonth() !== mes.getMonth();
          const finde = d.getDay() === 0 || d.getDay() === 6;
          const esHoy = iso === hoy;
          const delDia = citas.filter((c) => dia(c) === iso);
          const activas = delDia.filter((c) => c.estado !== "Cancelada");
          const porRegistrar = delDia.filter((c) => esPorRegistrar(c, hoy, ahoraMin)).length;
          const delBloqueo = bloqueosDelDia(bloqueos, iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onElegirDia(iso)}
              aria-label={`${fechaLegible(iso)}: ${activas.length} citas`}
              className={`flex min-h-[88px] flex-col items-start gap-1 border-t border-gray-200 p-2 text-left sm:min-h-[112px] ${i % 7 === 0 ? "" : "border-l"} ${
                esHoy ? "bg-[#FFFBEF]" : fuera ? "bg-[#FBF8F2] text-ink-500" : finde ? "bg-[#FBFAF7]" : "bg-white hover:bg-primary-light/40"
              }`}
            >
              <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-extrabold ${esHoy ? "bg-accent text-white" : ""}`}>{d.getDate()}</span>
              {delDia.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {delDia.slice(0, 6).map((c) => (
                    <i key={c.id} title={ESTILOS[claveVisual(c, hoy, ahoraMin)].texto} className={`h-2 w-2 rounded-full ${ESTILOS[claveVisual(c, hoy, ahoraMin)].punto}`} />
                  ))}
                </span>
              )}
              {activas.length > 0 && (
                <span className="text-xs font-bold text-primary-dark">
                  {activas.length} {activas.length === 1 ? "cita" : "citas"}
                </span>
              )}
              {porRegistrar > 0 && <span className="rounded-full bg-[#FFF6E0] px-1.5 py-0.5 text-[11px] font-bold text-[#7A5405]">{porRegistrar} por registrar</span>}
              {delBloqueo.map((b) => (
                <span key={b.id} className="max-w-full truncate text-[11px] font-bold text-[#8A4B00]">
                  {b.motivo}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SelectorHorarios({ horarios, eligiendo, onElegir }) {
  if (!horarios) return <p className="m-0 text-ink-500">Buscando horarios libres…</p>;
  if (!horarios.length) return <p className="m-0 text-ink-500">No hay horarios libres de este servicio que todavía no empiecen.</p>;
  const grupos = [];
  const ordenados = [...horarios].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.horaInicio).localeCompare(String(b.horaInicio)));
  for (const h of ordenados) {
    const clave = String(h.fecha).slice(0, 10);
    if (!grupos.length || grupos.at(-1).dia !== clave) grupos.push({ dia: clave, horarios: [] });
    grupos.at(-1).horarios.push(h);
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-ink-500">Mismo servicio, en un horario libre que todavía no empieza. El horario actual queda libre.</p>
      {grupos.map((g) => (
        <section key={g.dia}>
          <h3 className="m-0 mb-2 text-sm font-extrabold">{fechaLarga(`${g.dia}T12:00:00Z`)}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {g.horarios.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={eligiendo}
                  onClick={() => onElegir(h.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-primary disabled:opacity-60"
                >
                  <span>
                    <span className="block font-bold text-ink-900">
                      {formatearHora(h.horaInicio)} – {formatearHora(h.horaFin)}
                    </span>
                    <span className="block text-sm text-ink-500">{h.servicio?.nombre}</span>
                  </span>
                  <span className="text-sm font-bold text-primary">Elegir</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function useClicFuera(abierto, cerrar) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alClic = (e) => {
      if (e.target.closest?.("[data-popover]") || e.target.closest?.("[data-abre]") || e.target.closest?.("[data-cita-ancla]")) return;
      cerrar();
    };
    const alTecla = (e) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto, cerrar]);
}

export function anclaDe(el) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}
