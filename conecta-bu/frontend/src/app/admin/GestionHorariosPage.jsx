import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { formatearHora, fechaInputUTC, horaInputUTC, fechaLarga } from "../../lib/format";
import { Aviso, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../components/ui";
import { PublicarSemana } from "./PublicarSemana";

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
    return http
      .get(`${api}/horarios`)
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No fue posible cargar los horarios."));
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
  const porDia = [];
  for (const h of [...visibles].sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio))) {
    const dia = h.fecha.slice(0, 10);
    if (!porDia.length || porDia.at(-1).dia !== dia) porDia.push({ dia, fecha: h.fecha, horarios: [] });
    porDia.at(-1).horarios.push(h);
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-32">
      <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Mis horarios de atención</h1>
      <p className="mt-1 mb-6 text-ink-500 max-w-[44em]">
        Estas son las horas que los estudiantes pueden reservar. Para publicar más, usa el botón <strong className="text-ink-700">Agregar horario</strong>.
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

      <div className="flex justify-between items-center gap-4 flex-wrap mb-5">
        <p className="m-0 flex items-center gap-2 flex-wrap text-sm">
          <span className="inline-flex items-center rounded-full bg-[#E3F4F1] text-[#0B6B61] font-bold px-3 py-1.5 tabular-nums">
            {libres} {libres === 1 ? "libre" : "libres"}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 text-ink-600 font-bold px-3 py-1.5 tabular-nums">
            {visibles.length - libres} {visibles.length - libres === 1 ? "ocupado" : "ocupados"}
          </span>
        </p>
        <label className="flex items-center gap-2 min-h-[44px] text-sm font-bold text-ink-600 cursor-pointer">
          <input type="checkbox" checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} className="w-5 h-5 accent-[#19407B]" />
          Mostrar también los de días pasados
        </label>
      </div>

      {!horarios && <p className="text-ink-500">Cargando horarios…</p>}
      {horarios && visibles.length === 0 && (
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

      <div className="flex flex-col gap-4">
        {porDia.map((grupo) => (
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
                        <span className="w-[104px] shrink-0 whitespace-nowrap font-extrabold text-ink-900 tabular-nums">
                          {formatearHora(horario.horaInicio)}
                        </span>
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
        ))}
      </div>

      {/* Boton flotante: abre el panel para agregar horarios */}
      {!panelAbierto && servicios.length > 0 && (
        <button
          type="button"
          onClick={() => abrirPanel("semana")}
          className="fixed z-30 bottom-5 right-4 sm:bottom-8 sm:right-8 inline-flex items-center gap-2.5 min-h-[56px] pl-5 pr-6 rounded-full bg-cyan text-primary-dark font-extrabold text-[15px] shadow-[0_12px_30px_rgba(11,35,71,0.30)] hover:brightness-95 active:scale-[0.98] transition"
        >
          <span className="w-8 h-8 rounded-full bg-primary-dark text-white flex items-center justify-center">
            <Icono nombre="mas" size={18} strokeWidth={2.6} />
          </span>
          Agregar horario
        </button>
      )}

      {panelAbierto && (
        <PanelAgregar titulo="Agregar horario" alCerrar={cerrarPanel}>
          <div role="tablist" aria-label="Forma de agregar" className="inline-flex bg-white border border-gray-200 rounded-full p-1 gap-1 mb-5">
            {[
              ["semana", "Varias horas"],
              ["una", "Una sola hora"],
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
          {modoPanel === "semana" ? (
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
        </PanelAgregar>
      )}
    </main>
  );
}

// Ventana sobre la pagina (dialogo): se cierra con la X, con Esc o tocando fuera.
function PanelAgregar({ titulo, alCerrar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previo = document.activeElement;
    ref.current?.focus();
    const alTeclear = (e) => e.key === "Escape" && alCerrar();
    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, [alCerrar]);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[#0B2347]/55" onClick={alCerrar} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-panel-agregar"
        tabIndex={-1}
        className="relative w-full sm:max-w-[1180px] max-h-[92vh] overflow-y-auto bg-cream rounded-t-[28px] sm:rounded-[28px] shadow-2xl outline-none"
      >
        <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur px-5 sm:px-8 pt-5 pb-3 flex items-center justify-between gap-4 border-b border-gray-200">
          <h2 id="titulo-panel-agregar" className="m-0 text-2xl font-extrabold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="w-11 h-11 rounded-full bg-white border border-gray-200 text-ink-700 flex items-center justify-center hover:bg-gray-50"
          >
            <Icono nombre="cerrar" size={20} strokeWidth={2.2} />
          </button>
        </div>
        <div className="px-5 sm:px-8 py-6">{children}</div>
      </div>
    </div>
  );
}
