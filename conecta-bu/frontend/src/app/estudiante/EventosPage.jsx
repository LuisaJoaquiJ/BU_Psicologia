import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora, fechaLarga } from "../../lib/format";
import { imagenParaEvento } from "../../lib/imagenes";

const ESTADO_INSCRIPCION = {
  Confirmada: "bg-emerald-50 text-emerald-700",
  Cancelada: "bg-gray-100 text-gray-500",
};

// RF-010: el estudiante consulta los eventos publicados, ve el detalle y los
// cupos disponibles, y se inscribe (o cancela su inscripcion). Las reglas
// RN-006 (sin inscripciones duplicadas) y RN-007 (sin superar cupos) las
// valida el backend; aqui solo mostramos su mensaje.
export function EventosPage() {
  const [eventos, setEventos] = useState(null);
  const [inscripciones, setInscripciones] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [procesando, setProcesando] = useState(null);

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

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-3xl font-extrabold text-primary mb-1">Eventos</h1>
      <p className="text-gray-500 mb-8">
        Talleres y actividades de Desarrollo Humano. Inscríbete mientras haya cupos disponibles.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 mb-6">{error}</p>}
      {aviso && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-md p-3 mb-6">{aviso}</p>}

      {!eventos && !error && <p className="text-gray-500">Cargando eventos...</p>}
      {eventos && eventos.length === 0 && (
        <p className="text-gray-500">No hay eventos publicados por ahora. Vuelve a consultar más tarde.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {eventos?.map((evento) => (
          <article key={evento.id} className="bg-white rounded-3xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="relative h-[170px] bg-primary-soft">
              <img src={imagenParaEvento(evento.id).src} alt={imagenParaEvento(evento.id).alt} className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="p-6 flex flex-col gap-3 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-extrabold text-ink-900">{evento.nombre}</h2>
              {inscritoEn(evento) && (
                <span className="text-xs font-medium rounded-full px-3 py-1 bg-emerald-50 text-emerald-700 shrink-0">
                  Inscrito/a
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              <p>{fechaLarga(evento.fecha)}</p>
              <p>
                {formatearHora(evento.horaInicio)} – {formatearHora(evento.horaFin)}
                {evento.lugar ? ` · ${evento.lugar}` : ""}
              </p>
            </div>

            {abierto === evento.id && evento.descripcion && (
              <p className="text-sm text-gray-600 whitespace-pre-line">{evento.descripcion}</p>
            )}
            {evento.descripcion && (
              <button
                onClick={() => setAbierto(abierto === evento.id ? null : evento.id)}
                className="text-sm text-primary font-medium self-start hover:underline"
              >
                {abierto === evento.id ? "Ocultar detalle" : "Ver detalle"}
              </button>
            )}

            <div className="mt-auto pt-2 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                <strong className="text-ink-900">{evento.cuposDisponibles}</strong> de {evento.cupos} cupos ·
                inscripciones hasta el {formatearFecha(evento.fechaLimiteInscripcion)}
              </p>
              {inscritoEn(evento) ? (
                <button
                  onClick={() => cancelarInscripcion(evento)}
                  disabled={procesando === evento.id}
                  className="text-sm font-medium border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  Cancelar inscripción
                </button>
              ) : (
                <button
                  onClick={() => inscribirse(evento)}
                  disabled={procesando === evento.id || !evento.inscripcionAbierta || evento.cuposDisponibles === 0}
                  className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-1.5 hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {!evento.inscripcionAbierta
                    ? "Inscripciones cerradas"
                    : evento.cuposDisponibles === 0
                    ? "Sin cupos"
                    : procesando === evento.id
                    ? "Inscribiendo..."
                    : "Inscribirme"}
                </button>
              )}
            </div>
            </div>
          </article>
        ))}
      </div>

      <h2 className="text-lg font-extrabold text-ink-900 mb-3">Mis inscripciones</h2>
      {inscripciones.length === 0 ? (
        <p className="text-gray-500 text-sm">Aún no te has inscrito a ningún evento.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {inscripciones.map((inscripcion) => (
            <div
              key={inscripcion.id}
              className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3"
            >
              <div>
                <p className="font-medium text-ink-900">{inscripcion.evento?.nombre}</p>
                <p className="text-sm text-gray-500">
                  {fechaLarga(inscripcion.evento?.fecha)} · {formatearHora(inscripcion.evento?.horaInicio)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inscripcion.asistencia && (
                  <span className="text-xs font-medium rounded-full px-3 py-1 bg-sky-50 text-sky-700">
                    {inscripcion.asistencia.asistio ? "Asististe" : "No asististe"}
                  </span>
                )}
                <span
                  className={`text-xs font-medium rounded-full px-3 py-1 ${
                    ESTADO_INSCRIPCION[inscripcion.estado] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {inscripcion.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
