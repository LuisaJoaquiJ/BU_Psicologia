import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora, fechaInputUTC, horaInputUTC } from "../../lib/format";

const FORM_VACIO = {
  nombre: "",
  descripcion: "",
  lugar: "",
  fecha: "",
  horaInicio: "",
  horaFin: "",
  cupos: 20,
  fechaLimiteInscripcion: "",
};

const ESTADO_ESTILOS = {
  Borrador: "bg-gray-100 text-gray-600",
  Publicado: "bg-emerald-50 text-emerald-700",
  Cerrado: "bg-sky-50 text-sky-700",
  Cancelado: "bg-red-50 text-red-600",
};

// Acciones de estado disponibles segun el estado actual del evento.
const ACCIONES_ESTADO = {
  Borrador: [{ estado: "Publicado", label: "Publicar" }],
  Publicado: [
    { estado: "Cerrado", label: "Cerrar" },
    { estado: "Borrador", label: "Despublicar" },
  ],
  Cerrado: [{ estado: "Publicado", label: "Reabrir" }],
  Cancelado: [],
};

const campo = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-ink-900";

function CamposEvento({ valores, onChange }) {
  const set = (clave) => (e) => onChange({ ...valores, [clave]: e.target.value });
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
        Nombre
        <input required value={valores.nombre} onChange={set("nombre")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
        Lugar
        <input value={valores.lugar} onChange={set("lugar")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-4">
        Descripción
        <textarea rows={2} value={valores.descripcion} onChange={set("descripcion")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Fecha
        <input required type="date" value={valores.fecha} onChange={set("fecha")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Hora inicio
        <input required type="time" value={valores.horaInicio} onChange={set("horaInicio")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Hora fin
        <input required type="time" value={valores.horaFin} onChange={set("horaFin")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        Cupos
        <input required type="number" min="1" value={valores.cupos} onChange={set("cupos")} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600 sm:col-span-2">
        Inscripciones hasta
        <input
          required
          type="date"
          value={valores.fechaLimiteInscripcion}
          onChange={set("fechaLimiteInscripcion")}
          className={campo}
        />
      </label>
    </>
  );
}

// RF-009: el administrador crea, edita, publica/cierra/cancela y elimina
// eventos. Desde cada evento se accede a la lista de inscritos (RF-011).
export function GestionEventosPage() {
  const [eventos, setEventos] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [publicarAlCrear, setPublicarAlCrear] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formEdicion, setFormEdicion] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [accionando, setAccionando] = useState(null);

  function cargarEventos() {
    return http
      .get("/admin/eventos")
      .then((res) => setEventos(res.data.eventos))
      .catch(() => setError("No fue posible cargar los eventos."));
  }

  useEffect(() => {
    cargarEventos();
  }, []);

  async function crearEvento(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await http.post("/admin/eventos", { ...form, estado: publicarAlCrear ? "Publicado" : "Borrador" });
      setForm(FORM_VACIO);
      await cargarEventos();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible crear el evento.");
    } finally {
      setEnviando(false);
    }
  }

  function empezarEdicion(evento) {
    setEditandoId(evento.id);
    setFormEdicion({
      nombre: evento.nombre,
      descripcion: evento.descripcion || "",
      lugar: evento.lugar || "",
      fecha: fechaInputUTC(evento.fecha),
      horaInicio: horaInputUTC(evento.horaInicio),
      horaFin: horaInputUTC(evento.horaFin),
      cupos: evento.cupos,
      fechaLimiteInscripcion: fechaInputUTC(evento.fechaLimiteInscripcion),
    });
  }

  async function ejecutar(id, accion, mensajeError) {
    setError("");
    setAccionando(id);
    try {
      await accion();
      await cargarEventos();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || mensajeError);
      return false;
    } finally {
      setAccionando(null);
    }
  }

  async function guardarEdicion(e, id) {
    e.preventDefault();
    const ok = await ejecutar(id, () => http.patch(`/admin/eventos/${id}`, formEdicion), "No fue posible guardar.");
    if (ok) setEditandoId(null);
  }

  function cambiarEstado(evento, estado) {
    if (estado === "Cancelado" && !window.confirm(`¿Cancelar el evento "${evento.nombre}"? No se podrá reactivar.`)) {
      return;
    }
    ejecutar(
      evento.id,
      () => http.patch(`/admin/eventos/${evento.id}/estado`, { estado }),
      "No fue posible cambiar el estado."
    );
  }

  async function eliminar(evento) {
    if (!window.confirm(`¿Eliminar el evento "${evento.nombre}"?`)) return;
    setError("");
    setAccionando(evento.id);
    try {
      await http.delete(`/admin/eventos/${evento.id}`);
      await cargarEventos();
    } catch (err) {
      const mensaje = err.response?.data?.message || "";
      // RF-009, flujo alternativo: con inscripciones activas el backend pide confirmacion.
      if (err.response?.status === 409 && window.confirm(`${mensaje}\n\n¿Deseas eliminarlo de todas formas?`)) {
        try {
          await http.delete(`/admin/eventos/${evento.id}`, { params: { confirmar: true } });
          await cargarEventos();
        } catch (err2) {
          setError(err2.response?.data?.message || "No fue posible eliminar el evento.");
        }
      } else if (err.response?.status !== 409) {
        setError(mensaje || "No fue posible eliminar el evento.");
      }
    } finally {
      setAccionando(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">Gestión de eventos</h1>
      <p className="text-gray-500 mb-8">Crea eventos, publícalos para los estudiantes y controla sus inscripciones.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6 whitespace-pre-line">{error}</p>}

      <form
        onSubmit={crearEvento}
        className="bg-white rounded-2xl border border-gray-200 p-6 mb-8 grid sm:grid-cols-4 gap-4 items-end"
      >
        <CamposEvento valores={form} onChange={setForm} />
        <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
          <input type="checkbox" checked={publicarAlCrear} onChange={(e) => setPublicarAlCrear(e.target.checked)} />
          Publicar de inmediato
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="text-sm font-medium bg-primary text-white rounded-full px-4 py-2 hover:bg-primary-dark transition-colors disabled:opacity-60 sm:col-span-4 sm:justify-self-start"
        >
          {enviando ? "Creando..." : "Crear evento"}
        </button>
      </form>

      {!eventos && !error && <p className="text-gray-500">Cargando eventos...</p>}
      {eventos && eventos.length === 0 && <p className="text-gray-500">Todavía no hay eventos creados.</p>}

      <div className="flex flex-col gap-3">
        {eventos?.map((evento) => (
          <div key={evento.id} className="bg-white rounded-2xl border border-gray-200 p-5">
            {editandoId === evento.id ? (
              <form onSubmit={(e) => guardarEdicion(e, evento.id)} className="grid sm:grid-cols-4 gap-3 items-end">
                <CamposEvento valores={formEdicion} onChange={setFormEdicion} />
                <div className="flex gap-2 sm:col-span-4">
                  <button
                    type="submit"
                    disabled={accionando === evento.id}
                    className="text-sm font-medium bg-primary text-white rounded-full px-4 py-1.5 hover:bg-primary-dark transition-colors disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink-900">{evento.nombre}</p>
                    <span
                      className={`text-xs font-medium rounded-full px-3 py-0.5 ${
                        ESTADO_ESTILOS[evento.estado] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {evento.estado}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 capitalize">
                    {formatearFecha(evento.fecha)} · {formatearHora(evento.horaInicio)} –{" "}
                    {formatearHora(evento.horaFin)}
                    {evento.lugar ? ` · ${evento.lugar}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {evento._count?.inscripciones ?? 0} / {evento.cupos} inscritos
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/admin/eventos/${evento.id}/inscritos`}
                    className="text-sm font-medium bg-primary-light text-primary rounded-full px-4 py-1.5 hover:bg-primary/10 transition-colors"
                  >
                    Inscritos y asistencia
                  </Link>
                  {ACCIONES_ESTADO[evento.estado]?.map(({ estado, label }) => (
                    <button
                      key={estado}
                      onClick={() => cambiarEstado(evento, estado)}
                      disabled={accionando === evento.id}
                      className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                  {evento.estado !== "Cancelado" && (
                    <>
                      <button
                        onClick={() => empezarEdicion(evento)}
                        className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => cambiarEstado(evento, "Cancelado")}
                        disabled={accionando === evento.id}
                        className="text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        Cancelar evento
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => eliminar(evento)}
                    disabled={accionando === evento.id}
                    className="text-sm font-medium text-red-600 rounded-full px-3 py-1.5 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    Eliminar
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
