import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Aviso, Vacio, botonPrimario, botonSecundario } from "../../components/ui";
import { Icono } from "../../components/Iconos";

// RF-004 / RF-005 · HU-07, HU-08, HU-09, HU-10: consulta de horarios
// disponibles y confirmacion de una cita.
// Los horarios se agrupan por dia y por servicio, y se pueden filtrar por
// servicio (?servicio=<id> llega desde la pagina de Servicios). Elegir una
// hora abre la confirmacion; la cita se crea solo al confirmar.
export function AgendarCitaPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [horarios, setHorarios] = useState(null);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const filtro = params.get("servicio") || "";

  function cargarHorarios() {
    return http
      .get("/citas/horarios-disponibles")
      .then((res) => setHorarios(res.data.horarios))
      .catch(() => setError("No fue posible cargar los horarios disponibles."));
  }

  useEffect(() => {
    cargarHorarios();
  }, []);

  const servicios = useMemo(() => {
    const vistos = new Map();
    for (const h of horarios || []) if (h.servicio) vistos.set(h.servicio.id, h.servicio.nombre);
    return [...vistos].map(([id, nombre]) => ({ id, nombre }));
  }, [horarios]);

  // dia -> servicio -> horarios, en orden cronologico
  const dias = useMemo(() => {
    const visibles = (horarios || []).filter((h) => !filtro || h.servicio?.id === filtro);
    const porDia = new Map();
    for (const h of visibles) {
      const dia = h.fecha.slice(0, 10);
      if (!porDia.has(dia)) porDia.set(dia, new Map());
      const porServicio = porDia.get(dia);
      const clave = h.servicio?.nombre || "Orientación";
      if (!porServicio.has(clave)) porServicio.set(clave, []);
      porServicio.get(clave).push(h);
    }
    return [...porDia].sort(([a], [b]) => a.localeCompare(b));
  }, [horarios, filtro]);

  function filtrar(id) {
    setSeleccion(null);
    setParams(id ? { servicio: id } : {}, { replace: true });
  }

  async function confirmar() {
    setError("");
    setEnviando(true);
    try {
      await http.post("/citas", { horarioId: seleccion.id });
      navigate("/estudiante/mis-citas");
    } catch (err) {
      // HU-09/HU-10: el backend puede rechazar porque alguien mas tomo el
      // horario, o porque ya tienes una cita activa. Mostramos el motivo y
      // refrescamos la lista para que no queden horarios "fantasma".
      setError(err.response?.data?.message || "No fue posible agendar la cita. Intenta de nuevo.");
      setSeleccion(null);
      await cargarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={`max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-10 ${seleccion ? "pb-44 sm:pb-36" : ""}`}>
      <h1 className="m-0 text-3xl sm:text-[34px] font-semibold">Agendar una cita</h1>
      <p className="mt-1.5 mb-7 text-ink-500 max-w-[620px]">
        Elige el servicio y la hora que te sirvan. La cita queda agendada cuando la confirmas.
      </p>

      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      {servicios.length > 1 && (
        <div role="group" aria-label="Filtrar por servicio" className="flex gap-2 flex-wrap mb-8">
          {[{ id: "", nombre: "Todos los servicios" }, ...servicios].map((s) => {
            const activo = filtro === s.id;
            return (
              <button
                key={s.id || "todos"}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar(s.id)}
                className={`min-h-[44px] px-4 rounded-full text-sm font-semibold border-[1.5px] transition-colors ${
                  activo ? "bg-primary border-primary text-white" : "bg-white border-gray-200 text-primary hover:bg-gray-50"
                }`}
              >
                {s.nombre}
              </button>
            );
          })}
        </div>
      )}

      {!horarios && !error && <p className="text-ink-500">Cargando horarios…</p>}

      {horarios && dias.length === 0 && (
        <Vacio>
          {filtro
            ? "Este servicio no tiene horarios libres por ahora. Prueba con otro servicio o vuelve a consultar más tarde."
            : "No hay horarios disponibles por ahora. Vuelve a consultar más tarde."}
        </Vacio>
      )}

      <div className="flex flex-col gap-9">
        {dias.map(([dia, porServicio]) => (
          <section key={dia} aria-labelledby={`dia-${dia}`}>
            <h2 id={`dia-${dia}`} className="m-0 mb-3 font-sans text-lg font-bold text-primary">
              {fechaLarga(dia)}
            </h2>
            <div className="bg-white border border-gray-200 rounded-[22px] divide-y divide-gray-200">
              {[...porServicio].map(([servicio, lista]) => (
                <div key={servicio} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                  <p className="m-0 text-sm font-semibold text-ink-600 sm:w-56 sm:shrink-0 sm:pt-2.5">{servicio}</p>
                  <ul className="list-none m-0 p-0 flex flex-wrap gap-2">
                    {lista.map((h) => {
                      const elegido = seleccion?.id === h.id;
                      return (
                        <li key={h.id}>
                          <button
                            type="button"
                            aria-pressed={elegido}
                            onClick={() => setSeleccion(elegido ? null : h)}
                            className={`min-h-[44px] min-w-[92px] px-3.5 rounded-xl text-[15px] font-bold tabular-nums border-[1.5px] transition-colors ${
                              elegido
                                ? "bg-primary border-primary text-white"
                                : "bg-white border-gray-200 text-primary hover:border-primary-soft hover:bg-primary-light"
                            }`}
                          >
                            {formatearHora(h.horaInicio)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {seleccion && (
        <div
          role="region"
          aria-label="Confirmar cita"
          className="fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 shadow-[0_-12px_32px_rgba(11,42,91,0.12)]"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex-1 min-w-0">
              <p className="m-0 font-bold text-ink-900">{seleccion.servicio?.nombre}</p>
              <p className="m-0 text-sm text-ink-500 tabular-nums">
                {fechaLarga(seleccion.fecha)} · {formatearHora(seleccion.horaInicio)} – {formatearHora(seleccion.horaFin)}
              </p>
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setSeleccion(null)} className={`${botonSecundario} flex-1 sm:flex-none whitespace-nowrap`}>
                Cambiar hora
              </button>
              <button type="button" onClick={confirmar} disabled={enviando} className={`${botonPrimario} flex-[1.4] sm:flex-none whitespace-nowrap`}>
                <Icono nombre="check" size={18} strokeWidth={2.2} />
                {enviando ? "Agendando…" : "Confirmar cita"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
