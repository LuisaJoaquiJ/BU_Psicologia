import { useCallback, useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { Icono } from "./comunes/componentes/Iconos";
import { moduloPorId } from "../../lib/modulos";
import { descargar, mensajeError } from "./comunes/lib/salud";
import { Aviso, Encabezado, Insignia, Vacio, botonPrimario, botonSecundario, claseCampo } from "./comunes/componentes/ui";

// Informes de gestion que envian los modulos (por ahora, Salud integral con
// el formato INFBI-002). El superadministrador los descarga en PDF o Excel y
// los aprueba o los devuelve con observaciones.

const PESTANAS = [
  { id: "Enviado", label: "Por revisar" },
  { id: "Devuelto", label: "Devueltos" },
  { id: "Aprobado", label: "Aprobados" },
  { id: "", label: "Todos" },
];
const TONO = { Enviado: "azul", Devuelto: "rojo", Aprobado: "verde" };
const TEXTO = { Enviado: "Por revisar", Devuelto: "Devuelto", Aprobado: "Aprobado" };
const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("es-CO"));
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "");

function TarjetaInforme({ informe, alCambiar }) {
  const [devolviendo, setDevolviendo] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const modulo = moduloPorId(informe.modulo);
  const nombre = `informe-gestion-${informe.modulo}-${informe.periodo}`;

  async function revisar(estado) {
    setOcupado(true);
    setError("");
    try {
      await http.patch(`/super/informes/${informe.id}`, { estado, observacion: observacion || undefined });
      setDevolviendo(false);
      alCambiar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la revisión."));
    } finally {
      setOcupado(false);
    }
  }

  const r = informe.resumen || {};
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start gap-4 flex-wrap">
        <span className="w-12 h-12 rounded-2xl bg-[#0d9488] text-white flex items-center justify-center shrink-0">
          <Icono nombre={modulo?.icono || "archivo"} size={24} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Insignia tono={TONO[informe.estado]}>{TEXTO[informe.estado]}</Insignia>
            <span className="text-xs font-bold text-ink-500">INFBI-002 · versión {informe.version}</span>
          </div>
          <h2 className="m-0 mt-1.5 text-xl font-extrabold">
            Informe de gestión {informe.periodo} · {modulo?.nombre || informe.modulo}
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-500">
            Enviado el {fechaHora(informe.fechaEnvio)} por {informe.enviadoPor}
            {informe.responsable ? ` · responsable: ${informe.responsable}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => descargar(`/super/informes/${informe.id}/archivo`, { formato: "pdf" }, `${nombre}.pdf`)} className={botonPrimario}>
            <Icono nombre="descarga" size={17} /> PDF
          </button>
          <button type="button" onClick={() => descargar(`/super/informes/${informe.id}/archivo`, { formato: "xlsx" }, `${nombre}.xlsx`)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        </div>
      </div>

      <dl className="m-0 grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          ["Atenciones", num(r.atenciones)],
          ["Personas atendidas", num(r.personas)],
          ["Actividades", num(r.actividades)],
          ["Cumplimiento de metas", r.cumplimientoPromedio === null || r.cumplimientoPromedio === undefined ? "—" : `${num(r.cumplimientoPromedio)} %`],
        ].map(([t, v]) => (
          <div key={t} className="bg-[#FBF7EE] rounded-2xl px-4 py-3">
            <dt className="text-xs text-ink-500">{t}</dt>
            <dd className="m-0 mt-0.5 font-display text-2xl font-semibold text-primary tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {informe.observacionRevision && (
        <Aviso tono={informe.estado === "Devuelto" ? "rojo" : "verde"}>
          <strong>Tu observación:</strong> {informe.observacionRevision}
        </Aviso>
      )}
      {error && <Aviso>{error}</Aviso>}

      {informe.estado === "Enviado" && !devolviendo && (
        <div className="flex gap-2.5 flex-wrap">
          <button type="button" disabled={ocupado} onClick={() => revisar("Aprobado")} className={botonPrimario}>
            <Icono nombre="check" size={17} strokeWidth={2.4} /> Aprobar
          </button>
          <button type="button" onClick={() => setDevolviendo(true)} className={botonSecundario}>
            Devolver con observaciones
          </button>
        </div>
      )}
      {devolviendo && (
        <div className="flex flex-col gap-2.5">
          <label className="text-sm font-semibold text-ink-600 flex flex-col gap-1.5">
            ¿Qué debe corregir el módulo?
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={3} maxLength={3000} className={`${claseCampo} py-3 font-normal`} />
          </label>
          <div className="flex gap-2.5">
            <button type="button" disabled={ocupado || !observacion.trim()} onClick={() => revisar("Devuelto")} className={botonPrimario}>
              Devolver informe
            </button>
            <button type="button" onClick={() => setDevolviendo(false)} className={botonSecundario}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function InformesPage() {
  const [estado, setEstado] = useState("Enviado");
  const [informes, setInformes] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    http
      .get("/super/informes", { params: estado ? { estado } : {} })
      .then((r) => setInformes(r.data.informes))
      .catch(() => setError("No fue posible cargar los informes."));
  }, [estado]);
  useEffect(() => {
    setInformes(null);
    cargar();
  }, [cargar]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Superadministrador"
        titulo="Informes de gestión"
        descripcion="Los informes que envían los módulos (formato INFBI-002): proyecto, evaluación, relación de atendidos, estadísticas con gráficas y registro fotográfico. Descárgalos en PDF o Excel, apruébalos o devuélvelos con observaciones."
      />
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5" role="tablist">
        {PESTANAS.map((p) => (
          <button
            key={p.id || "todos"}
            role="tab"
            aria-selected={estado === p.id}
            onClick={() => setEstado(p.id)}
            className={`whitespace-nowrap rounded-full px-4 min-h-[40px] text-sm font-bold ${
              estado === p.id ? "bg-primary text-white" : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {error && <Aviso>{error}</Aviso>}
      {informes?.length === 0 && <Vacio>No hay informes en esta bandeja.</Vacio>}
      <div className="flex flex-col gap-4">
        {informes?.map((i) => (
          <TarjetaInforme key={i.id} informe={i} alCambiar={cargar} />
        ))}
      </div>
    </main>
  );
}
