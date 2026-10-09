import { useEffect, useState } from "react";
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

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <h1 className="m-0 text-[30px] sm:text-[38px] leading-tight font-extrabold">Mis horarios de atención</h1>
      <p className="mt-1 mb-6 text-ink-500 max-w-[44em]">
        Toca en la semana las horas en que atiendes y elige si se repiten. Los estudiantes solo ven las horas que publiques.
      </p>

      {error && (
        <div className="mb-5 whitespace-pre-line">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {servicios.length > 0 && <PublicarSemana api={api} servicios={servicios} horarios={horarios} alPublicar={cargarHorarios} />}

      <section aria-labelledby="publicados" className="mt-10">
        <div className="flex justify-between items-end gap-4 flex-wrap mb-4">
          <h2 id="publicados" className="m-0 text-2xl font-extrabold">Horarios publicados</h2>
          <label className="flex items-center gap-2 min-h-[44px] text-sm font-bold text-ink-600 cursor-pointer">
            <input type="checkbox" checked={verAnteriores} onChange={(e) => setVerAnteriores(e.target.checked)} className="w-5 h-5 accent-[#19407B]" />
            Mostrar también los de días pasados
          </label>
        </div>

        <details className="mb-4 bg-white rounded-[18px] group">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 min-h-[56px] px-5 font-extrabold text-primary">
            Agregar una sola hora (fecha y hora exactas)
            <Icono nombre="derecha" size={18} strokeWidth={2.2} className="transition-transform group-open:rotate-90" />
          </summary>
          <form onSubmit={crearHorario} className="px-5 pb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 lg:col-span-2">
              Servicio
              <select required value={form.servicioId} onChange={(e) => setForm({ ...form, servicioId: e.target.value })} className={campoChico}>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
              Fecha
              <input required type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={campoChico} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
              Empieza
              <input required type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} className={campoChico} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
              Termina
              <input required type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} className={campoChico} />
            </label>
            <button type="submit" disabled={enviando} className={botonPrimario}>
              {enviando ? "Creando…" : "Agregar"}
            </button>
          </form>
        </details>

        {!horarios && <p className="text-ink-500">Cargando horarios…</p>}
        {horarios && visibles.length === 0 && <Vacio>No hay horarios publicados desde hoy en adelante. Publícalos arriba, tocando la semana.</Vacio>}

        {visibles.length > 0 && (
          <details className="group/lista" open={visibles.length <= 12 || undefined}>
          <summary className="list-none cursor-pointer inline-flex items-center gap-2 min-h-[44px] mb-2 font-extrabold text-primary">
            <Icono nombre="derecha" size={18} strokeWidth={2.2} className="transition-transform group-open/lista:rotate-90" />
            Ver la lista ({visibles.length} {visibles.length === 1 ? "horario" : "horarios"}) para editar o cerrar uno
          </summary>
          <ul className="list-none m-0 p-0 bg-white rounded-[18px] divide-y divide-[#EEF2F7]">
            {visibles.map((horario) => (
              <li key={horario.id} className="px-5 py-4">
                {editandoId === horario.id ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600 lg:col-span-2">
                      Servicio
                      <select value={formEdicion.servicioId} onChange={(e) => setFormEdicion({ ...formEdicion, servicioId: e.target.value })} className={campoChico}>
                        {servicios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                      Fecha
                      <input type="date" value={formEdicion.fecha} onChange={(e) => setFormEdicion({ ...formEdicion, fecha: e.target.value })} className={campoChico} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                      Empieza
                      <input type="time" value={formEdicion.horaInicio} onChange={(e) => setFormEdicion({ ...formEdicion, horaInicio: e.target.value })} className={campoChico} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-bold text-ink-600">
                      Termina
                      <input type="time" value={formEdicion.horaFin} onChange={(e) => setFormEdicion({ ...formEdicion, horaFin: e.target.value })} className={campoChico} />
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
                  <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-3">
                    <div className="min-w-0 tabular-nums">
                      <p className="m-0 font-bold text-ink-900">
                        {fechaLarga(horario.fecha)} · {formatearHora(horario.horaInicio)} a {formatearHora(horario.horaFin)}
                      </p>
                      <p className="m-0 text-sm text-ink-500">{horario.servicio?.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`text-xs font-bold rounded-full px-2.5 py-1 ${horario.ocupado ? "bg-gray-100 text-ink-600" : "bg-[#E3F4F1] text-[#0B6B61]"}`}
                      >
                        {horario.ocupado ? "Ocupado" : "Libre"}
                      </span>
                      <button onClick={() => empezarEdicion(horario)} className={botonSecundario}>
                        Editar
                      </button>
                      <button onClick={() => alternarDisponibilidad(horario)} disabled={accionando === horario.id} className={botonSecundario}>
                        {horario.ocupado ? "Volver a abrir" : "Cerrar este horario"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          </details>
        )}
      </section>
    </main>
  );
}
