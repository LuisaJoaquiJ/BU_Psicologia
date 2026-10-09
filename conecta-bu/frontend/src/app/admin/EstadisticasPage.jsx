import { useEffect, useMemo, useState } from "react";
import { http } from "../../lib/api/http";
import { formatearFecha, fechaLarga } from "../../lib/format";
import { Icono } from "../../components/Iconos";
import {
  COLORES_ESTADO,
  ETIQUETA_ESTADO,
  BarraApilada,
  ColumnasSemanales,
  Leyenda,
  MapaCalor,
  Probabilidad,
  PuntosConIntervalo,
  Sparkline,
  formatoPct,
} from "../../components/graficas/Graficas";

const campo = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900 bg-white";
const ESTADOS_SEMANA = ["Atendida", "NoAsistio", "Agendada", "Cancelada"];
const COLOR_EVENTO = { asistieron: "#0d9488", noAsistieron: "#d97706", sinRegistrar: "#CBD2DE" };

const PRESETS = [
  { id: "todo", texto: "Todo" },
  { id: "30", texto: "Últimos 30 días" },
  { id: "90", texto: "Últimos 90 días" },
  { id: "personalizado", texto: "Personalizado" },
];

function isoHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function Tarjeta({ titulo, subtitulo, children, className = "" }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-[22px] p-6 min-w-0 ${className}`}>
      <h2 className="m-0 font-sans text-[17px] font-bold">{titulo}</h2>
      {subtitulo && <p className="mt-1 mb-4 text-xs text-ink-500">{subtitulo}</p>}
      {!subtitulo && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Indicador({ titulo, valor, detalle, extra, destacado }) {
  return (
    <div className={`rounded-[20px] p-5 flex flex-col gap-1 min-w-0 ${destacado ? "bg-primary text-white" : "bg-white border border-gray-200"}`}>
      <span className={`text-[13px] ${destacado ? "text-white/75" : "text-ink-500"}`}>{titulo}</span>
      <div className="flex items-end justify-between gap-3">
        <span className={`font-display text-[34px] leading-tight font-semibold tabular-nums ${destacado ? "text-gold" : "text-primary"}`}>{valor}</span>
        {extra}
      </div>
      {detalle && <span className={`text-xs ${destacado ? "text-white/75" : "text-ink-500"}`}>{detalle}</span>}
    </div>
  );
}

const DIA_LARGO = { Lun: "lunes", Mar: "martes", "Mié": "miércoles", Jue: "jueves", Vie: "viernes", "Sáb": "sábados" };

// Frases de lectura rapida calculadas con los mismos datos de las graficas.
function hallazgos(datos) {
  const lista = [];
  const p = datos.probabilidades;
  if (p.asistenciaCita.probabilidad !== null) {
    lista.push(
      `De cada 10 citas con asistencia registrada, cerca de ${Math.round(p.asistenciaCita.probabilidad / 10)} se atienden (${formatoPct(p.asistenciaCita.probabilidad)}).`
    );
  }
  const dias = p.asistenciaCitaPorDia.filter((d) => d.probabilidad !== null && d.n >= 3);
  if (dias.length >= 2) {
    const peor = dias.reduce((a, b) => (b.probabilidad < a.probabilidad ? b : a));
    const mejor = dias.reduce((a, b) => (b.probabilidad > a.probabilidad ? b : a));
    if (peor.dia !== mejor.dia) {
      lista.push(
        `La asistencia más baja es los ${DIA_LARGO[peor.dia]} (${formatoPct(peor.probabilidad)}) y la más alta los ${DIA_LARGO[mejor.dia]} (${formatoPct(mejor.probabilidad)}): conviene reforzar los recordatorios de los ${DIA_LARGO[peor.dia]}.`
      );
    }
  }
  const m = datos.mapaDemanda;
  if (m.maximo > 0) {
    let mejor = { v: 0 };
    m.celdas.forEach((fila, i) => fila.forEach((v, j) => v > mejor.v && (mejor = { v, dia: m.dias[i], hora: m.horas[j] })));
    lista.push(`La franja con más demanda es el ${mejor.dia === "Sáb" ? "sábado" : DIA_LARGO[mejor.dia]} a las ${mejor.hora}:00 (${mejor.v} citas): es buen momento para abrir más horarios.`);
  }
  if (datos.ocupacionHorarios.porcentaje !== null) {
    lista.push(
      `Se ocupó el ${formatoPct(datos.ocupacionHorarios.porcentaje)} de los horarios publicados (${datos.ocupacionHorarios.libres} quedaron libres).`
    );
  }
  if (p.cancelacionCita.probabilidad !== null && p.cancelacionCita.probabilidad >= 20) {
    lista.push(`Una de cada ${Math.max(2, Math.round(100 / p.cancelacionCita.probabilidad))} citas se cancela: revisa si los horarios ofrecidos encajan con los estudiantes.`);
  }
  return lista;
}

// RF-015 (ampliado): dashboard de participacion y asistencia con tendencia,
// demanda por franja, probabilidades con intervalo de confianza y lectura rapida.
export function EstadisticasPage() {
  const [preset, setPreset] = useState("todo");
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
    cargar({});
  }, []);

  function elegirPreset(id) {
    setPreset(id);
    if (id === "todo") cargar({});
    if (id === "30") cargar({ desde: isoHace(30), hasta: isoHace(0) });
    if (id === "90") cargar({ desde: isoHace(90), hasta: isoHace(0) });
  }

  // RF-015: informe descargable (Excel o PDF) con el mismo periodo del panel.
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
  const maximoEvento = Math.max(0, ...(datos?.eventosDetalle || []).map((e) => e.inscritos));
  const maximoServicio = Math.max(0, ...(datos?.citasPorServicio || []).map((s) => s.total));

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-3xl font-extrabold">Estadísticas</h1>
          <p className="mt-1.5 mb-0 text-ink-500">Participación, asistencia y demanda de Bienestar Universitario.</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <span className="text-xs text-ink-500">Descargar informe del periodo</span>
          <div className="flex gap-2">
            {[
              ["xlsx", "Excel", "bg-primary text-white"],
              ["pdf", "PDF", "bg-gold text-primary"],
            ].map(([formato, texto, estilo]) => (
              <button
                key={formato}
                type="button"
                onClick={() => descargar(formato)}
                disabled={!datos || Boolean(descargando)}
                className={`inline-flex items-center gap-2 text-sm font-bold rounded-full px-4 min-h-[42px] disabled:opacity-60 ${estilo}`}
              >
                <Icono nombre="descarga" size={18} strokeWidth={2.2} />
                {descargando === formato ? "Generando..." : texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros: una sola fila arriba; afectan a todo el panel */}
      <div className="flex items-end gap-3 flex-wrap mb-7" role="group" aria-label="Periodo">
        <div className="flex gap-1.5 flex-wrap bg-white border border-gray-200 rounded-full p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPreset(p.id)}
              aria-pressed={preset === p.id}
              className={`text-sm font-semibold rounded-full px-4 min-h-[38px] transition-colors ${
                preset === p.id ? "bg-primary text-white" : "text-ink-600 hover:bg-gray-50"
              }`}
            >
              {p.texto}
            </button>
          ))}
        </div>
        {preset === "personalizado" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cargar(rango);
            }}
            className="flex items-end gap-2 flex-wrap"
          >
            <label className="flex flex-col gap-1 text-xs text-ink-500">
              Desde
              <input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-500">
              Hasta
              <input type="date" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} className={campo} />
            </label>
            <button type="submit" className="text-sm font-bold bg-gold text-primary rounded-full px-4 min-h-[40px]">
              Aplicar
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3 mb-6">{error}</p>}
      {!datos && !error && <p className="text-ink-500">Cargando estadísticas...</p>}

      {datos && (
        <div className={`flex flex-col gap-5 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          {!datos.hayDatos && (
            <p className="m-0 text-sm text-ink-600 bg-white border border-gray-200 rounded-xl p-3">
              No hay información de citas ni eventos para este periodo.
            </p>
          )}

          {/* Indicadores */}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
            <Indicador
              destacado
              titulo="Estudiantes activos"
              valor={datos.participacion.estudiantesActivos}
              detalle={`${formatoPct(datos.participacion.alcance)} de ${datos.estudiantesRegistrados} registrados · ${datos.participacion.recurrentes} recurrentes`}
            />
            <Indicador
              titulo="Citas"
              valor={datos.citas.total}
              detalle={`${datos.citas.atendidas} atendidas · ${datos.citas.canceladas} canceladas`}
              extra={<Sparkline valores={datos.tendenciaSemanal.map((s) => s.total)} color="#163F86" />}
            />
            <Indicador
              titulo="Probabilidad de asistir a una cita"
              valor={formatoPct(datos.probabilidades.asistenciaCita.probabilidad)}
              detalle={
                datos.probabilidades.asistenciaCita.n
                  ? `IC 95 %: ${formatoPct(datos.probabilidades.asistenciaCita.bajo)} – ${formatoPct(datos.probabilidades.asistenciaCita.alto)}`
                  : "Sin asistencias registradas"
              }
            />
            <Indicador
              titulo="Ocupación de horarios"
              valor={formatoPct(datos.ocupacionHorarios.porcentaje)}
              detalle={`${datos.ocupacionHorarios.ocupados} de ${datos.ocupacionHorarios.total} horarios tomados`}
            />
          </div>

          {/* Lectura rápida */}
          {lectura.length > 0 && (
            <section className="bg-gold-light border border-gold/30 rounded-[22px] p-6">
              <h2 className="m-0 mb-3 font-sans text-[17px] font-bold">Lectura rápida</h2>
              <ul className="m-0 pl-5 flex flex-col gap-1.5 text-[15px] leading-relaxed text-[#4A3605]">
                {lectura.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Tendencia + probabilidades */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Tarjeta titulo="Citas por semana" subtitulo="Según la fecha de la cita. La semana actual va resaltada; las de adelante son citas ya agendadas.">
              <div className="mb-4">
                <Leyenda series={ESTADOS_SEMANA.map((e) => ({ clave: e, etiqueta: ETIQUETA_ESTADO[e], color: COLORES_ESTADO[e] }))} />
              </div>
              <ColumnasSemanales semanas={datos.tendenciaSemanal} estados={ESTADOS_SEMANA} />
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-primary-soft font-semibold">Ver datos en tabla</summary>
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-left text-ink-500">
                        <th className="py-1.5 pr-3 font-medium">Semana del</th>
                        {ESTADOS_SEMANA.map((e) => (
                          <th key={e} className="py-1.5 pr-3 font-medium">{ETIQUETA_ESTADO[e]}</th>
                        ))}
                        <th className="py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.tendenciaSemanal.map((s) => (
                        <tr key={s.semana} className="border-t border-gray-100">
                          <td className="py-1.5 pr-3">{s.semana}</td>
                          {ESTADOS_SEMANA.map((e) => (
                            <td key={e} className="py-1.5 pr-3">{s[e]}</td>
                          ))}
                          <td className="py-1.5 font-semibold">{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Tarjeta>

            <Tarjeta titulo="Probabilidades" subtitulo="Estimadas con el histórico registrado. La franja muestra el intervalo de confianza: más datos, franja más angosta.">
              <div className="flex flex-col gap-6">
                <Probabilidad titulo="Asistir a una cita agendada" dato={datos.probabilidades.asistenciaCita} colorPunto="#0d9488" />
                <Probabilidad titulo="Asistir a un evento inscrito" dato={datos.probabilidades.asistenciaEvento} colorPunto="#163F86" />
                <Probabilidad titulo="Que una cita se cancele" dato={datos.probabilidades.cancelacionCita} colorPunto="#d97706" />
              </div>
            </Tarjeta>
          </div>

          {/* Demanda + asistencia por día */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Tarjeta titulo="¿Cuándo se piden más citas?" subtitulo="Citas por día y hora de inicio (sin canceladas). Más oscuro = más demanda.">
              <MapaCalor mapa={datos.mapaDemanda} />
            </Tarjeta>
            <Tarjeta titulo="Asistencia según el día" subtitulo="Probabilidad de asistir por día de la semana, con intervalo de confianza al 95 %.">
              <PuntosConIntervalo filas={datos.probabilidades.asistenciaCitaPorDia} />
            </Tarjeta>
          </div>

          {/* Eventos + servicios */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Tarjeta titulo="Asistencia por evento" subtitulo="Inscritos confirmados de eventos publicados o cerrados.">
              <div className="mb-4">
                <Leyenda
                  series={[
                    { clave: "a", etiqueta: "Asistieron", color: COLOR_EVENTO.asistieron },
                    { clave: "n", etiqueta: "No asistieron", color: COLOR_EVENTO.noAsistieron },
                    { clave: "s", etiqueta: "Sin registrar", color: COLOR_EVENTO.sinRegistrar },
                  ]}
                />
              </div>
              {datos.eventosDetalle.length === 0 && <p className="m-0 text-sm text-ink-500">No hay eventos en este periodo.</p>}
              <div className="flex flex-col gap-4">
                {datos.eventosDetalle.map((e) => (
                  <div key={e.id}>
                    <div className="flex justify-between gap-3 text-sm mb-1.5">
                      <strong className="truncate">{e.nombre}</strong>
                      <span className="text-ink-500 shrink-0">{fechaLarga(e.fecha).split(",")[0]} · {e.inscritos}/{e.cupos}</span>
                    </div>
                    <BarraApilada
                      etiqueta={e.nombre}
                      maximo={maximoEvento}
                      partes={[
                        { clave: "a", etiqueta: "Asistieron", valor: e.asistieron, color: COLOR_EVENTO.asistieron },
                        { clave: "n", etiqueta: "No asistieron", valor: e.noAsistieron, color: COLOR_EVENTO.noAsistieron },
                        { clave: "s", etiqueta: "Sin registrar", valor: e.sinRegistrar, color: COLOR_EVENTO.sinRegistrar },
                      ]}
                    />
                    <p className="mt-1.5 mb-0 text-xs text-ink-500 tabular-nums">
                      {e.asistieron} asistieron · {e.noAsistieron} no asistieron · {e.sinRegistrar} sin registrar · ocupación {formatoPct(e.ocupacion)}
                    </p>
                  </div>
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Citas por servicio" subtitulo="Cómo terminan las citas de cada servicio.">
              <div className="mb-4">
                <Leyenda series={ESTADOS_SEMANA.map((e) => ({ clave: e, etiqueta: ETIQUETA_ESTADO[e], color: COLORES_ESTADO[e] }))} />
              </div>
              {datos.citasPorServicio.length === 0 && <p className="m-0 text-sm text-ink-500">No hay citas en este periodo.</p>}
              <div className="flex flex-col gap-4">
                {datos.citasPorServicio.map((s) => (
                  <div key={s.servicio}>
                    <div className="flex justify-between gap-3 text-sm mb-1.5">
                      <strong className="truncate">{s.servicio}</strong>
                      <span className="text-ink-500 shrink-0">{s.total} citas · asistencia {formatoPct(s.tasaAsistencia)}</span>
                    </div>
                    <BarraApilada
                      etiqueta={s.servicio}
                      maximo={maximoServicio}
                      partes={[
                        { clave: "Atendida", etiqueta: "Atendidas", valor: s.atendidas, color: COLORES_ESTADO.Atendida },
                        { clave: "NoAsistio", etiqueta: "No asistieron", valor: s.noAsistieron, color: COLORES_ESTADO.NoAsistio },
                        { clave: "Agendada", etiqueta: "Agendadas", valor: s.agendadas, color: COLORES_ESTADO.Agendada },
                        { clave: "Cancelada", etiqueta: "Canceladas", valor: s.canceladas, color: COLORES_ESTADO.Cancelada },
                      ]}
                    />
                    <p className="mt-1.5 mb-0 text-xs text-ink-500 tabular-nums">
                      {s.atendidas} atendidas · {s.noAsistieron} no asistieron · {s.agendadas} agendadas · {s.canceladas} canceladas
                    </p>
                  </div>
                ))}
              </div>
            </Tarjeta>
          </div>

          {/* n8n */}
          <Tarjeta titulo="Automatizaciones (n8n)" subtitulo="Últimos envíos a n8n desde que se inició el servidor. Un fallo no afecta la cita o inscripción.">
            {automatizaciones.length === 0 ? (
              <p className="m-0 text-sm text-ink-500">Todavía no se han ejecutado automatizaciones.</p>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-gray-100 text-sm">
                {automatizaciones.slice(0, 8).map((a, i) => (
                  <li key={`${a.fecha}-${i}`} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-mono text-xs text-ink-900">{a.tipo}</span>
                    <span className="text-xs text-ink-500">{new Date(a.fecha).toLocaleString("es-CO")}</span>
                    <span
                      title={a.detalle || ""}
                      className={`text-xs font-semibold rounded-full px-3 py-0.5 ${
                        a.estado === "exitosa" ? "bg-[#E7F4EE] text-[#1D6B4A]" : a.estado === "fallida" ? "bg-red-50 text-red-700" : "bg-gray-100 text-ink-600"
                      }`}
                    >
                      {a.estado === "exitosa" ? "Exitosa" : a.estado === "fallida" ? "Fallida" : "Omitida"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      )}
    </main>
  );
}
