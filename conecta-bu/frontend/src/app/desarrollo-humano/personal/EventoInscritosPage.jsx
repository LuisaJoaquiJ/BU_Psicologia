import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { formatearHora, fechaLarga } from "../comunes/lib/format";
import { Aviso, Segmentos, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { FotoEvento, btnPositivo, btnPeligro, srcDeEvento } from "./controlesDh";

// RF-011 / RN-010: inscritos confirmados y su asistencia. La lista se descarga
// en el navegador con los datos que ya devolvió el listado; no hay otro endpoint.
const MESES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
const card = "bg-white border border-gray-200 rounded-xl";

function cajaFecha(iso) {
  const d = new Date(iso);
  return { dia: d.getUTCDate(), mes: MESES[d.getUTCMonth()] };
}
function fechaInscripcion(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}
function iniciales(nombre = "") {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  const a = p[0]?.[0] || "";
  const b = (p.length > 2 ? p[2] : p[1])?.[0] || "";
  return `${a}${b}`.toUpperCase();
}
function sinTilde(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function estadoDe(inscripcion) {
  if (!inscripcion.asistencia) return "sr";
  return inscripcion.asistencia.asistio ? "at" : "na";
}
const BADGE = {
  at: ["bg-[#E3F4F1] text-[#0B6B61]", "Asistió"],
  na: ["bg-red-50 text-red-700", "No asistió"],
  sr: ["bg-[#FFF6E0] text-[#8A5A00]", "Sin registrar"],
};
const ESTADO_EVENTO = {
  Publicado: ["bg-[#E3F4F1] text-[#0B6B61]", "Publicado"],
  Borrador: ["bg-gray-100 text-ink-600", "Borrador"],
  Cerrado: ["bg-red-50 text-red-700", "Inscripciones cerradas"],
  Cancelado: ["bg-gray-100 text-ink-600", "Cancelado"],
};

function descargarLista(evento, filas) {
  const encabezado = ["Estudiante", "Correo", "Fecha de inscripción", "Asistencia"];
  const lineas = filas.map((i) => [
    i.usuario?.nombre || "",
    i.usuario?.emailInstitucional || "",
    fechaInscripcion(i.fechaInscripcion),
    BADGE[estadoDe(i)][1],
  ]);
  const csv = [encabezado, ...lineas]
    .map((cols) => cols.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  const base = (evento.nombre || "inscritos").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  enlace.href = url;
  enlace.download = `inscritos-${base || "evento"}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EventoInscritosPage() {
  const { id } = useParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [registrando, setRegistrando] = useState(null);
  const [marcando, setMarcando] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");

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
    setAviso("");
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

  async function marcarTodos(pendientes) {
    if (!pendientes.length) return;
    if (!window.confirm(`¿Marcar ${pendientes.length === 1 ? "1 inscrito" : `${pendientes.length} inscritos`} sin registrar como asistieron?`)) return;
    setError("");
    setAviso("");
    setMarcando(true);
    let ok = 0;
    let mal = 0;
    for (let i = 0; i < pendientes.length; i += 5) {
      const lote = await Promise.allSettled(
        pendientes.slice(i, i + 5).map((ins) => http.patch(`/admin/eventos/${id}/inscripciones/${ins.id}/asistencia`, { asistio: true })),
      );
      for (const r of lote) {
        if (r.status === "fulfilled") ok += 1;
        else mal += 1;
      }
    }
    await cargar();
    setMarcando(false);
    if (mal) setError(`Marcamos ${ok}. ${mal} no se pudieron actualizar.`);
    else setAviso(ok === 1 ? "Se marcó 1 inscrito como asistió." : `Se marcaron ${ok} inscritos como asistieron.`);
  }

  const evento = datos?.evento;
  const inscripciones = datos?.inscripciones || [];
  const asistieron = inscripciones.filter((i) => estadoDe(i) === "at").length;
  const noAsistieron = inscripciones.filter((i) => estadoDe(i) === "na").length;
  const sinRegistrar = inscripciones.filter((i) => estadoDe(i) === "sr");
  const puedeRegistrar = evento && ["Publicado", "Cerrado"].includes(evento.estado);
  const fecha = evento ? cajaFecha(evento.fecha) : null;
  const modalidad = evento?.modalidad === "Virtual" ? "Virtual" : evento?.modalidad === "Hibrida" ? "Híbrida" : "Presencial";

  const visibles = useMemo(() => {
    const texto = sinTilde(q);
    return inscripciones.filter((i) => {
      if (filtro !== "todas" && estadoDe(i) !== filtro) return false;
      if (!texto) return true;
      return sinTilde(`${i.usuario?.nombre || ""} ${i.usuario?.emailInstitucional || ""}`).includes(texto);
    });
  }, [inscripciones, filtro, q]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
      <Link to="/admin/eventos" className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-bold text-primary-dark no-underline hover:underline">
        <Icono nombre="izquierda" size={17} strokeWidth={2.2} />
        Talleres y eventos
      </Link>

      {error && <div className="mt-4"><Aviso>{error}</Aviso></div>}
      {aviso && <div className="mt-4" role="status"><Aviso tono="verde">{aviso}</Aviso></div>}
      {!datos && !error && <p className="text-ink-500 mt-6">Cargando inscritos…</p>}

      {evento && (
        <div className="mt-4 flex flex-col gap-5">
          <section className={`${card} overflow-hidden`}>
            <FotoEvento src={srcDeEvento(evento)} alt="" className="h-40 w-full" />
            <div className="flex gap-4 flex-wrap items-start p-4 sm:p-5">
            <div className="w-[72px] h-[72px] rounded-xl bg-primary-dark text-white flex flex-col items-center justify-center shrink-0 leading-none">
              <b className="text-[26px]">{fecha.dia}</b>
              <span className="text-[11px] font-bold uppercase tracking-wide mt-1 opacity-80">{fecha.mes}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2 mb-2">
                <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${ESTADO_EVENTO[evento.estado]?.[0] || "bg-gray-100 text-ink-600"}`}>
                  {ESTADO_EVENTO[evento.estado]?.[1] || evento.estado}
                </span>
                <span className="text-xs font-bold rounded-full px-2.5 py-1 bg-primary-light text-primary-dark">{modalidad}</span>
              </div>
              <h1 className="m-0 text-[28px] sm:text-[34px] leading-tight font-extrabold">{evento.nombre}</h1>
              <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5"><Icono nombre="reloj" size={15} />{fechaLarga(evento.fecha)} · {formatearHora(evento.horaInicio)} a {formatearHora(evento.horaFin)}</span>
                {evento.lugar ? <span className="inline-flex items-center gap-1.5"><Icono nombre="ubicacion" size={15} />{evento.lugar}</span> : null}
                <span className="inline-flex items-center gap-1.5"><Icono nombre="usuarios" size={15} />{inscripciones.length} de {evento.cupos} cupos</span>
              </p>
            </div>
            <button type="button" onClick={() => descargarLista(evento, inscripciones)} disabled={!inscripciones.length} className={botonSecundario}>
              <Icono nombre="descarga" size={16} strokeWidth={2.2} />
              Descargar lista
            </button>
            </div>
          </section>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi titulo="Inscritos" valor={inscripciones.length} detalle={`${evento.cupos ? Math.round((inscripciones.length / evento.cupos) * 100) : 0} % de los cupos`} />
            <Kpi titulo="Asistieron" valor={asistieron} tono="verde" barra={inscripciones.length ? (asistieron / inscripciones.length) * 100 : 0} />
            <Kpi titulo="No asistieron" valor={noAsistieron} tono="rojo" detalle="Se les puede escribir para reprogramar" />
            <Kpi titulo="Sin registrar" valor={sinRegistrar.length} tono="oro" detalle="Marca la asistencia que falta" />
          </div>

          {!puedeRegistrar && (
            <p className="m-0 text-sm text-[#5C4206] bg-[#FFF6E0] border border-[#F2D49B] rounded-xl px-4 py-3">
              La asistencia se registra cuando el evento está publicado o cerrado.
            </p>
          )}

          <section className={`${card} p-4 sm:p-5`}>
            <div className="flex justify-between items-center gap-3 flex-wrap mb-4">
              <Segmentos
                etiqueta="Filtrar asistencia"
                valor={filtro}
                alCambiar={setFiltro}
                opciones={[
                  ["todas", "Todos"],
                  ["at", "Asistieron"],
                  ["na", "No asistieron"],
                  ["sr", "Sin registrar"],
                ]}
                conteos={{ todas: inscripciones.length, at: asistieron, na: noAsistieron, sr: sinRegistrar.length }}
              />
              <div className="flex gap-2 flex-wrap items-center">
                <label className={`${claseCampo} !w-[240px] inline-flex items-center gap-2 !px-3`}>
                  <Icono nombre="buscar" size={16} className="text-ink-500 shrink-0" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar inscrito" aria-label="Buscar inscrito" className="w-full bg-transparent outline-none text-[15px]" />
                </label>
                {puedeRegistrar && (
                  <button type="button" onClick={() => marcarTodos(sinRegistrar)} disabled={marcando || sinRegistrar.length === 0} className={`${btnPositivo} min-h-[44px] px-4`}>
                    <Icono nombre="check" size={16} strokeWidth={2.4} />
                    {marcando ? "Marcando…" : "Marcar sin registrar como asistieron"}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="text-[11px] font-bold tracking-wide uppercase text-ink-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-bold">Estudiante</th>
                    <th className="py-2 pr-3 font-bold w-[180px]">Fecha de inscripción</th>
                    <th className="py-2 pr-3 font-bold w-[140px]">Asistencia</th>
                    <th className="py-2 font-bold text-right w-[240px]">Registrar</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-ink-500">
                        {inscripciones.length === 0 ? "Este evento todavía no tiene inscritos." : "No hay inscritos con ese filtro."}
                      </td>
                    </tr>
                  )}
                  {visibles.map((inscripcion) => {
                    const est = estadoDe(inscripcion);
                    const [clase, texto] = BADGE[est];
                    return (
                      <tr key={inscripcion.id} className="border-b border-gray-100">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-primary-light text-primary-dark text-xs font-bold grid place-items-center shrink-0">{iniciales(inscripcion.usuario?.nombre)}</span>
                            <span className="min-w-0">
                              <span className="block font-bold text-ink-900 truncate">{inscripcion.usuario?.nombre}</span>
                              <span className="block text-xs text-ink-500 truncate">{inscripcion.usuario?.emailInstitucional}</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-sm text-ink-600">{fechaInscripcion(inscripcion.fechaInscripcion)}</td>
                        <td className="py-3 pr-3"><span className={`text-xs font-bold rounded-full px-2.5 py-1 ${clase}`}>{texto}</span></td>
                        <td className="py-3">
                          {puedeRegistrar ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                aria-pressed={est === "at"}
                                onClick={() => registrar(inscripcion.id, true)}
                                disabled={registrando === inscripcion.id || est === "at"}
                                className={btnPositivo}
                              >
                                <Icono nombre="check" size={16} strokeWidth={2.4} />
                                Asistió
                              </button>
                              <button
                                type="button"
                                aria-pressed={est === "na"}
                                onClick={() => registrar(inscripcion.id, false)}
                                disabled={registrando === inscripcion.id || est === "na"}
                                className={btnPeligro}
                              >
                                <Icono nombre="cerrar" size={16} strokeWidth={2.4} />
                                No asistió
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-ink-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="m-0 mt-3 text-xs text-ink-500">
              Mostrando {visibles.length} de {inscripciones.length} inscritos
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function Kpi({ titulo, valor, detalle, tono, barra }) {
  const color = tono === "verde" ? "text-[#0E6B4A]" : tono === "rojo" ? "text-red-700" : tono === "oro" ? "text-[#8A5A00]" : "text-ink-900";
  const marco = tono === "oro" ? "border-[#F2D49B] bg-[#FFFCF2]" : "border-gray-200 bg-white";
  return (
    <div className={`rounded-xl border p-4 ${marco}`}>
      <p className="m-0 text-[13px] text-ink-500">{titulo}</p>
      <p className={`mt-1 mb-0 text-[32px] leading-none font-extrabold tabular-nums ${color}`}>{valor}</p>
      {typeof barra === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-[#0E6B4A]" style={{ width: `${Math.min(100, barra)}%` }} />
        </div>
      )}
      {detalle && <p className="mt-2 mb-0 text-xs text-ink-500">{detalle}</p>}
    </div>
  );
}
