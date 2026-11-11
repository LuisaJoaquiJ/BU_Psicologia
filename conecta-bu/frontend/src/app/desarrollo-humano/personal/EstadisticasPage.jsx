import { AvisoFlotante } from "../../../components/avisos/Avisos";
import { Segmentos, claseCampo } from "../comunes/componentes/ui";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { TableroDH } from "./TableroDH";
import {
  COLORES_ESTADO,
  ETIQUETA_ESTADO,
  Leyenda,
  MapaCalor,
  Probabilidad,
  PuntosConIntervalo,
  formatoPct,
} from "../comunes/componentes/graficas/Graficas";

const ESTADOS_SEMANA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const COLOR_EVENTO = { asistieron: "#1E9E9A", noAsistieron: "#b91c1c", sinRegistrar: "#FFC107" };

const PRESETS = [
  ["30", "Últimos 30 días"],
  ["90", "Últimos 90 días"],
  ["todo", "Todo"],
  ["personalizado", "Personalizado"],
];

function isoHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}
function lunesDe(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function hoyBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function etiquetaSemana(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

const DIA_LARGO = { Lun: "lunes", Mar: "martes", Mié: "miércoles", Jue: "jueves", Vie: "viernes", Sáb: "sábados" };

function hallazgos(datos) {
  const lista = [];
  const p = datos.probabilidades;
  if (p.asistenciaCita.probabilidad !== null) {
    lista.push(`De cada 10 citas con asistencia registrada, cerca de ${Math.round(p.asistenciaCita.probabilidad / 10)} se atienden (${formatoPct(p.asistenciaCita.probabilidad)}).`);
  }
  const dias = p.asistenciaCitaPorDia.filter((d) => d.probabilidad !== null && d.n >= 3);
  if (dias.length >= 2) {
    const peor = dias.reduce((a, b) => (b.probabilidad < a.probabilidad ? b : a));
    const mejor = dias.reduce((a, b) => (b.probabilidad > a.probabilidad ? b : a));
    if (peor.dia !== mejor.dia) {
      lista.push(`La asistencia más baja es los ${DIA_LARGO[peor.dia]} (${formatoPct(peor.probabilidad)}) y la más alta los ${DIA_LARGO[mejor.dia]} (${formatoPct(mejor.probabilidad)}).`);
    }
  }
  const m = datos.mapaDemanda;
  if (m.maximo > 0) {
    let mejor = { v: 0 };
    m.celdas.forEach((fila, i) => fila.forEach((v, j) => v > mejor.v && (mejor = { v, dia: m.dias[i], hora: m.horas[j] })));
    lista.push(`La franja con más demanda es el ${mejor.dia === "Sáb" ? "sábado" : DIA_LARGO[mejor.dia]} a las ${mejor.hora}:00 (${mejor.v} citas).`);
  }
  if (datos.ocupacionHorarios.porcentaje !== null) {
    lista.push(`Se ocupó el ${formatoPct(datos.ocupacionHorarios.porcentaje)} de los horarios publicados (${datos.ocupacionHorarios.libres} quedaron libres).`);
  }
  return lista;
}

function Pila({ partes, etiqueta }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div className="flex h-3.5 rounded-full overflow-hidden bg-gray-100" role="img" aria-label={etiqueta}>
      {total > 0 &&
        partes.filter((p) => p.valor > 0).map((p) => (
          <span key={p.clave} title={`${p.etiqueta}: ${p.valor}`} style={{ width: `${(p.valor / total) * 100}%`, background: p.color }} />
        ))}
    </div>
  );
}

function BarrasSemana({ semanas }) {
  const lunes = lunesDe(hoyBogota());
  const max = Math.max(1, ...semanas.map((s) => s.total));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 min-h-[190px] pt-2" role="img" aria-label="Citas por semana">
        {semanas.map((s) => {
          const tipo = s.semana < lunes ? "pasada" : s.semana === lunes ? "actual" : "futura";
          const fondo = tipo === "pasada" ? "#1E3A5F" : tipo === "actual" ? "#E8740E" : "repeating-linear-gradient(45deg,#C9D6E6 0 6px,#DCE5F0 6px 12px)";
          return (
            <div key={s.semana} className="flex flex-col items-center gap-1.5 min-w-[52px] flex-1">
              <span className="text-sm font-bold tabular-nums text-ink-900">{s.total}</span>
              <span className="w-full max-w-[42px] rounded-t-md" style={{ height: `${Math.max(s.total ? 8 : 2, (s.total / max) * 150)}px`, background: fondo }} title={`${etiquetaSemana(s.semana)}: ${s.total} citas`} />
              <span className="text-[11px] text-ink-500 whitespace-nowrap">{etiquetaSemana(s.semana)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, detalle }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
      <p className="m-0 text-[13px] text-ink-500">{titulo}</p>
      <p className="mt-1 mb-0 text-[32px] leading-none font-extrabold tabular-nums text-ink-900">{valor}</p>
      {detalle && <p className="mt-2 mb-0 text-xs text-ink-500">{detalle}</p>}
    </div>
  );
}

function Tarjeta({ titulo, subtitulo, accion, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <h2 className="m-0 text-lg font-extrabold">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 mb-0 text-[13px] text-ink-500">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

const NOMBRE_AUTOMATIZACION = {
  "cita.agendada": "Correo: cita agendada",
  "cita.cancelada": "Correo: cita cancelada",
  "evento.inscripcion": "Correo: inscripción a evento",
  "evento.inscripcion_cancelada": "Correo: inscripción cancelada",
  "evento.publicado": "Evento publicado",
  "asistente.consulta": "Asistente IA (Gemini)",
};

export function EstadisticasPage() {
  const [pestana, setPestana] = useState("rapida");
  const [preset, setPreset] = useState("30");
  const [rango, setRango] = useState({ desde: "", hasta: "" });
  const [datos, setDatos] = useState(null);
  const [automatizaciones, setAutomatizaciones] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState("");

  function cargar(filtro) {
    setError("");
    setCargando(true);
    const params = Object.fromEntries(Object.entries(filtro).filter(([, v]) => v));
    return Promise.all([http.get("/admin/estadisticas", { params }), http.get("/admin/estadisticas/automatizaciones")])
      .then(([resEst, resAuto]) => {
        setDatos(resEst.data);
        setAutomatizaciones(resAuto.data.ejecuciones);
      })
      .catch((err) => setError(err.response?.data?.message || "No fue posible cargar las estadísticas."))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    cargar({ desde: isoHace(30), hasta: isoHace(0) });
  }, []);

  function elegirPreset(id) {
    setPreset(id);
    if (id === "todo") cargar({});
    if (id === "30") cargar({ desde: isoHace(30), hasta: isoHace(0) });
    if (id === "90") cargar({ desde: isoHace(90), hasta: isoHace(0) });
  }

  async function descargar(formato) {
    setError("");
    setDescargando(formato);
    try {
      const filtro = Object.fromEntries(Object.entries(datos?.filtro || {}).filter(([, v]) => v));
      const res = await http.get("/admin/estadisticas/informe", { params: { formato, ...filtro }, responseType: "blob" });
      const sufijo = filtro.desde || filtro.hasta ? `${filtro.desde || "inicio"}_a_${filtro.hasta || "hoy"}` : isoHace(0);
      const url = URL.createObjectURL(res.data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `informe-bienestar-${sufijo}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("No fue posible generar el informe. Intenta de nuevo.");
    } finally {
      setDescargando("");
    }
  }

  const lectura = useMemo(() => (datos ? hallazgos(datos) : []), [datos]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
        <div>
          <p className="m-0 mb-1 text-[11px] font-bold tracking-[0.14em] uppercase text-accent">Panel del personal · Desarrollo Humano</p>
          <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Estadísticas</h1>
          <p className="mt-1 mb-0 text-ink-500">Cómo va Desarrollo Humano: citas, asistencia y eventos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select aria-label="Periodo" value={preset} onChange={(e) => elegirPreset(e.target.value)} className={`${claseCampo} !w-auto`}>
            {PRESETS.map(([id, texto]) => (
              <option key={id} value={id}>{texto}</option>
            ))}
          </select>
          <button type="button" onClick={() => descargar("xlsx")} disabled={!datos || Boolean(descargando)} className="inline-flex items-center gap-2 boton-liquido font-semibold text-sm px-4 min-h-[44px] rounded-full disabled:opacity-60">
            <Icono nombre="descarga" size={16} strokeWidth={2.2} />
            {descargando === "xlsx" ? "Generando…" : "Descargar informe del periodo"}
          </button>
          <button type="button" onClick={() => descargar("pdf")} disabled={!datos || Boolean(descargando)} className="inline-flex items-center gap-2 burbuja text-primary-dark font-semibold text-sm px-4 min-h-[44px] rounded-full disabled:opacity-60">
            {descargando === "pdf" ? "Generando…" : "PDF"}
          </button>
        </div>
      </div>

      <div className="mb-5">
        <Segmentos etiqueta="Vista" valor={pestana} alCambiar={setPestana} opciones={[["rapida", "Lectura rápida"], ["detalle", "Análisis detallado"]]} />
      </div>

      {preset === "personalizado" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cargar(rango);
          }}
          className="flex items-end gap-2 flex-wrap mb-5"
        >
          <label className="flex flex-col gap-1 text-xs font-bold text-ink-600">
            Desde
            <input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} className={claseCampo} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-ink-600">
            Hasta
            <input type="date" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} className={claseCampo} />
          </label>
          <button type="submit" className="text-sm font-bold bg-gold text-primary-dark rounded-full px-4 min-h-[44px]">Aplicar</button>
        </form>
      )}

      {error && <AvisoFlotante tono="error">{error}</AvisoFlotante>}
      {!datos && !error && <p className="text-ink-500">Cargando estadísticas…</p>}

      {datos && (
        <div className={`flex flex-col gap-5 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          {!datos.hayDatos && <p className="m-0 text-sm text-ink-600 bg-white border border-gray-200 rounded-xl p-3">No hay información de citas ni eventos para este periodo.</p>}

          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <Kpi titulo="Estudiantes activos" valor={datos.participacion.estudiantesActivos} detalle={`${datos.participacion.recurrentes} repiten cita · ${formatoPct(datos.participacion.alcance)} de ${datos.estudiantesRegistrados} registrados`} />
            <Kpi titulo="Citas" valor={datos.citas.total} detalle={`${datos.citas.atendidas} atendidas · ${datos.citas.noAsistieron} no asistieron`} />
            <Kpi
              titulo="Probabilidad de asistir a una cita"
              valor={formatoPct(datos.probabilidades.asistenciaCita.probabilidad)}
              detalle={datos.probabilidades.asistenciaCita.n ? `Intervalo ${formatoPct(datos.probabilidades.asistenciaCita.bajo)} – ${formatoPct(datos.probabilidades.asistenciaCita.alto)}` : "Sin asistencias registradas"}
            />
            <Kpi titulo="Ocupación de horarios" valor={formatoPct(datos.ocupacionHorarios.porcentaje)} detalle={`${datos.ocupacionHorarios.ocupados} de ${datos.ocupacionHorarios.total} horarios publicados`} />
          </div>

          {pestana === "rapida" ? (
            <>
              {lectura.length > 0 && (
                <details className="bg-[#FFF8E1] border border-[#F3E2B5] rounded-xl px-5 py-3">
                  <summary className="cursor-pointer font-bold text-[#5C4206]">Lectura de estos números</summary>
                  <ul className="mt-2 mb-1 pl-5 text-sm text-[#4A3605] flex flex-col gap-1">
                    {lectura.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </details>
              )}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Tarjeta titulo="Citas por semana" subtitulo="Según la fecha de la cita. La semana actual va resaltada; las de adelante son citas ya agendadas.">
                  <BarrasSemana semanas={datos.tendenciaSemanal} />
                  <div className="mt-3">
                    <Leyenda series={[
                      { clave: "p", etiqueta: "Semanas pasadas", color: "#1E3A5F" },
                      { clave: "a", etiqueta: "Semana actual", color: "#E8740E" },
                      { clave: "f", etiqueta: "Ya agendadas", color: "#C9D6E6" },
                    ]} />
                  </div>
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-bold text-primary">Ver datos en tabla</summary>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-xs tabular-nums">
                        <thead>
                          <tr className="text-left text-ink-500">
                            <th className="py-1.5 pr-3 font-medium">Semana del</th>
                            {ESTADOS_SEMANA.map((e) => <th key={e} className="py-1.5 pr-3 font-medium">{ETIQUETA_ESTADO[e]}</th>)}
                            <th className="py-1.5 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {datos.tendenciaSemanal.map((s) => (
                            <tr key={s.semana} className="border-t border-gray-100">
                              <td className="py-1.5 pr-3">{etiquetaSemana(s.semana)}</td>
                              {ESTADOS_SEMANA.map((e) => <td key={e} className="py-1.5 pr-3">{s[e]}</td>)}
                              <td className="py-1.5 font-semibold">{s.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </Tarjeta>
                <Tarjeta titulo="Citas por servicio" subtitulo="Cómo terminan las citas de cada servicio.">
                  {datos.citasPorServicio.length === 0 && <p className="m-0 text-sm text-ink-500">No hay citas en este periodo.</p>}
                  <div className="flex flex-col gap-4">
                    {datos.citasPorServicio.map((s) => (
                      <div key={s.servicio}>
                        <div className="flex justify-between gap-3 text-sm mb-1.5">
                          <b className="truncate">{s.servicio}</b>
                          <span className="text-ink-500 shrink-0">{s.total} citas</span>
                        </div>
                        <Pila
                          etiqueta={s.servicio}
                          partes={[
                            { clave: "Atendida", etiqueta: "Atendidas", valor: s.atendidas, color: COLORES_ESTADO.Atendida },
                            { clave: "NoAsistio", etiqueta: "No asistieron", valor: s.noAsistieron, color: "#b91c1c" },
                            { clave: "Agendada", etiqueta: "Agendadas", valor: s.agendadas, color: COLORES_ESTADO.Agendada },
                            { clave: "Cancelada", etiqueta: "Canceladas", valor: s.canceladas, color: "#9AA6B6" },
                          ]}
                        />
                        <p className="mt-1.5 mb-0 text-xs text-ink-500">
                          {s.tasaAsistencia === null ? "Sin asistencia registrada" : `${formatoPct(s.tasaAsistencia)} atendidas`} · {s.noAsistieron} no asistieron · {s.canceladas} canceladas
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Leyenda series={[
                      { clave: "a", etiqueta: "Atendidas", color: COLORES_ESTADO.Atendida },
                      { clave: "n", etiqueta: "No asistieron", color: "#b91c1c" },
                      { clave: "g", etiqueta: "Agendadas", color: COLORES_ESTADO.Agendada },
                      { clave: "c", etiqueta: "Canceladas", color: "#9AA6B6" },
                    ]} />
                  </div>
                </Tarjeta>
              </div>
              <Tarjeta
                titulo="Asistencia por evento"
                subtitulo="Inscritos confirmados de eventos publicados o cerrados."
                accion={<Link to="/admin/eventos" className="text-sm font-bold text-primary whitespace-nowrap">Ver eventos</Link>}
              >
                {datos.eventosDetalle.length === 0 && <p className="m-0 text-sm text-ink-500">No hay eventos en este periodo.</p>}
                <div className="flex flex-col gap-4">
                  {datos.eventosDetalle.map((e) => (
                    <div key={e.id}>
                      <div className="flex justify-between gap-3 text-sm mb-1.5">
                        <b className="truncate">{e.nombre}</b>
                        <span className="text-ink-500 shrink-0">{e.inscritos} inscritos · {e.inscritos ? Math.round((e.asistieron / e.inscritos) * 100) : 0} % asistió</span>
                      </div>
                      <Pila
                        etiqueta={e.nombre}
                        partes={[
                          { clave: "a", etiqueta: "Asistieron", valor: e.asistieron, color: COLOR_EVENTO.asistieron },
                          { clave: "n", etiqueta: "No asistieron", valor: e.noAsistieron, color: COLOR_EVENTO.noAsistieron },
                          { clave: "s", etiqueta: "Sin registrar", valor: e.sinRegistrar, color: COLOR_EVENTO.sinRegistrar },
                        ]}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Leyenda series={[
                    { clave: "a", etiqueta: "Asistieron", color: COLOR_EVENTO.asistieron },
                    { clave: "n", etiqueta: "No asistieron", color: COLOR_EVENTO.noAsistieron },
                    { clave: "s", etiqueta: "Sin registrar", color: COLOR_EVENTO.sinRegistrar },
                  ]} />
                </div>
              </Tarjeta>
              <details className="bg-white border border-gray-200 rounded-xl px-5 py-3">
                <summary className="cursor-pointer font-bold text-ink-900">Comparar con el periodo anterior</summary>
                <div className="pt-4"><TableroDH /></div>
              </details>
            </>
          ) : (
            <>
              <Tarjeta titulo="Probabilidades" subtitulo="Estimadas con el histórico registrado. La franja muestra el intervalo de confianza: más datos, franja más angosta.">
                <div className="flex flex-col gap-6">
                  <Probabilidad titulo="Asistir a una cita agendada" dato={datos.probabilidades.asistenciaCita} colorPunto="#1E9E9A" />
                  <Probabilidad titulo="Asistir a un evento inscrito" dato={datos.probabilidades.asistenciaEvento} colorPunto="#1E3A5F" />
                  <Probabilidad titulo="Que una cita se cancele" dato={datos.probabilidades.cancelacionCita} colorPunto="#E8740E" />
                </div>
              </Tarjeta>
              <div className="grid gap-5 lg:grid-cols-2">
                <Tarjeta titulo="¿Cuándo se piden más citas?" subtitulo="Citas por día y hora de inicio (sin canceladas). Más oscuro = más demanda.">
                  <MapaCalor mapa={datos.mapaDemanda} />
                </Tarjeta>
                <Tarjeta titulo="Asistencia según el día" subtitulo="Probabilidad de asistir por día de la semana, con intervalo de confianza al 95 %.">
                  <PuntosConIntervalo filas={datos.probabilidades.asistenciaCitaPorDia} />
                </Tarjeta>
              </div>
              <Tarjeta titulo="Automatizaciones (n8n)" subtitulo="Últimos envíos a n8n desde que se inició el servidor. Un fallo no afecta la cita o inscripción.">
                {automatizaciones.length === 0 ? (
                  <p className="m-0 text-sm text-ink-500">Todavía no se han ejecutado automatizaciones.</p>
                ) : (
                  <ul className="list-none m-0 p-0 divide-y divide-gray-100 text-sm">
                    {automatizaciones.slice(0, 8).map((a, i) => (
                      <li key={`${a.fecha}-${i}`} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink-900">{NOMBRE_AUTOMATIZACION[a.tipo] || a.tipo}</span>
                          {a.estado !== "exitosa" && a.detalle && <span className="block text-xs text-ink-500">{a.detalle}</span>}
                        </span>
                        <span className="text-xs text-ink-500">{new Date(a.fecha).toLocaleString("es-CO")}</span>
                        <span className={`text-xs font-semibold rounded-full px-3 py-0.5 ${a.estado === "exitosa" ? "bg-[#E7F4EE] text-[#1D6B4A]" : a.estado === "fallida" ? "bg-red-50 text-red-700" : "bg-gray-100 text-ink-600"}`}>
                          {a.estado === "exitosa" ? "Exitosa" : a.estado === "fallida" ? "Fallida" : "Omitida"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </>
          )}
        </div>
      )}
    </main>
  );
}
