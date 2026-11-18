import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { http } from "../../../lib/api/http";
import { formatearFecha, formatearHora, fechaLarga } from "../comunes/lib/format";
import { imagenDeEvento, respaldoDeFoto } from "../comunes/lib/imagenes";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, EstadoVacio, Vacio, botonPrimario, Esqueleto } from "../comunes/componentes/ui";

const FILTROS_ESTADO = [
  ["todos", "Todos"],
  ["disponibles", "Disponibles"],
  ["inscritos", "Inscritos"],
  ["cerrados", "Cerrados"],
];
const FILTROS_MODALIDAD = [
  ["todas", "Todas"],
  ["Presencial", "Presencial"],
  ["Virtual", "Virtual"],
  ["Hibrida", "Híbrida"],
];

// --- SISTEMA DE BOTONES (Interactivos: forma píldora, cursor pointer, hover marcado) ---
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 min-h-[40px] px-5 rounded-full text-sm font-extrabold transition-all duration-150 cursor-pointer select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const BTN_PRIMARIO = `${BTN_BASE} boton-liquido shadow-sm hover:shadow`;
const BTN_SECUNDARIO = `${BTN_BASE} border border-[#BFD0E8] bg-[#F4F8FD] text-primary hover:bg-[#E6EFFB] hover:border-primary/50`;
const BTN_CONTROL =
  "inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-full border border-[#DCE3EE] bg-white text-xs font-extrabold text-ink-900 shadow-2xs hover:bg-[#F6F8FB] hover:border-[#BFD0E8] transition-colors cursor-pointer select-none";
const BTN_PELIGRO_SUTIL =
  "inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 rounded-full text-xs font-bold text-red-700 bg-red-50/70 border border-red-200/70 hover:bg-red-100/80 hover:border-red-300 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none";
const BTN_ENLACE =
  "inline-flex items-center gap-1 text-xs font-extrabold text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary cursor-pointer select-none";

// --- ETIQUETAS DE SOLO VISTA (No interactivas: forma rectangular, fondo plano, sin sombra) ---
const BADGE_BASE =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold cursor-default select-none";

function estadoDe(evento) {
  if (evento.miInscripcion?.estado === "Confirmada") return "inscritos";
  if (!evento.inscripcionAbierta || evento.cuposDisponibles === 0) return "cerrados";
  return "disponibles";
}

function esPasado(fecha) {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  return new Date(fecha) < hoy;
}

function etiquetaModalidad(modalidad) {
  if (modalidad === "Hibrida") return "Híbrida";
  return modalidad || "Presencial";
}

