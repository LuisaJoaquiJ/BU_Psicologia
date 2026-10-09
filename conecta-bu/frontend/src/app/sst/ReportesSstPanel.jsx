import { useEffect, useState } from "react";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Navbar } from "../../components/Navbar";
import { Icono } from "../../components/Iconos";
import { ESTILO_GRUPO, TONO_ESTADO, destinoDe, diasPara, fechaLarga, tituloDe, useCatalogoSst } from "../../lib/sst";
import { mensajeError } from "../../lib/salud";
import { Aviso, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario } from "../salud/ui";
import { DetalleReporte, EncabezadoReporte, SelectorDocumento } from "./DetalleReporte";
import { NuevoReportePage } from "./NuevoReportePage";
import { BandaInicio, botonBandaPrincipal, hoyLargo } from "../../components/ui";

// Salidas institucionales y reportes SST (/reportes-sst). Lo usa cualquier
// persona de la Institucion con su cuenta: reemplaza el formulario de Google
// "0 SALUD INTEGRAL".

function FilaReporte({ reporte, catalogo, a }) {
  const estilo = ESTILO_GRUPO[reporte.grupo] || ESTILO_GRUPO.estudiantes;
  const fecha = reporte.fechaSalida || reporte.fechaEvento;
  const dias = diasPara(reporte.fechaSalida);
  return (
    <li>
      <Link to={a} className="flex items-center gap-4 bg-white border border-gray-200 rounded-[20px] p-4 hover:border-primary-soft transition-colors">
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${estilo.color}`}>
          <Icono nombre={estilo.icono} size={22} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-ink-500">{reporte.codigo}</span>
            <Insignia tono={TONO_ESTADO[reporte.estado]}>{catalogo.estados[reporte.estado]}</Insignia>
            {reporte.adjuntosFaltantes.length > 0 && <Insignia tono="dorado">Faltan documentos</Insignia>}
          </span>
          <span className="block font-bold text-primary mt-1 truncate">{tituloDe(reporte)}</span>
          <span className="block text-sm text-ink-500 truncate">
            {reporte.tipoNombre} · {destinoDe(reporte)}
          </span>
        </span>
        <span className="hidden sm:flex flex-col items-end text-right shrink-0">
          <span className="text-sm font-semibold text-ink-900">{fechaLarga(fecha)}</span>
          {dias !== null && dias >= 0 && reporte.estado !== "Cerrado" && (
            <span className="text-xs text-ink-500">{dias === 0 ? "hoy" : `en ${dias} día(s)`}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function MisReportesPage({ catalogo }) {
  const [reportes, setReportes] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get("/reportes-sst/mios")
      .then((res) => setReportes(res.data.reportes))
      .catch(() => setError("No fue posible cargar tus reportes."));
  }, []);
  const ajustes = reportes?.filter((r) => r.estado === "RequiereAjustes") || [];

  return (
    <>
      <BandaInicio
        titulo="Salidas institucionales y reportes de seguridad"
        fecha={`${hoyLargo()} · ¡Cuidarnos es responsabilidad de todos!`}
        texto="Reporta tus salidas con estudiantes o en representación de la Institución, los traslados de posgrados y las condiciones inseguras."
        acciones={
          <Link to="/reportes-sst/nuevo" className={botonBandaPrincipal}>
            <Icono nombre="mas" size={18} strokeWidth={2.4} /> Nuevo reporte
          </Link>
        }
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary">Tus reportes</h2>
            <div className="flex gap-4 items-center">
              <span className="shrink-0 w-[76px] h-[68px] rounded-2xl bg-primary-light text-primary font-extrabold flex items-center justify-center tabular-nums text-[28px]">
                {reportes ? reportes.length : "…"}
              </span>
              <span className="min-w-0 text-ink-600">
                <strong className="block text-[17px] text-primary">{reportes?.length === 1 ? "Reporte enviado" : "Reportes enviados"}</strong>
                {ajustes.length > 0 ? `${ajustes.length} ${ajustes.length === 1 ? "necesita" : "necesitan"} ajustes` : "Ninguno necesita ajustes"}
              </span>
            </div>
          </>
        }
      />
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">

      {error && <Aviso>{error}</Aviso>}
      {ajustes.length > 0 && (
        <Aviso tono="dorado">
          <strong>{ajustes.length} reporte(s) necesitan ajustes.</strong> Ábrelos para ver qué pide la Unidad de Salud y adjuntar lo que falta.
        </Aviso>
      )}

      <Tarjeta titulo="Mis reportes" subtitulo={reportes ? `${reportes.length} en total` : "Cargando…"}>
        {reportes?.length === 0 && <Vacio>Aún no has hecho reportes. Cuando programes una salida, repórtala aquí con anticipación.</Vacio>}
        <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
          {reportes?.map((r) => (
            <FilaReporte key={r.id} reporte={r} catalogo={catalogo} a={`/reportes-sst/${r.id}`} />
          ))}
        </ul>
      </Tarjeta>
    </main>
    </>
  );
}

function MiReporteDetalle({ catalogo }) {
  const { id } = useParams();
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState("");
  const [archivos, setArchivos] = useState({});
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    http
      .get(`/reportes-sst/${id}`)
      .then((res) => setReporte(res.data.reporte))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar el reporte.")));
  }, [id]);

  async function subir() {
    const form = new FormData();
    for (const [tipo, lista] of Object.entries(archivos)) for (const f of lista) form.append(tipo, f);
    setSubiendo(true);
    setError("");
    try {
      const res = await http.post(`/reportes-sst/${id}/adjuntos`, form);
      setReporte(res.data.reporte);
      setArchivos({});
      setAviso("Documentos agregados. La Unidad de Salud los revisará.");
    } catch (err) {
      setError(mensajeError(err, "No fue posible subir los documentos."));
    } finally {
      setSubiendo(false);
    }
  }

  if (!reporte) {
    return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  }

  const def = catalogo.tipos.find((t) => t.id === reporte.tipo);
  const editable = ["Recibido", "RequiereAjustes"].includes(reporte.estado);
  // Todos los documentos que aplican (para reemplazar uno vencido, p. ej. el SOAT); primero los que faltan.
  const aplican = [...(def?.adjuntosBase || []), ...(catalogo.requeridosPorTransporte[reporte.medioTransporte] || []), ...(def?.adjuntosOpcionales || [])];
  const tipos = [...new Set([...reporte.adjuntosFaltantes, ...aplican])];
  const hayArchivos = Object.values(archivos).some((l) => l?.length);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <Link to="/reportes-sst" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Mis reportes
      </Link>
      <EncabezadoReporte reporte={reporte} catalogo={catalogo} />
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      <DetalleReporte reporte={reporte} catalogo={catalogo} />
      {editable && tipos.length > 0 && (
        <Tarjeta titulo="Agregar documentos" subtitulo="Completa lo que falta, reemplaza un documento vencido o adjunta el listado de participantes">
          <div className="flex flex-col gap-2.5">
            {tipos.map((t) => (
              <SelectorDocumento
                key={t}
                tipo={t}
                etiqueta={catalogo.adjuntos[t]}
                requerido={reporte.adjuntosFaltantes.includes(t)}
                multiple={t === "Evidencia"}
                archivos={archivos[t]}
                onCambio={(lista) => setArchivos((a) => ({ ...a, [t]: lista }))}
              />
            ))}
          </div>
          <button type="button" onClick={subir} disabled={!hayArchivos || subiendo} className={`${botonPrimario} mt-4`}>
            {subiendo ? "Subiendo…" : "Subir documentos"}
          </button>
        </Tarjeta>
      )}
    </main>
  );
}

export function ReportesSstPanel() {
  const { catalogo, error } = useCatalogoSst();
  return (
    <div>
      <Navbar modulo="sst" />
      {error && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {catalogo && (
        <Routes>
          <Route index element={<MisReportesPage catalogo={catalogo} />} />
          <Route path="nuevo" element={<NuevoReportePage catalogo={catalogo} />} />
          <Route path=":id" element={<MiReporteDetalle catalogo={catalogo} />} />
        </Routes>
      )}
    </div>
  );
}
