import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora, fechaInputUTC, horaInputUTC } from "../../lib/format";

const FORM_VACIO = { servicioId: "", fecha: "", horaInicio: "", horaFin: "", cupo: 1 };

// RF-007 · HU-13, HU-14: el administrador publica horarios de atención y
// puede modificarlos o deshabilitarlos/habilitarlos despues.
export function GestionHorariosPage() {
  const [servicios, setServicios] = useState([]);
  const [horarios, setHorarios] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [accionando, setAccionando] = useState(null);

  function cargarHorarios() {
    return http
      .get("/admin/horarios")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No fue posible cargar los horarios."));
  }

  useEffect(() => {
    http.get("/servicios").then((res) => {
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
      await http.post("/admin/horarios", form);
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
      await http.patch(`/admin/horarios/${id}`, formEdicion);
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
        await http.patch(`/admin/horarios/${horario.id}/habilitar`);
      } else {
        await http.patch(`/admin/horarios/${horario.id}/deshabilitar`, {});
      }
      await cargarHorarios();
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      // HU-14: si el horario tiene una cita agendada, el backend pide
      // confirmar explicitamente porque tambien se cancelaria esa cita.
      if (err.response?.status === 409 && mensaje.toLowerCase().includes("confirma")) {
        if (window.confirm(`${mensaje}\n\n¿Deseas continuar de todas formas?`)) {
          try {
            await http.patch(`/admin/horarios/${horario.id}/deshabilitar`, { confirmar: true });
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

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-semibold text-primary mb-1">Gestión de horarios</h1>
      <p className="text-gray-500 mb-8">Publica nuevos horarios de atención y administra los existentes.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6 whitespace-pre-line">{error}</p>}

      <form
        onSubmit={crearHorario}
        className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
      >
        <label className="flex flex-col gap-1 text-sm text-gray-600 lg:col-span-2">
          Servicio
          <select
            required
            value={form.servicioId}
            onChange={(e) => setForm({ ...form, servicioId: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          >
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Fecha
          <input
            required
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Hora inicio
          <input
            required
            type="time"
            value={form.horaInicio}
            onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Hora fin
          <input
            required
            type="time"
            value={form.horaFin}
            onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Cupo
          <input
            type="number"
            min="1"
            value={form.cupo}
            onChange={(e) => setForm({ ...form, cupo: e.target.value })}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors disabled:opacity-60 lg:col-span-5 sm:col-span-2 sm:justify-self-start"
        >
          {enviando ? "Creando..." : "Crear horario"}
        </button>
      </form>

      {!horarios && <p className="text-gray-500">Cargando horarios...</p>}
      {horarios && horarios.length === 0 && <p className="text-gray-500">Todavía no hay horarios publicados.</p>}

      <div className="flex flex-col gap-3">
        {horarios?.map((horario) => (
          <div key={horario.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            {editandoId === horario.id ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <select
                  value={formEdicion.servicioId}
                  onChange={(e) => setFormEdicion({ ...formEdicion, servicioId: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900 lg:col-span-2"
                >
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={formEdicion.fecha}
                  onChange={(e) => setFormEdicion({ ...formEdicion, fecha: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
                />
                <input
                  type="time"
                  value={formEdicion.horaInicio}
                  onChange={(e) => setFormEdicion({ ...formEdicion, horaInicio: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
                />
                <input
                  type="time"
                  value={formEdicion.horaFin}
                  onChange={(e) => setFormEdicion({ ...formEdicion, horaFin: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900"
                />
                <div className="flex gap-2 lg:col-span-5">
                  <button
                    onClick={() => guardarEdicion(horario.id)}
                    disabled={accionando === horario.id}
                    className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-1.5 hover:bg-primary-dark transition-colors disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide">
                    {horario.servicio?.nombre}
                  </p>
                  <p className="font-semibold text-ink-900 capitalize mt-1">{formatearFecha(horario.fecha)}</p>
                  <p className="text-sm text-gray-500">
                    {formatearHora(horario.horaInicio)} – {formatearHora(horario.horaFin)} · Cupo {horario.cupo}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium rounded-full px-3 py-1 ${
                      horario.ocupado ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {horario.ocupado ? "No disponible" : "Disponible"}
                  </span>
                  <button
                    onClick={() => empezarEdicion(horario)}
                    className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarDisponibilidad(horario)}
                    disabled={accionando === horario.id}
                    className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                  >
                    {horario.ocupado ? "Habilitar" : "Deshabilitar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
