import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { Aviso, Vacio, EstadoVacio, botonSecundario, Esqueleto } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// RF-004 / RF-005 · HU-07 a HU-10: pedir una cita en tres pasos
// (servicio → día y hora → confirmar). Solo se crea la cita al confirmar.
// ?servicio=<id> (desde la página de Servicios) salta directo al paso 2.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_CORTOS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const PASOS = ["Servicio", "Día y hora", "Confirmar"];

const OPCION_LIBRE = "bg-white border-[1.5px] border-gray-200 text-ink-900 hover:border-[#0B6B61]/50 hover:bg-gray-50/80";
const OPCION_ELEGIDA = "bg-[#D5EFEA]/60 border-2 border-[#0B6B61] text-[#0B6B61] shadow-sm";
const BOTON_PRIMARIO =
  "inline-flex items-center justify-center gap-2 min-h-[50px] px-7 rounded-full border-[1.5px] border-[#0B6B61] bg-[#0B6B61] text-white font-extrabold text-[15px] cursor-pointer transition-all duration-150 hover:bg-[#095a52] hover:shadow-md active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed";
const BOTON_CONTINUAR = `${BOTON_PRIMARIO} w-full`;
const BOTON_CAMBIAR =
  "inline-flex items-center justify-center gap-1.5 min-h-[38px] px-4 rounded-full border-[1.5px] border-gray-200 bg-white text-ink-700 text-xs sm:text-sm font-bold cursor-pointer transition-all duration-150 hover:bg-gray-50 hover:border-gray-300 active:translate-y-px shrink-0";

