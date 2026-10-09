import { useEffect, useState } from "react";
import { Icono } from "../../components/Iconos";
import { Link, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearFecha, formatearHora, fechaLarga } from "../../lib/format";

// RF-011 / RN-010: el administrador ve los estudiantes inscritos en un evento
// y registra si asistieron. Solo aparecen inscripciones confirmadas, asi que
// no es posible marcar asistencia de alguien que no se inscribio.
export function EventoInscritosPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(null);

  function cargar() {
    return http
      .get(`/admin/eventos/${id}/inscripciones`)
      .then((res) => setDatos(res.data))
      .catch((err) => setError(err.response?.data?.message || "No fue posible cargar los inscritos."));
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function registrar(inscripcionId, asistio) {
    setError("");
    setRegistrando(inscripcionId);
    try {
      await http.patch(`/admin/eventos/${id}/inscripciones/${inscripcionId}/asistencia`, { asistio });
      await cargar();
    } catch (err) {
      setError(err.response?.data?.message || "No fue posible registrar la asistencia.");
    } finally {
      setRegistrando(null);
    }
  }

  const evento = datos?.evento;
  const inscripciones = datos?.inscripciones || [];
  const asistieron = inscripciones.filter((i) => i.asistencia?.asistio === true).length;
  const noAsistieron = inscripciones.filter((i) => i.asistencia?.asistio === false).length;
  const puedeRegistrar = evento && ["Publicado", "Cerrado"].includes(evento.estado);

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <Link to="/admin/eventos" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary font-bold hover:underline underline-offset-4">
        <Icono nombre="izquierda" size={17} strokeWidth={2.2} />
        Volver a eventos
      </Link>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md p-3 my-6">{error}</p>}
      {!datos && !error && <p className="text-gray-500 mt-6">Cargando inscritos...</p>}

      {evento && (
        <>
          <h1 className="text-3xl font-semibold text-primary mt-4 mb-1">{evento.nombre}</h1>
          <p className="text-gray-500 mb-6">
            {fechaLarga(evento.fecha)} · {formatearHora(evento.horaInicio)} – {formatearHora(evento.horaFin)}
            {evento.lugar ? ` · ${evento.lugar}` : ""} · {evento.estado}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Inscritos", valor: inscripciones.length },
              { label: "Cupos", valor: evento.cupos },
              { label: "Asistieron", valor: asistieron },
              { label: "No asistieron", valor: noAsistieron },
            ].map(({ label, valor }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-semibold text-ink-900">{valor}</p>
              </div>
            ))}
          </div>

          {!puedeRegistrar && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-md p-3 mb-6">
              La asistencia se registra cuando el evento está publicado o cerrado.
            </p>
          )}

          {inscripciones.length === 0 && <p className="text-gray-500">Este evento todavía no tiene inscritos.</p>}

          <div className="flex flex-col gap-3">
            {inscripciones.map((inscripcion) => {
              const estadoAsistencia = inscripcion.asistencia
                ? inscripcion.asistencia.asistio
                  ? "Asistió"
                  : "No asistió"
                : "Sin registrar";
              return (
                <div
                  key={inscripcion.id}
                  className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3"
                >
                  <div>
                    <p className="font-medium text-ink-900">{inscripcion.usuario?.nombre}</p>
                    <p className="text-xs text-gray-500">{inscripcion.usuario?.emailInstitucional}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium rounded-full px-3 py-1 bg-gray-100 text-gray-600">
                      {estadoAsistencia}
                    </span>
                    {puedeRegistrar && (
                      <>
                        <button
                          onClick={() => registrar(inscripcion.id, true)}
                          disabled={registrando === inscripcion.id || inscripcion.asistencia?.asistio === true}
                          className="text-sm font-medium bg-emerald-50 text-emerald-700 rounded-full px-4 py-1.5 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          Asistió
                        </button>
                        <button
                          onClick={() => registrar(inscripcion.id, false)}
                          disabled={registrando === inscripcion.id || inscripcion.asistencia?.asistio === false}
                          className="text-sm font-medium bg-amber-50 text-amber-700 rounded-full px-4 py-1.5 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          No asistió
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
