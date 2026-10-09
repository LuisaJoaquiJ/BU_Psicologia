import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { formatearHora, fechaInputUTC, horaInputUTC, fechaLarga } from "../../lib/format";
import { Aviso, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../components/ui";
import { PublicarSemana } from "./PublicarSemana";
import { BotonFlotante, Ventana } from "../../components/Ventana";
import { CalendarioMes, SelectorVista } from "../../components/CalendarioMes";
import { FormularioNoDisponible, textoBloqueo } from "./NoDisponible";

const FORM_VACIO = { servicioId: "", fecha: "", horaInicio: "", horaFin: "", cupo: 1 };

// RF-007 · HU-13, HU-14: el administrador publica horarios de atención y
// puede modificarlos o deshabilitarlos/habilitarlos despues.
// "api" y "modulo" permiten usar la misma pantalla en Desarrollo humano
// (/admin) y en Salud integral (/salud), cada una con sus servicios.
export function GestionHorariosPage({ api = "/admin", modulo = "desarrollo-humano" }) {
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [accionando, setAccionando] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [params, setParams] = useSearchParams();
  // ?agregar=1 (desde "Publicar horario" del inicio) abre el panel de una vez.
  const [panelAbierto, setPanelAbierto] = useState(params.get("agregar") === "1");
  const [modoPanel, setModoPanel] = useState("semana");
  const [aviso, setAviso] = useState("");
  const [vista, setVista] = useState("calendario");
  const [bloqueos, setBloqueos] = useState([]);
  const [diaSel, setDiaSel] = useState(null);

  function abrirPanel(modo) {
    setError("");
    setAviso("");
    setModoPanel(modo);
    setPanelAbierto(true);
  }
  const cerrarPanel = useCallback(() => {
    setPanelAbierto(false);
    setError("");
    if (params.get("agregar")) setParams({}, { replace: true });
  }, [params, setParams]);

  function cargarHorarios() {
    http
      .get(`${api}/horarios/bloqueos`)
      .then((res) => setBloqueos(res.data.bloqueos))
      .catch(() => setBloqueos([]));
    return http
      .get(`${api}/horarios`)
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No fue posible cargar los horarios."));
  }

  async function quitarBloqueo(b) {
    if (!window.confirm(`¿Quitar «${b.motivo}» (${textoBloqueo(b)})? Los horarios de ese tiempo vuelven a ofrecerse.`)) return;
    setError("");
    try {
      await http.delete(`${api}/horarios/bloqueos/${b.id}`);
      setAviso("Listo: ese tiempo vuelve a estar disponible.");
      await cargarHorarios();
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos quitarlo.");
    }
  }

  useEffect(() => {
    http.get("/servicios", { params: { modulo } }).then((res) => {
      setServicios(res.data.servicios);
      setForm((f) => ({ ...f, servicioId: f.servicioId || res.data.servicios[0]?.id || "" }));
    });
    cargarHorarios();
  }, []);

  async function crearHorario(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await http.post(`${api}/horarios`, form);
      setForm((f) => ({ ...FORM_VACIO, servicioId: f.servicioId }));
      await cargarHorarios();
      setPanelAbierto(false);
      setAviso("Listo: el horario quedó publicado y ya aparece en tu lista.");
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible crear el horario.");
    } finally {
      setEnviando(false);
    }
  }

  function empezarEdicion(horario) {
    setEditandoId(horario.id);
    setFormEdicion({
      servicioId: horario.servicioId,
      fecha: fechaInputUTC(horario.fecha),
      horaInicio: horaInputUTC(horario.horaInicio),
      horaFin: horaInputUTC(horario.horaFin),
      cupo: horario.cupo,
    });
  }

  async function guardarEdicion(id) {
    setError("");
    setAccionando(id);
    try {
      await http.patch(`${api}/horarios/${id}`, formEdicion);
      setEditandoId(null);
      await cargarHorarios();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible guardar los cambios.");
    } finally {
      setAccionando(null);
    }
  }

  async function alternarDisponibilidad(horario) {
    setError("");
    setAccionando(horario.id);
    try {
      if (horario.ocupado) {
        await http.patch(`${api}/horarios/${horario.id}/habilitar`);
      } else {
        await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, {});
      }
      await cargarHorarios();
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      // HU-14: si el horario tiene una cita agendada, el backend pide
      // confirmar explicitamente porque tambien se cancelaria esa cita.
      if (err.response?.status === 409 && mensaje.toLowerCase().includes("confirma")) {
        if (window.confirm(`${mensaje}\n\n¿Deseas continuar de todas formas?`)) {
          try {
            await http.patch(`${api}/horarios/${horario.id}/deshabilitar`, { confirmar: true });
            await cargarHorarios();
          } catch (err2) {
            setError(err2.response?.data?.message || "No fue posible deshabilitar el horario.");
          }
        }
      } else {
        setError(mensaje || "No fue posible actualizar el horario.");
      }
    } finally {
      setAccionando(null);
    }
  }

  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const visibles = (horarios || []).filter((h) => verAnteriores || h.fecha.slice(0, 10) >= hoyStr);
  const campoChico = claseCampo;
  const libres = visibles.filter((h) => !h.ocupado).length;

  // Horarios agrupados por dia, en orden.
  const agrupar = (lista) => {
    const grupos = [];
    for (const h of [...lista].sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio))) {
      const dia = h.fecha.slice(0, 10);
      if (!grupos.length || grupos.at(-1).dia !== dia) grupos.push({ dia, fecha: h.fecha, horarios: [] });
      grupos.at(-1).horarios.push(h);
    }
    return grupos;
  };
  const porDia = agrupar(visibles);

  // Calendario: por dia, horarios libres/ocupados y tiempo no disponible.
  const bloqueosDe = (dia) => bloqueos.filter((b) => b.fechaInicio <= dia && b.fechaFin >= dia);
  const marcas = {};
  for (const g of agrupar(horarios || [])) {
    const l = g.horarios.filter((h) => !h.ocupado).length;
    const o = g.horarios.length - l;
    marcas[g.dia] = [
      ...(l ? [{ texto: `${l} ${l === 1 ? "libre" : "libres"}`, tono: "verde" }] : []),
      ...(o ? [{ texto: `${o} ${o === 1 ? "ocupado" : "ocupados"}`, tono: "marino" }] : []),
    ];
  }
  for (const b of bloqueos) {
    for (let d = new Date(`${b.fechaInicio}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
      const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (dia > b.fechaFin) break;
      (marcas[dia] ||= []).unshift({ texto: b.motivo, tono: "ambar" });
    }
  }
  const diaElegido = diaSel || hoyStr;
  const grupoElegido = agrupar((horarios || []).filter((h) => h.fecha.slice(0, 10) === diaElegido))[0];
  const proximosBloqueos = bloqueos.filter((b) => b.fechaFin >= hoyStr);

  function renderDia(grupo) {
    return (
      <section key={grupo.dia} aria-label={fechaLarga(grupo.fecha)} className="bg-white rounded-[22px] border border-gray-200 overflow-hidden">
        <h2
          className={`m-0 px-5 py-3 text-base font-extrabold flex items-center justify-between gap-3 ${grupo.dia === hoyStr ? "bg-primary-dark text-white" : "bg-gray-50 text-ink-900"}`}
        >
          <span>
            {fechaLarga(grupo.fecha)}
            {grupo.dia === hoyStr && <span className="ml-2 text-cyan">· Hoy</span>}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${grupo.dia === hoyStr ? "text-[#B9C7DE]" : "text-ink-500"}`}>
            {grupo.horarios.length} {grupo.horarios.length === 1 ? "horario" : "horarios"}
          </span>
        </h2>
        <ul className="list-none m-0 p-0 divide-y divide-[#EEF2F7]">
          {grupo.horarios.map((horario) => (
            <li key={horario.id} className="px-5 py-3.5">
              {editandoId === horario.id ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 lg:col-span-2">
                    Servicio
                    <select
                      value={formEdicion.servicioId}
                      onChange={(e) => setFormEdicion({ ...formEdicion, servicioId: e.target.value })}
                      className={campoChico}
                    >
                      {servicios.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Fecha
                    <input
                      type="date"
                      value={formEdicion.fecha}
                      onChange={(e) => setFormEdicion({ ...formEdicion, fecha: e.target.value })}
                      className={campoChico}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Empieza
                    <input
                      type="time"
                      value={formEdicion.horaInicio}
                      onChange={(e) => setFormEdicion({ ...formEdicion, horaInicio: e.target.value })}
                      className={campoChico}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                    Termina
                    <input
                      type="time"
                      value={formEdicion.horaFin}
                      onChange={(e) => setFormEdicion({ ...formEdicion, horaFin: e.target.value })}
                      className={campoChico}
                    />
                  </label>
                  <div className="flex gap-2 lg:col-span-5">
                    <button onClick={() => guardarEdicion(horario.id)} disabled={accionando === horario.id} className={botonPrimario}>
                      Guardar cambios
                    </button>
                    <button onClick={() => setEditandoId(null)} className={botonSecundario}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-2.5">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="w-[104px] shrink-0 whitespace-nowrap font-extrabold text-ink-900 tabular-nums">{formatearHora(horario.horaInicio)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900 truncate">{horario.servicio?.nombre}</span>
                      <span className="block text-xs text-ink-500 tabular-nums">hasta {formatearHora(horario.horaFin)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-bold rounded-full px-2.5 py-1 ${horario.ocupado ? "bg-gray-100 text-ink-600" : "bg-[#E3F4F1] text-[#0B6B61]"}`}
                    >
                      {horario.ocupado ? "Ocupado" : "Libre"}
                    </span>
                    <button
                      onClick={() => empezarEdicion(horario)}
                      className="min-h-[40px] px-3.5 rounded-full text-sm font-bold text-primary hover:bg-primary-light"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => alternarDisponibilidad(horario)}
                      disabled={accionando === horario.id}
                      className="min-h-[40px] px-3.5 rounded-full text-sm font-bold text-primary hover:bg-primary-light disabled:opacity-60"
                    >
                      {horario.ocupado ? "Volver a abrir" : "Cerrar"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-32">
      <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Mis horarios de atención</h1>
      <p className="mt-1 mb-6 text-ink-500 max-w-[44em]">
        Estas son las horas que los estudiantes pueden reservar. Para publicar más o marcar un tiempo en que no atiendes, usa el botón{" "}
        <strong className="text-ink-900">Agregar horario</strong>.
      </p>

      {error && !panelAbierto && (
        <div className="mb-5 whitespace-pre-line">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-5" role="status">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}

      {proximosBloqueos.length > 0 && (
        <section className="mb-5 bg-[#FFF8EB] border border-[#F2D49B] rounded-[22px] p-4 sm:p-5">
          <h2 className="m-0 mb-2 text-base font-extrabold text-[#5C4206]">Tiempo no disponible</h2>
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {proximosBloqueos.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 flex-wrap bg-white rounded-2xl px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block font-bold text-ink-900">
                    {b.motivo}
                    {b.detalle ? <span className="font-semibold text-ink-500"> · {b.detalle}</span> : null}
                  </span>
                  <span className="block text-sm text-ink-500">{textoBloqueo(b)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => quitarBloqueo(b)}
                  className="min-h-[40px] px-3.5 rounded-full text-sm font-bold text-primary hover:bg-primary-light"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-between items-center gap-4 flex-wrap mb-5">
        <SelectorVista vista={vista} setVista={setVista} />
        <p className="m-0 flex items-center gap-2 flex-wrap text-sm">
          <span className="inline-flex items-center rounded-full bg-[#E3F4F1] text-[#0B6B61] font-bold px-3 py-1.5 tabular-nums">
            {libres} {libres === 1 ? "libre" : "libres"}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 text-ink-600 font-bold px-3 py-1.5 tabular-nums">
            {visibles.length - libres} {visibles.length - libres === 1 ? "ocupado" : "ocupados"}
          </span>
        </p>
        {vista === "lista" && (
          <label className="flex items-center gap-2 min-h-[44px] text-sm font-bold text-ink-600 cursor-pointer">
            <input type="checkbox" checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} className="w-5 h-5 accent-[#19407B]" />
            Mostrar también los de días pasados
          </label>
        )}
      </div>

      {!horarios && <p className="text-ink-500">Cargando horarios…</p>}
      {horarios && vista === "calendario" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] items-start">
          <CalendarioMes
            marcas={marcas}
            seleccionado={diaElegido}
            onSeleccionar={setDiaSel}
            leyenda={[
              ["verde", "Libres para reservar"],
              ["marino", "Ocupados (con cita o cerrados)"],
              ["ambar", "No disponible"],
            ]}
          />
          <div className="flex flex-col gap-3 xl:sticky xl:top-4">
            {bloqueosDe(diaElegido).map((b) => (
              <div key={b.id} className="rounded-2xl bg-[#FFF1DC] text-[#5C4206] px-4 py-3 flex items-center justify-between gap-3">
                <span>
                  <strong>No disponible: {b.motivo}</strong>
                  <span className="block text-sm">{b.todoElDia ? "Todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`}</span>
                </span>
                <button type="button" onClick={() => quitarBloqueo(b)} className="min-h-[40px] px-3 rounded-full text-sm font-bold hover:bg-white/60">
                  Quitar
                </button>
              </div>
            ))}
            {grupoElegido ? (
              renderDia(grupoElegido)
            ) : (
              <div className="bg-white rounded-[22px] border border-gray-200 px-5 py-8 text-center">
                <p className="m-0 font-extrabold text-ink-900">{fechaLarga(`${diaElegido}T12:00:00Z`)}</p>
                <p className="m-0 mt-1 text-ink-500">No tienes horarios este día.</p>
                {diaElegido >= hoyStr && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, fecha: diaElegido }));
                      abrirPanel("una");
                    }}
                    className={`${botonSecundario} mt-3`}
                  >
                    Agregar un horario este día
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {horarios && vista === "lista" && visibles.length === 0 && (
        <div className="bg-white rounded-[22px] border border-gray-200 px-6 py-12 text-center flex flex-col items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-primary-light text-primary flex items-center justify-center">
            <Icono nombre="calendario" size={28} strokeWidth={2} />
          </span>
          <p className="m-0 text-lg font-extrabold text-ink-900">Todavía no tienes horarios publicados</p>
          <p className="m-0 text-ink-500 max-w-[36em]">Publica las horas en que atiendes para que los estudiantes puedan pedir su cita.</p>
          <button type="button" onClick={() => abrirPanel("semana")} className={`${botonPrimario} mt-2`}>
            Agregar horario
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">{vista === "lista" && porDia.map((grupo) => renderDia(grupo))}</div>

      {/* Boton flotante: abre el panel para agregar horarios */}
      {!panelAbierto && servicios.length > 0 && <BotonFlotante onClick={() => abrirPanel("semana")}>Agregar horario</BotonFlotante>}

      {panelAbierto && (
        <Ventana titulo="Agregar horario" alCerrar={cerrarPanel}>
          <div role="tablist" aria-label="Forma de agregar" className="inline-flex flex-wrap bg-white border border-gray-200 rounded-[24px] p-1 gap-1 mb-5">
            {[
              ["semana", "Varias horas"],
              ["una", "Una sola hora"],
              ["ausente", "No estaré disponible"],
            ].map(([id, texto]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={modoPanel === id}
                onClick={() => setModoPanel(id)}
                className={`min-h-[40px] px-4 rounded-full text-sm font-bold ${modoPanel === id ? "bg-primary-dark text-white" : "text-primary hover:bg-primary-light"}`}
              >
                {texto}
              </button>
            ))}
          </div>
          {error && (
            <div className="mb-4 whitespace-pre-line">
              <Aviso>{error}</Aviso>
            </div>
          )}
          {modoPanel === "ausente" ? (
            <FormularioNoDisponible
              api={api}
              fechaInicial={diaSel}
              alGuardar={async (res) => {
                setPanelAbierto(false);
                setAviso(
                  `Listo: «${res.bloqueo.motivo}» quedó registrado. ${res.citasCanceladas ? `Se cancelaron ${res.citasCanceladas} ${res.citasCanceladas === 1 ? "cita" : "citas"} y se avisó a los estudiantes. ` : ""}En ese tiempo los estudiantes no verán horarios.`,
                );
                await cargarHorarios();
              }}
            />
          ) : modoPanel === "semana" ? (
            <PublicarSemana api={api} servicios={servicios} horarios={horarios} alPublicar={cargarHorarios} />
          ) : (
            <form onSubmit={crearHorario} className="bg-white rounded-[18px] p-6 grid gap-4 sm:grid-cols-2 items-end max-w-[720px]">
              <p className="m-0 sm:col-span-2 text-ink-600">Para una cita en una fecha y hora exactas, fuera de tu horario habitual.</p>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 sm:col-span-2">
                Servicio
                <select required value={form.servicioId} onChange={(e) => setForm({ ...form, servicioId: e.target.value })} className={campoChico}>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 sm:col-span-2">
                Fecha
                <input
                  required
                  type="date"
                  min={hoyStr}
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className={campoChico}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                Empieza
                <input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className={campoChico} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                Termina
                <input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className={campoChico} />
              </label>
              <button type="submit" disabled={enviando} className={`${botonPrimario} sm:col-span-2 justify-center`}>
                {enviando ? "Agregando…" : "Agregar este horario"}
              </button>
            </form>
          )}
        </Ventana>
      )}
    </main>
  );
}