function iconoServicio(nombre = "") {
  const n = nombre.toLowerCase();
  if (n.includes("psico")) return "corazon";
  if (n.includes("nutri")) return "ola";
  if (n.includes("deporte") || n.includes("fisio")) return "balon";
  if (n.includes("salud") || n.includes("médic") || n.includes("medic")) return "estetoscopio";
  return "usuarios";
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutos(horaIso) {
  const d = new Date(horaIso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function celdasDelMes(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas = Array((primero + 6) % 7).fill(null);
  for (let d = 1; d <= dias; d++) {
    celdas.push(`${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return celdas;
}

function PasosVertical({ paso }) {
  return (
    <ol aria-label="Pasos" className="list-none m-0 p-0 flex flex-col">
      {PASOS.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < paso;
        const actual = n === paso;
        const ultimo = i === PASOS.length - 1;
        return (
          <li key={nombre} aria-current={actual ? "step" : undefined} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold transition-colors ${
                  hecho
                    ? "bg-[#0B6B61] text-white"
                    : actual
                      ? "bg-[#D5EFEA] border-2 border-[#0B6B61] text-[#0B6B61]"
                      : "bg-gray-50 border-[1.5px] border-gray-300 text-ink-500"
                }`}
              >
                {hecho ? <Icono nombre="check" size={14} strokeWidth={3} /> : n}
              </span>
              {!ultimo && <span aria-hidden="true" className={`w-0.5 flex-1 min-h-[24px] my-1.5 rounded-full ${hecho ? "bg-[#0B6B61]" : "bg-gray-200"}`} />}
            </div>
            <div className={`pt-1 ${ultimo ? "" : "pb-5"}`}>
              <p className={`m-0 text-[15px] font-bold leading-tight ${actual ? "text-ink-900" : hecho ? "text-ink-700" : "text-ink-500"}`}>
                {nombre}
              </p>
              {actual && <span className="block text-xs text-[#0B6B61] font-semibold mt-0.5">En curso</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PasoCompacto({ paso }) {
  return (
    <div className="lg:hidden flex flex-col gap-2 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-[#0B6B61]">{PASOS[paso - 1]}</span>
        <span className="text-ink-500">
          Paso {paso} de {PASOS.length}
        </span>
      </div>
      <div className="flex gap-1.5">
        {PASOS.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= paso ? "bg-[#0B6B61]" : "bg-gray-200"}`} />
        ))}
      </div>
    </div>
  );
}

function ResumenPaso({ numero, titulo, valor, onCambiar, textoCambiar }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200/90 shadow-sm px-5 sm:px-6 py-4 flex justify-between items-center gap-4">
      <div className="flex items-center gap-3.5 min-w-0 tabular-nums">
        <span className="w-8 h-8 rounded-full bg-[#D5EFEA] text-[#0B6B61] flex items-center justify-center shrink-0">
          <Icono nombre="check" size={15} strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">
            Paso {numero} · {titulo}
          </p>
          <p className="m-0 mt-0.5 text-[15px] sm:text-[16px] font-extrabold text-ink-900 truncate capitalize">{valor}</p>
        </div>
      </div>
      <button type="button" onClick={onCambiar} className={BOTON_CAMBIAR}>
        {textoCambiar}
      </button>
    </section>
  );
}

export function AgendarCitaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [servicios, setServicios] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [error, setError] = useState("");
  const [servicioId, setServicioId] = useState(params.get("servicio") || "");
  const [paso, setPaso] = useState(params.get("servicio") ? 2 : 1);
  const [mes, setMes] = useState(null); // { anio, mes }
  const [dia, setDia] = useState("");
  const [horario, setHorario] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function cargarServicios() {
    return http
      .get("/servicios")
      .then((res) => setServicios(res.data.servicios))
      .catch(() => setError("No pudimos cargar los servicios. Revisa tu conexión e intenta de nuevo."));
  }

  function cargarHorarios() {
    return http
      .get("/citas/horarios-disponibles")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo."));
  }

  function cargarTodo() {
    setError("");
    cargarServicios();
    cargarHorarios();
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  useEffect(() => {
    if (!servicios || !servicioId) return;
    if (!servicios.some((s) => s.id === servicioId)) {
      setServicioId("");
      setPaso(1);
    }
  }, [servicios, servicioId]);

  const servicio = servicios?.find((s) => s.id === servicioId);
  const delServicio = useMemo(
    () => (horarios || []).filter((h) => (h.servicio?.id || h.servicioId) === servicioId),
    [horarios, servicioId]
  );

  const porDia = useMemo(() => {
    const mapa = {};
    for (const h of delServicio) (mapa[h.fecha.slice(0, 10)] ||= []).push(h);
    for (const lista of Object.values(mapa)) lista.sort((a, b) => minutos(a.horaInicio) - minutos(b.horaInicio));
    return mapa;
  }, [delServicio]);

  useEffect(() => {
    if (paso !== 2 || mes || !horarios) return;
    const primero = Object.keys(porDia).sort()[0];
    const base = primero || hoyISO();
    setMes({ anio: Number(base.slice(0, 4)), mes: Number(base.slice(5, 7)) - 1 });
    if (primero && !dia) setDia(primero);
  }, [paso, porDia, mes, horarios, dia]);

  function libresDe(id) {
    return (horarios || []).filter((h) => (h.servicio?.id || h.servicioId) === id).length;
  }

  function elegirServicio(id) {
    if (id === servicioId) return;
    setServicioId(id);
    setDia("");
    setHorario(null);
    setMes(null);
  }

  function moverMes(delta) {
    setMes((m) => {
      const total = m.anio * 12 + m.mes + delta;
      return { anio: Math.floor(total / 12), mes: total % 12 };
    });
  }

  async function confirmar() {
    setError("");
    setEnviando(true);
    try {
      await http.post("/citas", { horarioId: horario.id });
      navigate("/estudiante/mis-citas?agendada=1");
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos agendar la cita. Intenta de nuevo.");
      setHorario(null);
      setPaso(2);
      await cargarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  const hoy = hoyISO();
  const anioHoy = Number(hoy.slice(0, 4));
  const mesHoy = Number(hoy.slice(5, 7)) - 1;
  const puedeRetrocederMes = mes ? mes.anio > anioHoy || (mes.anio === anioHoy && mes.mes > mesHoy) : false;
  const cargandoHorarios = horarios === null;

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-14">
      <div className="grid gap-5 lg:gap-8 lg:grid-cols-[290px_minmax(0,1fr)] items-start">
        {/* Columna lateral en escritorio; en móvil se desacopla para poner urgencias al final */}
        <aside className="contents lg:flex lg:flex-col lg:gap-5 lg:sticky lg:top-6">
          <div className="order-1 bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 sm:p-6 flex flex-col gap-5">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-md bg-[#D5EFEA]/70 text-[#0B6B61] text-[11px] font-extrabold uppercase tracking-[0.12em]">
                Orientación · Citas
              </span>
              <h1 className="m-0 mt-2.5 font-sans text-[26px] sm:text-[28px] leading-[1.12] tracking-[-0.02em] font-extrabold text-ink-900">
                Pedir una cita
              </h1>
              <p className="mt-2 mb-0 text-sm text-ink-500 leading-relaxed">
                Con el equipo de Desarrollo Humano. Tu espacio queda reservado al confirmar.
              </p>
            </div>

            <PasoCompacto paso={paso} />
            <div className="hidden lg:block pt-1 border-t border-gray-100">
              <PasosVertical paso={paso} />
            </div>
          </div>

          <div className="order-3 p-5 rounded-2xl bg-[#FFF6E0] border border-[#F3DFA6] text-[#5C4206] flex flex-col items-start gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#F3DFA6] flex items-center justify-center shrink-0">
                <Icono nombre="alerta" size={17} strokeWidth={2.2} />
              </span>
              <strong className="text-sm font-extrabold">Atención inmediata</strong>
            </div>
            <p className="m-0 leading-relaxed text-[13px]">¿Es una urgencia? No esperes la cita: comunícate directo con la línea 123.</p>
            <a
              href="tel:123"
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full border-[1.5px] border-[#5C4206] bg-white/70 text-[#5C4206] font-bold text-xs sm:text-sm no-underline hover:bg-[#5C4206] hover:text-white transition-colors"
            >
              <Icono nombre="telefono" size={15} strokeWidth={2.2} />
              Llamar al 123
            </a>
          </div>
        </aside>

        {/* Contenido principal */}
        <div className="order-2 min-w-0 flex flex-col gap-4 sm:gap-5">
          {error && (
            <div className="flex flex-col gap-3">
              <Aviso>{error}</Aviso>
              {(!servicios || !horarios) && (
                <div>
                  <button type="button" onClick={cargarTodo} className={BOTON_CAMBIAR}>
                    Reintentar carga
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Paso 1: Servicio */}
          {paso === 1 ? (
            <section aria-labelledby="paso1" className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 sm:p-7">
              <div className="pb-5 mb-5 border-b border-gray-100">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B6B61]">Paso 1 de 3</p>
                <h2 id="paso1" className="m-0 mt-1 text-xl sm:text-2xl font-extrabold text-ink-900">
                  ¿Qué servicio necesitas?
                </h2>
                <p className="m-0 mt-1 text-sm sm:text-[15px] text-ink-500">
                  Si no estás seguro, elige orientación psicológica: el profesional te orienta.
                </p>
              </div>

              {!servicios && !error && <Esqueleto etiqueta="Cargando servicios…" />}

              <fieldset className="m-0 p-0 border-0 flex flex-col gap-3">
                <legend className="sr-only">Servicio</legend>
                {servicios?.map((s) => {
                  const libres = libresDe(s.id);
                  const activo = s.id === servicioId;
                  return (
                    <label
                      key={s.id}
                      className={`group flex items-start sm:items-center gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-150 ${
                        activo ? OPCION_ELEGIDA : OPCION_LIBRE
                      }`}
                    >
                      <input type="radio" name="servicio" checked={activo} onChange={() => elegirServicio(s.id)} className="sr-only" />

                      <span
                        className={`w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                          activo ? "bg-[#0B6B61] text-white" : "bg-gray-100 text-ink-600 group-hover:bg-gray-200/70"
                        }`}
                      >
                        <Icono nombre={iconoServicio(s.nombre)} size={22} strokeWidth={2} />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="text-[16px] sm:text-[17px] text-ink-900">{s.nombre}</strong>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              cargandoHorarios
                                ? "bg-gray-100 text-ink-500"
                                : libres
                                  ? "bg-[#D5EFEA]/80 text-[#0B6B61]"
                                  : "bg-gray-100 text-ink-500"
                            }`}
                          >
                            {!cargandoHorarios && (
                              <span className={`w-1.5 h-1.5 rounded-full ${libres ? "bg-[#0B6B61]" : "bg-gray-400"}`} aria-hidden="true" />
                            )}
                            {cargandoHorarios
                              ? "Consultando…"
                              : libres
                                ? `${libres} ${libres === 1 ? "hora libre" : "horas libres"}`
                                : "Sin horas por ahora"}
                          </span>
                        </span>
                        {s.descripcion && <span className="block text-ink-600 text-[13.5px] sm:text-[14px] mt-1 leading-relaxed">{s.descripcion}</span>}
                      </span>

                      <span
                        className={`w-6 h-6 mt-1 sm:mt-0 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${
                          activo ? "border-[#0B6B61] bg-[#0B6B61]" : "border-gray-300 bg-white group-hover:border-gray-400"
                        }`}
                        aria-hidden="true"
                      >
                        {activo && <Icono nombre="check" size={13} strokeWidth={3} className="text-white" />}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {servicios?.length === 0 && (
                <EstadoVacio
                  compacto
                  icono="cuadricula"
                  titulo="Aún no hay servicios para agendar"
                  texto="Bienestar publicará pronto los servicios de orientación. Mientras tanto puedes revisar los talleres o escribirle al asistente."
                  accion={
                    <>
                      <Link to="/estudiante/eventos" className={botonSecundario}>
                        Ver talleres y eventos
                      </Link>
                      <Link to="/estudiante/asistente" className={botonSecundario}>
                        Hablar con el asistente
                      </Link>
                    </>
                  }
                />
              )}

              <div className={`mt-6 pt-5 border-t border-gray-100 justify-end ${servicios?.length === 0 ? "hidden" : "flex"}`}>
                <button type="button" disabled={!servicioId} onClick={() => setPaso(2)} className={`${BOTON_PRIMARIO} w-full sm:w-auto`}>
                  Continuar
                  <Icono nombre="flecha" size={18} strokeWidth={2.2} />
                </button>
              </div>
            </section>
          ) : (
            <ResumenPaso
              numero="1"
              titulo="Servicio"
              valor={servicio?.nombre || "Cargando servicio…"}
              onCambiar={() => setPaso(1)}
              textoCambiar="Cambiar"
            />
          )}

          {/* Paso 2: Día y hora */}
          {paso === 2 && (
            <section aria-labelledby="paso2" className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
              <div className="px-5 sm:px-7 pt-6 pb-5 border-b border-gray-100">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B6B61]">Paso 2 de 3</p>
                <h2 id="paso2" className="m-0 mt-1 text-xl sm:text-2xl font-extrabold text-ink-900">
                  Elige el día y la hora
                </h2>
                <p className="m-0 mt-1 text-sm sm:text-[15px] text-ink-500">Selecciona una fecha disponible en el calendario para ver sus franjas.</p>
              </div>

              {cargandoHorarios || !mes ? (
                <div className="p-5 sm:p-7">
                  <Esqueleto etiqueta="Cargando horarios disponibles…" />
                </div>
              ) : delServicio.length === 0 ? (
                <div className="p-5 sm:p-7 flex flex-col items-start gap-4">
                  <Vacio>
                    Este servicio no tiene horas libres por ahora. Prueba con otro servicio, vuelve en unos días o escribe al asistente.
                  </Vacio>
                  <button type="button" onClick={() => setPaso(1)} className={BOTON_CAMBIAR}>
                    Elegir otro servicio
                  </button>
                </div>
              ) : (
                <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                  {/* Calendario */}
                  <div className="p-5 sm:p-7 border-b lg:border-b-0 lg:border-r border-gray-100">
                    <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
                      <button
                        type="button"
                        aria-label="Mes anterior"
                        disabled={!puedeRetrocederMes}
                        onClick={() => moverMes(-1)}
                        className="w-9 h-9 rounded-full border border-gray-200 bg-white text-ink-700 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-50 hover:border-gray-300 active:translate-y-px disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <Icono nombre="izquierda" size={17} strokeWidth={2.2} />
                      </button>
                      <strong className="text-base sm:text-lg font-extrabold text-ink-900 capitalize tracking-[-0.01em]" aria-live="polite">
                        {MESES[mes.mes]} {mes.anio}
                      </strong>
                      <button
                        type="button"
                        aria-label="Mes siguiente"
                        onClick={() => moverMes(1)}
                        className="w-9 h-9 rounded-full border border-gray-200 bg-white text-ink-700 flex items-center justify-center cursor-pointer transition-all hover:bg-gray-50 hover:border-gray-300 active:translate-y-px"
                      >
                        <Icono nombre="derecha" size={17} strokeWidth={2.2} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 text-center tabular-nums">
                      {DIAS_CORTOS.map((d) => (
                        <span key={d} className="text-[11px] font-bold uppercase tracking-wider text-ink-500 pb-1.5">
                          {d}
                        </span>
                      ))}
                      {celdasDelMes(mes.anio, mes.mes).map((f, i) => {
                        if (!f) return <span key={`v${i}`} />;
                        const n = Number(f.slice(8));
                        const libres = porDia[f]?.length || 0;
                        const elegido = f === dia;
                        const esHoy = f === hoy;

                        if (!libres) {
                          return (
                            <span
                              key={f}
                              className={`h-11 sm:h-12 flex items-center justify-center rounded-xl text-sm text-gray-400 select-none ${
                                esHoy ? "ring-1 ring-gray-300 font-bold text-ink-600" : ""
                              }`}
                            >
                              {n}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={f}
                            type="button"
                            aria-pressed={elegido}
                            aria-label={`${fechaLarga(f)}, ${libres} ${libres === 1 ? "hora libre" : "horas libres"}`}
                            onClick={() => {
                              setDia(f);
                              setHorario(null);
                            }}
                            className={`relative h-11 sm:h-12 rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer ${
                              elegido
                                ? "bg-[#0B6B61] text-white font-extrabold shadow-sm"
                                : "bg-[#D5EFEA]/45 text-[#0B6B61] font-bold hover:bg-[#D5EFEA]"
                            }`}
                          >
                            {n}
                            {!elegido && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[#0B6B61]" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-md bg-[#D5EFEA]/70 border border-[#0B6B61]/30" aria-hidden="true" />
                        Con disponibilidad
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-md bg-[#0B6B61]" aria-hidden="true" />
                        Día elegido
                      </span>
                    </div>
                  </div>

                  {/* Horas del día elegido */}
                  <div className="p-5 sm:p-7 flex flex-col justify-between gap-5 bg-gray-50/40">
                    {!dia || !porDia[dia] ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2.5 py-10 text-ink-500">
                        <span className="w-12 h-12 rounded-2xl bg-white border border-gray-200 text-ink-600 flex items-center justify-center shadow-xs">
                          <Icono nombre="calendario" size={22} strokeWidth={2} />
                        </span>
                        <p className="m-0 text-sm sm:text-[15px] max-w-[240px]">Elige un día resaltado en el calendario para ver sus horas.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3.5">
                        <div>
                          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Franjas disponibles</p>
                          <h3 className="m-0 mt-0.5 text-base sm:text-lg font-extrabold text-ink-900 capitalize">{fechaLarga(dia)}</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 tabular-nums">
                          {porDia[dia].map((h) => {
                            const elegido = horario?.id === h.id;
                            return (
                              <button
                                key={h.id}
                                type="button"
                                aria-pressed={elegido}
                                onClick={() => setHorario(h)}
                                className={`min-h-[48px] px-3 rounded-xl font-bold text-sm sm:text-[15px] inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 active:translate-y-px ${
                                  elegido ? OPCION_ELEGIDA : OPCION_LIBRE
                                }`}
                              >
                                {elegido && <Icono nombre="check" size={14} strokeWidth={3} className="text-[#0B6B61]" />}
                                {formatearHora(h.horaInicio)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {horario && (
                      <div className="rounded-2xl bg-[#D5EFEA]/45 border border-[#0B6B61]/25 p-4 sm:p-5">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B6B61]">Horario seleccionado</span>
                        <p className="m-0 mt-1 font-extrabold text-ink-900 capitalize tabular-nums text-[15px]">
                          {fechaLarga(horario.fecha)} · {formatearHora(horario.horaInicio)}
                        </p>
                        <p className="m-0 mb-4 text-xs sm:text-sm text-ink-600 tabular-nums">Finaliza a las {formatearHora(horario.horaFin)}</p>
                        <button type="button" onClick={() => setPaso(3)} className={BOTON_CONTINUAR}>
                          Continuar
                          <Icono nombre="flecha" size={17} strokeWidth={2.2} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Paso 3: Confirmar */}
          {paso === 3 && horario && (
            <>
              <ResumenPaso
                numero="2"
                titulo="Día y hora"
                valor={`${fechaLarga(horario.fecha)} · ${formatearHora(horario.horaInicio)}`}
                onCambiar={() => setPaso(2)}
                textoCambiar="Cambiar"
              />

              <section aria-labelledby="paso3" className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-5 sm:p-7">
                <div className="pb-5 mb-5 border-b border-gray-100">
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B6B61]">Paso 3 de 3</p>
                  <h2 id="paso3" className="m-0 mt-1 text-xl sm:text-2xl font-extrabold text-ink-900">
                    Revisa y confirma tu cita
                  </h2>
                  <p className="m-0 mt-1 text-sm text-ink-500">Verifica que los datos sean correctos antes de agendar.</p>
                </div>

                <div className="rounded-2xl border border-[#0B6B61]/25 bg-[#D5EFEA]/30 p-5 sm:p-6">
                  <dl className="m-0 divide-y divide-[#0B6B61]/15 text-[15px] tabular-nums">
                    <div className="pb-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                      <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Servicio</dt>
                      <dd className="m-0 font-extrabold text-ink-900">{servicio?.nombre || horario.servicio?.nombre}</dd>
                    </div>
                    <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                      <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Fecha</dt>
                      <dd className="m-0 font-extrabold text-ink-900 capitalize">{fechaLarga(horario.fecha)}</dd>
                    </div>
                    <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                      <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Horario</dt>
                      <dd className="m-0 font-extrabold text-[#0B6B61]">
                        {formatearHora(horario.horaInicio)} – {formatearHora(horario.horaFin)}
                      </dd>
                    </div>
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                      <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Lugar</dt>
                      <dd className="m-0 font-semibold text-ink-900">Oficina de Bienestar Institucional</dd>
                    </div>
                  </dl>
                </div>

                <p className="mt-4 mb-6 text-xs sm:text-sm text-ink-500">
                  Podrás cancelarla desde «Mis citas» hasta 24 horas antes del inicio.
                </p>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    disabled={enviando}
                    className="inline-flex items-center justify-center min-h-[50px] px-6 rounded-full border-[1.5px] border-gray-200 bg-white text-ink-700 font-bold text-[15px] cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={enviando}
                    className={`${BOTON_PRIMARIO} w-full sm:w-auto px-8`}
                  >
                    <Icono nombre="check" size={18} strokeWidth={2.4} />
                    {enviando ? "Agendando…" : "Confirmar cita"}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}