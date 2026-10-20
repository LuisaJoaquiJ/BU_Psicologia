import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { Aviso, Vacio } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";

// RF-004 / RF-005 · HU-07 a HU-10: pedir una cita en tres pasos
// (servicio → día y hora → confirmar). Solo se crea la cita al confirmar.
// ?servicio=<id> (desde la página de Servicios) salta directo al paso 2.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_CORTOS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutos(horaIso) {
  const d = new Date(horaIso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Celdas del mes (lunes primero): null para los huecos antes del día 1.
function celdasDelMes(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas = Array((primero + 6) % 7).fill(null);
  for (let d = 1; d <= dias; d++) celdas.push(`${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return celdas;
}

const PASOS = ["Servicio", "Día y hora", "Confirmar"];

function Pasos({ paso }) {
  return (
    <ol aria-label="Pasos" className="list-none m-0 p-0 flex lg:flex-col gap-1 overflow-x-auto">
      {PASOS.map((nombre, i) => {
        const n = i + 1;
        const hecho = n < paso;
        const actual = n === paso;
        return (
          <li
            key={nombre}
            aria-current={actual ? "step" : undefined}
            className={`flex-1 lg:flex-none flex gap-3 items-center p-3 rounded-xl min-w-[150px] ${actual ? "bg-white shadow-[0_4px_14px_rgba(11,35,71,0.08)]" : ""}`}
          >
            <span
              className={`w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center font-extrabold text-sm ${
                hecho ? "bg-[#1D7A55] text-white" : actual ? "boton-liquido" : "border-[1.5px] border-[#B8C2D3] text-ink-500"
              }`}
            >
              {hecho ? <Icono nombre="check" size={15} strokeWidth={3} /> : n}
            </span>
            <span className="leading-tight">
              <strong className={actual || hecho ? "text-ink-900" : "text-ink-500"}>{nombre}</strong>
              <br />
              <span className="text-[13px] text-ink-500">{hecho ? "Hecho" : actual ? "Ahora" : "Después"}</span>
            </span>
          </li>
        );
      })}
    </ol>
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

  function cargarHorarios() {
    return http
      .get("/citas/horarios-disponibles")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo."));
  }

  useEffect(() => {
    http
      .get("/servicios")
      .then((res) => setServicios(res.data.servicios))
      .catch(() => setError("No pudimos cargar los servicios. Revisa tu conexión e intenta de nuevo."));
    cargarHorarios();
  }, []);

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

  // Al entrar al paso 2, abrir el mes del primer día con horarios.
  useEffect(() => {
    if (paso !== 2 || mes || !horarios) return;
    const primero = Object.keys(porDia).sort()[0] || hoyISO();
    setMes({ anio: Number(primero.slice(0, 4)), mes: Number(primero.slice(5, 7)) - 1 });
  }, [paso, porDia, mes, horarios]);

  function libresDe(id) {
    return (horarios || []).filter((h) => (h.servicio?.id || h.servicioId) === id).length;
  }

  function elegirServicio(id) {
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
      // HU-09/HU-10: alguien tomó el horario o ya hay una cita activa.
      setError(err.response?.data?.message || "No pudimos agendar la cita. Intenta de nuevo.");
      setHorario(null);
      setPaso(2);
      await cargarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  const hoy = hoyISO();

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-10 flex gap-8 flex-wrap items-start">
      <aside className="flex-[1_1_240px] min-w-0">
        <h1 className="m-0 text-[30px] sm:text-[34px] leading-tight font-extrabold">Pedir una cita</h1>
        <p className="mt-1.5 mb-6 text-ink-500">Orientación con el equipo de Desarrollo Humano. La cita queda agendada cuando la confirmas.</p>
        <Pasos paso={paso} />
        <p className="mt-6 mb-0 p-3.5 rounded-xl bg-[#FFF6E0] text-[#5C4206] text-sm">
          ¿Es una urgencia? No esperes la cita: llama a la{" "}
          <a href="tel:123" className="font-extrabold text-[#5C4206] underline underline-offset-4">
            línea 123
          </a>
          .
        </p>
      </aside>

      <div className="flex-[999_1_640px] min-w-0 flex flex-col gap-4">
        {error && <Aviso>{error}</Aviso>}

        {/* Paso 1 */}
        {paso === 1 ? (
          <section aria-labelledby="paso1" className="bg-white rounded-xl p-5 sm:p-7 shadow-[0_10px_30px_rgba(11,35,71,0.08)]">
            <h2 id="paso1" className="m-0 mb-1 text-2xl font-extrabold">1 · ¿Qué servicio necesitas?</h2>
            <p className="m-0 mb-5 text-ink-500">Si no estás seguro, elige orientación psicológica: el profesional te orienta.</p>
            {!servicios && !error && <p className="text-ink-500">Cargando servicios…</p>}
            <fieldset className="m-0 p-0 border-0 flex flex-col gap-2.5">
              <legend className="sr-only">Servicio</legend>
              {servicios?.map((s) => {
                const libres = libresDe(s.id);
                const activo = s.id === servicioId;
                return (
                  <label
                    key={s.id}
                    className={`flex gap-4 items-start p-4 rounded-xl border-[1.5px] cursor-pointer transition-colors ${
                      activo ? "border-primary bg-primary-light" : "border-gray-200 hover:border-primary/40"
                    }`}
                  >
                    <input type="radio" name="servicio" checked={activo} onChange={() => elegirServicio(s.id)} className="mt-1 w-5 h-5 accent-[#19407B]" />
                    <span className="flex-1 min-w-0">
                      <strong className="block text-[17px] text-primary-dark">{s.nombre}</strong>
                      {s.descripcion && <span className="block text-ink-600 text-[15px] mt-0.5">{s.descripcion}</span>}
                      <span className={`block text-sm font-bold mt-1.5 ${libres ? "text-primary" : "text-ink-500"}`}>
                        {libres ? `${libres} ${libres === 1 ? "hora libre" : "horas libres"} en las próximas semanas` : "Sin horas libres por ahora"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!servicioId}
                onClick={() => setPaso(2)}
                className="inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full boton-liquido font-extrabold disabled:opacity-60"
              >
                Continuar
                <Icono nombre="flecha" size={18} strokeWidth={2.2} />
              </button>
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-xl px-5 sm:px-6 py-4 flex justify-between items-center gap-4 flex-wrap">
            <div>
              <span className="text-sm text-ink-500">1 · Servicio</span>
              <br />
              <strong className="text-[17px]">{servicio?.nombre || "Servicio"}</strong>
            </div>
            <button type="button" onClick={() => setPaso(1)} className="min-h-[44px] px-4 rounded-full border-[1.5px] border-gray-200 font-bold text-primary hover:bg-primary-light">
              Cambiar servicio
            </button>
          </section>
        )}

        {/* Paso 2 */}
        {paso === 2 && mes && (
          <section aria-labelledby="paso2" className="bg-white rounded-xl p-5 sm:p-7 shadow-[0_10px_30px_rgba(11,35,71,0.08)]">
            <h2 id="paso2" className="m-0 mb-1 text-2xl font-extrabold">2 · Elige el día y la hora</h2>
            <p className="m-0 mb-5 text-ink-500">Los días en azul tienen horas libres.</p>
            {horarios && delServicio.length === 0 ? (
              <Vacio>
                Este servicio no tiene horas libres por ahora. Prueba con otro servicio, vuelve en unos días o escribe al asistente.
              </Vacio>
            ) : (
              <div className="flex gap-8 flex-wrap">
                <div className="flex-[1_1_340px] min-w-0">
                  <div className="flex justify-between items-center mb-3">
                    <button type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)} className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light">
                      <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
                    </button>
                    <strong className="text-lg" aria-live="polite">
                      {MESES[mes.mes].charAt(0).toUpperCase() + MESES[mes.mes].slice(1)} de {mes.anio}
                    </strong>
                    <button type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)} className="w-11 h-11 rounded-full bg-cream text-primary flex items-center justify-center hover:bg-primary-light">
                      <Icono nombre="derecha" size={18} strokeWidth={2.2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center tabular-nums">
                    {DIAS_CORTOS.map((d) => (
                      <span key={d} className="text-[13px] font-bold text-ink-500 pb-1">
                        {d}
                      </span>
                    ))}
                    {celdasDelMes(mes.anio, mes.mes).map((f, i) => {
                      if (!f) return <span key={`v${i}`} />;
                      const n = Number(f.slice(8));
                      const libres = porDia[f]?.length || 0;
                      const elegido = f === dia;
                      if (!libres)
                        return (
                          <span
                            key={f}
                            className={`h-12 flex items-center justify-center rounded-xl text-[#7A8396] ${f === hoy ? "border-[1.5px] border-primary" : ""}`}
                          >
                            {n}
                          </span>
                        );
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
                          className={`h-12 rounded-xl font-extrabold transition-colors ${elegido ? "boton-liquido" : "bg-primary-light text-primary-dark hover:bg-[#D3E0F5]"}`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex-[1_1_260px] min-w-0">
                  {!dia ? (
                    <p className="m-0 p-4 rounded-xl bg-cream text-ink-500">Toca un día en azul para ver las horas.</p>
                  ) : (
                    <>
                      <h3 className="m-0 mb-3 text-lg font-extrabold">{fechaLarga(dia)}</h3>
                      <div className="grid grid-cols-2 gap-2 tabular-nums">
                        {porDia[dia].map((h) => {
                          const elegido = horario?.id === h.id;
                          return (
                            <button
                              key={h.id}
                              type="button"
                              aria-pressed={elegido}
                              onClick={() => setHorario(h)}
                              className={`min-h-[52px] rounded-xl border-[1.5px] font-bold transition-colors ${
                                elegido ? "border-transparent boton-liquido" : "border-[#D3DBE8] bg-white text-primary-dark hover:border-primary"
                              }`}
                            >
                              {formatearHora(h.horaInicio)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {horario && (
                    <div className="mt-5 p-[18px] rounded-xl bg-cream">
                      <p className="m-0 mb-3 tabular-nums">
                        <strong>
                          {fechaLarga(horario.fecha)}, {formatearHora(horario.horaInicio)}
                        </strong>
                        <br />
                        <span className="text-ink-500">Hasta las {formatearHora(horario.horaFin)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setPaso(3)}
                        className="w-full min-h-[52px] rounded-full boton-liquido font-extrabold"
                      >
                        Continuar a confirmar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
        {paso === 3 && horario && (
          <section className="bg-white rounded-xl px-5 sm:px-6 py-4 flex justify-between items-center gap-4 flex-wrap">
            <div className="tabular-nums">
              <span className="text-sm text-ink-500">2 · Día y hora</span>
              <br />
              <strong className="text-[17px]">
                {fechaLarga(horario.fecha)}, {formatearHora(horario.horaInicio)}
              </strong>
            </div>
            <button type="button" onClick={() => setPaso(2)} className="min-h-[44px] px-4 rounded-full border-[1.5px] border-gray-200 font-bold text-primary hover:bg-primary-light">
              Cambiar hora
            </button>
          </section>
        )}

        {/* Paso 3 */}
        {paso === 3 && horario ? (
          <section aria-labelledby="paso3" className="bg-white rounded-xl p-5 sm:p-7 shadow-[0_10px_30px_rgba(11,35,71,0.08)]">
            <h2 id="paso3" className="m-0 mb-4 text-2xl font-extrabold">3 · Revisa y confirma</h2>
            <dl className="m-0 mb-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-[15px] tabular-nums">
              <dt className="text-ink-500">Servicio</dt>
              <dd className="m-0 font-bold">{servicio?.nombre || horario.servicio?.nombre}</dd>
              <dt className="text-ink-500">Fecha</dt>
              <dd className="m-0 font-bold">{fechaLarga(horario.fecha)}</dd>
              <dt className="text-ink-500">Hora</dt>
              <dd className="m-0 font-bold">
                {formatearHora(horario.horaInicio)} a {formatearHora(horario.horaFin)}
              </dd>
              <dt className="text-ink-500">Lugar</dt>
              <dd className="m-0">Oficina de Bienestar Institucional</dd>
            </dl>
            <p className="m-0 mb-5 text-sm text-ink-500">Puedes cancelarla desde «Mis citas» hasta 24 horas antes.</p>
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando}
              className="inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full boton-liquido font-extrabold disabled:opacity-70"
            >
              <Icono nombre="check" size={18} strokeWidth={2.4} />
              {enviando ? "Agendando…" : "Confirmar cita"}
            </button>
          </section>
        ) : (
          paso < 3 && (
            <section className="bg-white rounded-xl px-5 sm:px-6 py-4 text-ink-500">
              <span className="text-sm">3 · Confirmar</span>
              <br />
              <strong>Revisas los datos y confirmas.</strong>
            </section>
          )
        )}
      </div>
    </main>
  );
}