function FilaInscripcion({ inscripcion, destacarProxima = false }) {
  const cancelada = inscripcion.estado !== "Confirmada";
  const d = new Date(inscripcion.evento?.fecha);
  const fechaTexto = fechaLarga(inscripcion.evento?.fecha) || "";

  return (
    <li
      className={`py-3.5 flex items-center gap-3.5 cursor-default ${
        cancelada ? "opacity-60" : ""
      }`}
    >
      <div
        className={`shrink-0 w-12 rounded-xl border overflow-hidden text-center tabular-nums select-none bg-white ${
          destacarProxima ? "border-[#B9CBE6]" : "border-[#DCE3EE]"
        }`}
      >
        <div
          className={`py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
            destacarProxima
              ? "bg-[#E6EEF9] text-primary"
              : "bg-[#EEF2F7] text-ink-500"
          }`}
        >
          {d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" }).replace(".", "")}
        </div>
        <div className="py-1 text-base font-extrabold leading-none text-ink-900">
          {d.getUTCDate()}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {destacarProxima && (
          <span className="inline-block mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
            Próximo evento
          </span>
        )}
        <p className="m-0 text-sm font-extrabold text-ink-900 truncate">
          {inscripcion.evento?.nombre}
        </p>
        <p className="m-0 mt-0.5 text-xs text-ink-500 tabular-nums truncate">
          {fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1)} ·{" "}
          {formatearHora(inscripcion.evento?.horaInicio)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {inscripcion.asistencia && (
          <span
            className={`${BADGE_BASE} ${
              inscripcion.asistencia.asistio
                ? "bg-[#E3F4F1] text-[#0B6B61]"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                inscripcion.asistencia.asistio ? "bg-[#0B6B61]" : "bg-amber-500"
              }`}
            />
            {inscripcion.asistencia.asistio ? "Asististe" : "No asististe"}
          </span>
        )}
        {cancelada && (
          <span className={`${BADGE_BASE} bg-[#EEF2F7] text-ink-500`}>
            {inscripcion.estado}
          </span>
        )}
      </div>
    </li>
  );
}

export function EventosPage() {
  const [eventos, setEventos] = useState(null);
  const [inscripciones, setInscripciones] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [procesando, setProcesando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroModalidad, setFiltroModalidad] = useState("todas");

  function cargar() {
    return Promise.all([http.get("/eventos"), http.get("/eventos/mis-inscripciones")])
      .then(([resEventos, resInscripciones]) => {
        setEventos(resEventos.data.eventos);
        setInscripciones(resInscripciones.data.inscripciones);
      })
      .catch(() => setError("No fue posible cargar los eventos."));
  }

  useEffect(() => {
    cargar();
  }, []);

  async function inscribirse(evento) {
    setError("");
    setAviso("");
    setProcesando(evento.id);
    try {
      await http.post(`/eventos/${evento.id}/inscripciones`);
      setAviso(`¡Listo! Quedaste inscrito/a en "${evento.nombre}".`);
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible completar la inscripción.");
    } finally {
      await cargar();
      setProcesando(null);
    }
  }

  async function cancelarInscripcion(evento) {
    if (!window.confirm(`¿Seguro que quieres cancelar tu inscripción a "${evento.nombre}"?`)) return;
    setError("");
    setAviso("");
    setProcesando(evento.id);
    try {
      await http.patch(`/eventos/${evento.id}/inscripciones/cancelar`);
      setAviso("Tu inscripción fue cancelada y el cupo quedó libre.");
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible cancelar la inscripción.");
    } finally {
      await cargar();
      setProcesando(null);
    }
  }

  const inscritoEn = (evento) => evento.miInscripcion?.estado === "Confirmada";

  const conteoEstado = useMemo(() => {
    const n = { todos: eventos?.length || 0, disponibles: 0, inscritos: 0, cerrados: 0 };
    for (const e of eventos || []) n[estadoDe(e)]++;
    return n;
  }, [eventos]);

  const conteoModalidad = useMemo(() => {
    const n = { todas: eventos?.length || 0 };
    for (const e of eventos || []) n[e.modalidad] = (n[e.modalidad] || 0) + 1;
    return n;
  }, [eventos]);

  const visibles = useMemo(
    () =>
      (eventos || []).filter(
        (e) =>
          (filtroEstado === "todos" || estadoDe(e) === filtroEstado) &&
          (filtroModalidad === "todas" || e.modalidad === filtroModalidad)
      ),
    [eventos, filtroEstado, filtroModalidad]
  );

  const abiertos = (eventos || []).filter((e) => e.inscripcionAbierta && e.cuposDisponibles > 0).length;
  const confirmadas = inscripciones.filter((i) => i.estado === "Confirmada").length;

  const hoyUTC = new Date();
  hoyUTC.setUTCHours(0, 0, 0, 0);
  const proximo = (eventos || [])
    .filter((e) => inscritoEn(e) && new Date(e.fecha) >= hoyUTC)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0];

  const proximasInscripciones = inscripciones
    .filter((i) => !esPasado(i.evento?.fecha))
    .sort((a, b) => new Date(a.evento?.fecha) - new Date(b.evento?.fecha));
  const pasadasInscripciones = inscripciones.filter((i) => esPasado(i.evento?.fecha));

  const fechaProximo = proximo ? fechaLarga(proximo.fecha) || "" : "";
  const diaProximo = proximo ? new Date(proximo.fecha) : null;

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-16">
      <div className="flex flex-col gap-6">
        {/* Encabezado + indicadores compactos de solo lectura + botón de historial */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
              Bienestar · Eventos
            </p>
            <h1 className="m-0 font-sans text-[28px] sm:text-[34px] leading-tight tracking-[-0.02em] font-extrabold text-ink-900">
              Talleres y eventos
            </h1>
            <p className="mt-1 mb-0 text-sm text-ink-500">
              Actividades de Desarrollo Humano. Inscríbete mientras haya cupos disponibles.
            </p>
          </div>

          {eventos && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Bloques de solo lectura: planos, sin borde de botón ni sombra */}
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 border border-[#DCE3EE] px-3.5 py-2 text-xs cursor-default select-none">
                <span className="font-extrabold text-ink-900 tabular-nums text-sm">{abiertos}</span>
                <span className="text-ink-500 font-medium">abiertos</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 border border-[#DCE3EE] px-3.5 py-2 text-xs cursor-default select-none">
                <span className="font-extrabold text-ink-900 tabular-nums text-sm">{confirmadas}</span>
                <span className="text-ink-500 font-medium">confirmadas</span>
              </div>

              {/* Botón de acción: forma de píldora con hover */}
              <button
                type="button"
                onClick={() => setPanelAbierto(true)}
                className={BTN_CONTROL}
              >
                <Icono nombre="lista" size={15} strokeWidth={2.2} className="text-primary" />
                Mis inscripciones ({inscripciones.length})
              </button>
            </div>
          )}
        </header>

        {error && <Aviso>{error}</Aviso>}
        {aviso && <Aviso tono="verde">{aviso}</Aviso>}

        {/* Franja destacada de próximo evento */}
        {proximo && diaProximo && (
          <section
            aria-label="Tu próximo evento"
            className="rounded-2xl bg-white border border-[#DCE3EE] shadow-sm p-4 sm:px-6 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="shrink-0 w-12 rounded-xl border border-[#B9CBE6] overflow-hidden text-center tabular-nums select-none bg-white">
                <div className="py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-[#E6EEF9] text-primary">
                  {diaProximo.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" }).replace(".", "")}
                </div>
                <div className="py-1 text-base font-extrabold leading-none text-ink-900">
                  {diaProximo.getUTCDate()}
                </div>
              </div>

              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#0B6B61]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0B6B61]" />
                  Tu próximo evento confirmado
                </span>
                <p className="m-0 mt-0.5 text-base sm:text-lg font-extrabold text-ink-900 truncate">
                  {proximo.nombre}
                </p>
                <p className="m-0 mt-0.5 text-xs text-ink-500 truncate">
                  {fechaProximo.charAt(0).toUpperCase() + fechaProximo.slice(1)} ·{" "}
                  {formatearHora(proximo.horaInicio)}
                  {proximo.lugar ? ` · ${proximo.lugar}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link to="/asistencia" className={`${BTN_PRIMARIO} no-underline`}>
                <Icono nombre="check" size={15} strokeWidth={2.4} />
                Escanear QR
              </Link>
              {pasadasInscripciones.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPanelAbierto(true)}
                  className={BTN_SECUNDARIO}
                >
                  Ver historial ({pasadasInscripciones.length})
                </button>
              )}
            </div>
          </section>
        )}

        {!eventos && !error && <Esqueleto forma="tarjetas" etiqueta="Cargando eventos…" />}

        {eventos && eventos.length === 0 && (
          <EstadoVacio
            icono="estrella"
            titulo="No hay talleres ni eventos abiertos"
            texto="Cuando Bienestar publique uno, aparecerá aquí para que te inscribas. Mientras tanto puedes pedir una cita de orientación."
            accion={
              <Link to="/estudiante/agendar" className={botonPrimario}>
                Pedir una cita
              </Link>
            }
          />
        )}

        {eventos?.length > 0 && (
          <div className="flex flex-col gap-6">
            {/* Barra de filtros: pestañas con línea inferior para Estado + selector compacto para Modalidad */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE3EE]">
              <nav aria-label="Filtrar por estado" className="flex items-center gap-1 overflow-x-auto -mb-px">
                {FILTROS_ESTADO.map(([id, texto]) => {
                  const activo = filtroEstado === id;
                  const total = conteoEstado[id] || 0;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltroEstado(id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-extrabold border-b-2 transition-colors whitespace-nowrap cursor-pointer select-none ${
                        activo
                          ? "border-primary text-primary"
                          : "border-transparent text-ink-500 hover:text-ink-900 hover:border-[#BFD0E8]"
                      }`}
                    >
                      <span>{texto}</span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                          activo ? "bg-[#E6EEF9] text-primary" : "bg-[#EEF2F7] text-ink-500"
                        }`}
                      >
                        {total}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="pb-2 sm:pb-1.5 flex items-center gap-2 self-start sm:self-auto">
                <label htmlFor="filtro-modalidad" className="text-xs font-bold text-ink-500">
                  Modalidad:
                </label>
                <select
                  id="filtro-modalidad"
                  value={filtroModalidad}
                  onChange={(e) => setFiltroModalidad(e.target.value)}
                  className="min-h-[36px] rounded-full border border-[#DCE3EE] bg-white px-3.5 pr-8 text-xs font-extrabold text-ink-900 shadow-2xs hover:border-[#BFD0E8] focus:outline-none focus:border-primary cursor-pointer"
                >
                  {FILTROS_MODALIDAD.filter(([id]) => id === "todas" || conteoModalidad[id]).map(([id, texto]) => (
                    <option key={id} value={id}>
                      {texto} ({conteoModalidad[id] || 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {visibles.length === 0 ? (
              <Vacio>No hay eventos con estos filtros. Prueba con otra opción.</Vacio>
            ) : (
              /* Cuadrícula de hasta 3 columnas a ancho completo */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibles.map((evento) => {
                  const inscrito = inscritoEn(evento);
                  const imagen = imagenDeEvento(evento);
                  const ocupacion = evento.cupos ? Math.round((evento.inscritos / evento.cupos) * 100) : 0;
                  const bloqueado = !inscrito && (!evento.inscripcionAbierta || evento.cuposDisponibles === 0);
                  const virtual = evento.modalidad && evento.modalidad !== "Presencial";
                  const ubicacion =
                    evento.modalidad === "Virtual"
                      ? "Virtual"
                      : evento.lugar
                        ? `${evento.lugar}${evento.modalidad === "Hibrida" ? " y virtual" : ""}`
                        : "";
                  const fechaEvento = fechaLarga(evento.fecha) || "";

                  return (
                    <article
                      key={evento.id}
                      className="bg-white rounded-2xl border border-[#DCE3EE] shadow-sm overflow-hidden flex flex-col"
                    >
                      {/* Cabecera visual con etiquetas de solo lectura */}
                      <div className="relative h-44 bg-[#EEF2F7]">
                        <img
                          src={imagen.src}
                          alt={imagen.alt}
                          onError={respaldoDeFoto(evento)}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,42,91,0.22)_0%,rgba(11,42,91,0)_50%)]"
                        />
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          {inscrito ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#E3F4F1] px-2.5 py-1 text-xs font-extrabold text-[#0B6B61] cursor-default select-none">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#0B6B61]" />
                              Inscrito/a
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink-900 cursor-default select-none">
                            {etiquetaModalidad(evento.modalidad)}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex flex-col gap-4 flex-1">
                        <div>
                          <h2 className="m-0 text-lg font-extrabold text-ink-900 leading-snug">
                            {evento.nombre}
                          </h2>
                          <ul className="list-none m-0 mt-2.5 p-0 flex flex-col gap-1.5 text-sm text-ink-600">
                            <li className="flex items-center gap-2">
                              <Icono nombre="calendario" size={15} strokeWidth={2} className="text-primary/80 shrink-0" />
                              <span>{fechaEvento.charAt(0).toUpperCase() + fechaEvento.slice(1)}</span>
                            </li>
                            <li className="flex items-center gap-2 tabular-nums">
                              <Icono nombre="reloj" size={15} strokeWidth={2} className="text-primary/80 shrink-0" />
                              <span>
                                {formatearHora(evento.horaInicio)} – {formatearHora(evento.horaFin)}
                              </span>
                            </li>
                            {ubicacion && (
                              <li className="flex items-center gap-2">
                                <Icono nombre="ubicacion" size={15} strokeWidth={2} className="text-primary/80 shrink-0" />
                                <span className="truncate">{ubicacion}</span>
                              </li>
                            )}
                          </ul>
                        </div>

                        {abierto === evento.id && evento.descripcion && (
                          <p className="m-0 text-sm text-ink-600 leading-relaxed whitespace-pre-line">
                            {evento.descripcion}
                          </p>
                        )}
                        {evento.descripcion && (
                          <button
                            type="button"
                            onClick={() => setAbierto(abierto === evento.id ? null : evento.id)}
                            className={`self-start ${BTN_ENLACE}`}
                          >
                            {abierto === evento.id ? "Ocultar detalle" : "Ver detalle"}
                          </button>
                        )}

                        {/* Barra de cupos */}
                        <div className="mt-auto pt-2 flex flex-col gap-1.5 cursor-default select-none">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-extrabold text-ink-900 tabular-nums">
                              {evento.cuposDisponibles} de {evento.cupos} libres
                            </span>
                            <span className="text-ink-500">
                              hasta el {formatearFecha(evento.fechaLimiteInscripcion)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#E6ECF5] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${ocupacion}%` }}
                            />
                          </div>
                        </div>

                        {/* Acciones al pie de tarjeta */}
                        <div className="pt-3 border-t border-[#DCE3EE]/70 flex flex-col gap-2.5">
                          {inscrito ? (
                            <>
                              {!(virtual && evento.enlaceReunion) && (
                                <p className="m-0 flex items-start gap-1.5 text-xs font-medium text-[#0B6B61] cursor-default">
                                  <Icono nombre="check" size={14} strokeWidth={2.4} className="shrink-0 mt-0.5" />
                                  Escanea el código QR en el evento para registrar tu asistencia.
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <Link to="/asistencia" className={`${BTN_PRIMARIO} flex-1 no-underline`}>
                                  <Icono nombre="check" size={15} strokeWidth={2.4} />
                                  Escanear QR
                                </Link>
                                {virtual && evento.enlaceReunion && (
                                  <a
                                    href={evento.enlaceReunion}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${BTN_SECUNDARIO} flex-1 no-underline`}
                                  >
                                    Unirme
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => cancelarInscripcion(evento)}
                                  disabled={procesando === evento.id}
                                  className={`${BTN_PELIGRO_SUTIL} w-full`}
                                >
                                  <Icono nombre="cerrar" size={14} strokeWidth={2.2} />
                                  Cancelar inscripción
                                </button>
                              </div>
                            </>
                          ) : bloqueado ? (
                            <div className="w-full rounded-xl bg-[#EEF2F7] px-3 py-2 text-center text-xs font-bold text-ink-500 cursor-default select-none">
                              {!evento.inscripcionAbierta ? "Inscripciones cerradas" : "Sin cupos disponibles"}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => inscribirse(evento)}
                              disabled={procesando === evento.id}
                              className={`${BTN_PRIMARIO} w-full`}
                            >
                              {procesando === evento.id ? "Inscribiendo…" : "Inscribirme"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel lateral deslizable (Drawer) para Mis inscripciones e Historial */}
      {panelAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            aria-hidden="true"
            onClick={() => setPanelAbierto(false)}
            className="fixed inset-0 bg-ink-900/35 backdrop-blur-[1px]"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-panel-inscripciones"
            className="relative z-10 w-full max-w-md bg-white h-full shadow-2xl border-l border-[#DCE3EE] flex flex-col"
          >
            <div className="px-6 py-5 border-b border-[#DCE3EE] flex items-center justify-between gap-3">
              <div>
                <h2 id="titulo-panel-inscripciones" className="m-0 text-lg font-extrabold text-ink-900">
                  Mis inscripciones
                </h2>
                <p className="m-0 mt-0.5 text-xs text-ink-500">
                  {confirmadas} confirmada{confirmadas === 1 ? "" : "s"} · {pasadasInscripciones.length} en historial
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar panel"
                onClick={() => setPanelAbierto(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#DCE3EE] bg-[#F6F8FB] text-ink-900 hover:bg-[#EAF0F8] cursor-pointer"
              >
                <Icono nombre="cerrar" size={16} strokeWidth={2.2} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {inscripciones.length === 0 ? (
                <EstadoVacio
                  icono="lista"
                  titulo="Aún no te has inscrito a ningún evento"
                  texto="Cuando te inscribas, aquí verás tus talleres con su fecha y lugar."
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <h3 className="m-0 text-xs font-extrabold uppercase tracking-wider text-ink-500">
                      Próximos ({proximasInscripciones.length})
                    </h3>
                    {proximasInscripciones.length > 0 ? (
                      <ul className="list-none m-0 p-0 divide-y divide-[#DCE3EE]/60">
                        {proximasInscripciones.map((i, idx) => (
                          <FilaInscripcion
                            key={i.id}
                            inscripcion={i}
                            destacarProxima={idx === 0 && i.estado === "Confirmada"}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 rounded-xl bg-[#F6F8FB] border border-[#DCE3EE] px-3.5 py-3 text-xs text-ink-500">
                        No tienes eventos próximos inscritos.
                      </p>
                    )}
                  </div>

                  {pasadasInscripciones.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="m-0 text-xs font-extrabold uppercase tracking-wider text-ink-500">
                        Historial ({pasadasInscripciones.length})
                      </h3>
                      <ul className="list-none m-0 p-0 divide-y divide-[#DCE3EE]/60">
                        {pasadasInscripciones.map((i) => (
                          <FilaInscripcion key={i.id} inscripcion={i} />
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}