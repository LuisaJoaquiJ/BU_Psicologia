import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { ESTILO_GRUPO, TONO_ESTADO, destinoDe, diasPara, fechaLarga, hora12, tituloDe, useCatalogoSst } from "../../lib/sst";
import { descargar, mensajeError } from "../../lib/salud";
import { DetalleReporte, EncabezadoReporte } from "../sst/DetalleReporte";
import { Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "./ui";

// Bandeja del personal de Salud integral para las salidas institucionales y
// los reportes de condiciones inseguras (antes, las respuestas del Forms).

const PESTANAS = [
  { id: "Recibido", label: "Por revisar" },
  { id: "RequiereAjustes", label: "Con ajustes" },
  { id: "Verificado", label: "Verificadas" },
  { id: "Cerrado", label: "Cerradas" },
  { id: "", label: "Todas" },
];

export function SalidasPage() {
  const { catalogo } = useCatalogoSst();
  const [filtros, setFiltros] = useState({ estado: "Recibido", grupo: "", q: "", desde: "", hasta: "" });
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
      http
        .get("/salud/reportes-sst", { params })
        .then((res) => setDatos(res.data))
        .catch(() => setError("No fue posible cargar los reportes."));
    }, 250);
    return () => clearTimeout(t);
  }, [filtros]);

  const poner = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  async function exportar() {
    setDescargando(true);
    try {
      const { estado, ...resto } = filtros;
      const params = Object.fromEntries(Object.entries(resto).filter(([, v]) => v));
      await descargar("/salud/reportes-sst/exportar", params, "salidas-reportes-sst.xlsx");
    } catch {
      setError("No fue posible generar el Excel.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Salud integral"
        titulo="Salidas y reportes SST"
        descripcion="Salidas con estudiantes, en representación de la Institución, traslados de posgrados y condiciones inseguras. Verifica los documentos y registra la gestión ante la ARL o ASIST CARD."
        acciones={
          <>
            <Link to="/reportes-sst/nuevo" className={botonSecundario}>
              <Icono nombre="mas" size={16} strokeWidth={2.4} /> Reportar
            </Link>
            <button type="button" onClick={exportar} disabled={descargando} className={botonPrimario}>
              <Icono nombre="descarga" size={18} strokeWidth={2.2} /> {descargando ? "Generando…" : "Excel"}
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Aviso>{error}</Aviso>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" role="tablist">
        {PESTANAS.map((p) => {
          const activo = filtros.estado === p.id;
          const n = p.id ? datos?.conteos?.[p.id] : undefined;
          return (
            <button
              key={p.id || "todas"}
              role="tab"
              aria-selected={activo}
              onClick={() => setFiltros((f) => ({ ...f, estado: p.id }))}
              className={`whitespace-nowrap rounded-full px-4 min-h-[40px] text-sm font-bold inline-flex items-center gap-2 ${
                activo ? "bg-primary text-white" : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
              }`}
            >
              {p.label}
              {n !== undefined && (
                <span className={`text-xs rounded-full px-2 py-0.5 ${activo ? "bg-white/20" : "bg-gray-100"}`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5 flex-wrap items-end mb-5">
        <label className="relative flex-[1_1_240px]">
          <span className="sr-only">Buscar</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
            <Icono nombre="buscar" size={18} />
          </span>
          <input value={filtros.q} onChange={poner("q")} placeholder="Evento, destino, docente, cédula o correo" className={`${claseCampo} pl-10`} />
        </label>
        <select value={filtros.grupo} onChange={poner("grupo")} className={claseCampoCorto} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {catalogo && Object.entries(catalogo.grupos).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <label className="text-xs font-semibold text-ink-500 flex flex-col gap-1">
          Desde
          <input type="date" value={filtros.desde} onChange={poner("desde")} className={claseCampoCorto} />
        </label>
        <label className="text-xs font-semibold text-ink-500 flex flex-col gap-1">
          Hasta
          <input type="date" value={filtros.hasta} onChange={poner("hasta")} className={claseCampoCorto} />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-[22px] overflow-hidden">
        {datos?.reportes?.length === 0 && (
          <div className="p-5">
            <Vacio>No hay reportes con estos filtros.</Vacio>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            {datos?.reportes?.length > 0 && (
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-ink-500 bg-gray-50">
                  <th className="px-4 py-3 font-bold">Reporte</th>
                  <th className="px-4 py-3 font-bold">Fecha</th>
                  <th className="px-4 py-3 font-bold">Responsable / reporta</th>
                  <th className="px-4 py-3 font-bold">Documentos</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                </tr>
              </thead>
            )}
            <tbody>
              {datos?.reportes?.map((r) => {
                const estilo = ESTILO_GRUPO[r.grupo] || ESTILO_GRUPO.estudiantes;
                const fecha = r.fechaSalida || r.fechaEvento;
                const dias = diasPara(r.fechaSalida);
                return (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/70 align-top">
                    <td className="px-4 py-3.5">
                      <Link to={`/salud/salidas/${r.id}`} className="flex gap-3 items-start no-underline">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${estilo.color}`}>
                          <Icono nombre={estilo.icono} size={17} strokeWidth={2} />
                        </span>
                        <span className="min-w-0 leading-tight">
                          <span className="block font-bold text-primary max-w-[300px] truncate">{tituloDe(r)}</span>
                          <span className="block text-xs text-ink-500 mt-0.5">
                            <span className="font-mono">{r.codigo}</span> · {catalogo?.tipos.find((t) => t.id === r.tipo)?.corto} · {destinoDe(r)}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="block font-semibold text-ink-900">{fechaLarga(fecha)}</span>
                      <span className="block text-xs text-ink-500">
                        {hora12(r.horaSalida || r.horaEvento)}
                        {dias !== null && dias >= 0 && dias <= 7 && r.estado !== "Cerrado" && (
                          <span className="ml-1.5 font-bold text-[#B45309]">{dias === 0 ? "· hoy" : `· en ${dias} d`}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="block text-ink-900">{r.responsableNombre || r.afectado}</span>
                      <span className="block text-xs text-ink-500 truncate max-w-[220px]">
                        {r.nombreReporta} · {r.area}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.adjuntosFaltantes.length ? (
                        <Insignia tono="dorado">Faltan {r.adjuntosFaltantes.length}</Insignia>
                      ) : (
                        <span className="text-ink-600">{r.adjuntos.length} archivo(s)</span>
                      )}
                      {r.fueraDeTiempo && (
                        <span className="block mt-1">
                          <Insignia tono="rojo">Fuera de tiempo</Insignia>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Insignia tono={TONO_ESTADO[r.estado]}>{catalogo?.estados[r.estado]}</Insignia>
                      {r.gestion && r.gestionExterna && <span className="block text-xs text-[#0B6B61] font-semibold mt-1">✓ {r.gestion}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

// Detalle y revision de un reporte.
export function SalidaDetallePage() {
  const { id } = useParams();
  const { catalogo } = useCatalogoSst();
  const [reporte, setReporte] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    http
      .get(`/reportes-sst/${id}`)
      .then((res) => {
        setReporte(res.data.reporte);
        setObservacion(res.data.reporte.observacionRevision || "");
      })
      .catch((err) => setError(mensajeError(err, "No fue posible cargar el reporte.")));
  }, [id]);

  async function guardar(cambios, mensaje) {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const res = await http.patch(`/salud/reportes-sst/${id}`, cambios);
      setReporte(res.data.reporte);
      setAviso(mensaje);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la revisión."));
    } finally {
      setGuardando(false);
    }
  }

  if (!reporte || !catalogo) {
    return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9">{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  }

  const salida = reporte.tipo !== "CondicionInsegura";
  const etiquetaGestion = reporte.gestion === "ARL" ? "Salida reportada a la ARL" : "Certificado ASIST CARD gestionado";
  const celular = String(reporte.celular || "").replace(/\D/g, "");
  const whatsapp = celular ? `https://wa.me/${celular.length === 10 ? `57${celular}` : celular}` : null;
  const estado = reporte.estado;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <Link to="/salud/salidas" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Salidas y reportes
      </Link>
      <EncabezadoReporte reporte={reporte} catalogo={catalogo} />
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-[1fr_330px] items-start">
        <DetalleReporte reporte={{ ...reporte, observacionRevision: null }} catalogo={catalogo} />

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Tarjeta titulo="Revisión">
            <div className="flex flex-col gap-4">
              {salida && reporte.gestion && (
                <label className="flex gap-3 items-center text-sm font-semibold text-ink-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reporte.gestionExterna}
                    disabled={guardando}
                    onChange={(e) => guardar({ gestionExterna: e.target.checked }, e.target.checked ? `Marcado: ${etiquetaGestion.toLowerCase()}.` : "Gestión desmarcada.")}
                    className="w-5 h-5 accent-[#0d9488]"
                  />
                  {etiquetaGestion}
                </label>
              )}
              <Campo etiqueta="Observación para quien reporta" ayuda="Obligatoria al pedir ajustes. La persona la ve en «Mis reportes».">
                <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={4} maxLength={2000} className={`${claseCampo} py-3`} />
              </Campo>
              <div className="flex flex-col gap-2">
                {["Recibido", "RequiereAjustes"].includes(estado) && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => guardar({ estado: "Verificado", observacion }, salida ? "Salida verificada." : "Reporte verificado.")}
                    className={`${botonPrimario} w-full`}
                  >
                    <Icono nombre="check" size={18} strokeWidth={2.4} /> {salida ? "Verificar salida" : "Verificar reporte"}
                  </button>
                )}
                {estado !== "RequiereAjustes" && estado !== "Cerrado" && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => guardar({ estado: "RequiereAjustes", observacion }, "Se pidió a la persona que ajuste el reporte.")}
                    className={`${botonSecundario} w-full`}
                  >
                    Pedir ajustes
                  </button>
                )}
                {estado !== "Cerrado" ? (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => guardar({ estado: "Cerrado", observacion }, "Reporte cerrado.")}
                    className={`${botonSecundario} w-full`}
                  >
                    {salida ? "Cerrar (salida realizada)" : "Cerrar (riesgo controlado)"}
                  </button>
                ) : (
                  <button type="button" disabled={guardando} onClick={() => guardar({ estado: "Recibido" }, "Reporte reabierto.")} className={`${botonSecundario} w-full`}>
                    Reabrir
                  </button>
                )}
                {observacion !== (reporte.observacionRevision || "") && (
                  <button type="button" disabled={guardando} onClick={() => guardar({ observacion }, "Observación guardada.")} className="text-sm font-bold text-primary-soft py-1">
                    Guardar solo la observación
                  </button>
                )}
              </div>
              {reporte.revisadoPor && (
                <p className="m-0 text-xs text-ink-500">
                  Última revisión: {reporte.revisadoPor} · {new Date(reporte.fechaRevision).toLocaleString("es-CO")}
                </p>
              )}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Quien reporta">
            <p className="m-0 font-semibold text-ink-900">{reporte.nombreReporta}</p>
            <p className="m-0 text-sm text-ink-500">{reporte.area}</p>
            <div className="flex flex-col gap-1.5 mt-3 text-sm">
              <a href={`mailto:${reporte.correo}`} className="font-semibold text-primary-soft break-all">
                {reporte.correo}
              </a>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-[#0B6B61]">
                  WhatsApp · {reporte.celular}
                </a>
              )}
            </div>
            <p className="m-0 mt-3 text-xs text-ink-500">Reportado el {new Date(reporte.fechaCreacion).toLocaleString("es-CO")}</p>
          </Tarjeta>
        </aside>
      </div>
    </main>
  );
}
