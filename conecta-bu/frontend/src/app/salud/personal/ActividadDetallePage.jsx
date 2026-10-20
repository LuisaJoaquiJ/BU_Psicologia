import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { POBLACION_TEXTO, fechaCorta, hoyISO, mensajeError, nombreCompleto, useArchivoProtegido, useCatalogos } from "../comunes/lib/salud";
import { FormularioActividad } from "./ActividadesPage";
import { Aviso, Campo, Insignia, Kpi, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";

function Miniatura({ evidencia, onAbrir, onEliminar }) {
  const esImagen = evidencia.tipoMime.startsWith("image/");
  const url = useArchivoProtegido(esImagen ? `/salud/evidencias/${evidencia.id}/archivo` : null);
  return (
    <figure className="group relative m-0 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
      <button type="button" onClick={() => onAbrir(evidencia)} className="relative aspect-[4/3] bg-primary-light flex items-center justify-center">
        {esImagen ? (
          url ? (
            <img src={url} alt={evidencia.descripcion || evidencia.nombreArchivo} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="absolute inset-0 animate-pulse bg-gray-100" />
          )
        ) : (
          <span className="flex flex-col items-center gap-1 text-primary-soft">
            <Icono nombre="archivo" size={36} />
            <span className="text-xs font-bold">PDF</span>
          </span>
        )}
      </button>
      <figcaption className="p-3 text-xs leading-snug">
        <strong className="block text-ink-900 truncate">{evidencia.descripcion || evidencia.nombreArchivo}</strong>
        <span className="text-ink-500">
          {fechaCorta(evidencia.fecha)}
          {evidencia.subidoPor?.nombre ? ` · ${evidencia.subidoPor.nombre}` : ""}
        </span>
      </figcaption>
      <button
        type="button"
        onClick={() => onEliminar(evidencia)}
        aria-label={`Eliminar ${evidencia.nombreArchivo}`}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow"
      >
        <Icono nombre="cerrar" size={16} strokeWidth={2.4} />
      </button>
    </figure>
  );
}

function Visor({ evidencia, onCerrar }) {
  const url = useArchivoProtegido(`/salud/evidencias/${evidencia.id}/archivo`);
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Evidencia" className="fixed inset-y-0 right-0 left-0 lg:left-[var(--menu,0px)] z-[60] bg-ink-900/85 flex items-center justify-center p-4" onClick={onCerrar}>
      <div className="max-w-5xl w-full max-h-full flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center text-white gap-3">
          <p className="m-0 text-sm truncate">{evidencia.descripcion || evidencia.nombreArchivo}</p>
          <div className="flex gap-2 shrink-0">
            {url && (
              <a href={url} download={evidencia.nombreArchivo} className="text-sm font-bold bg-white/15 rounded-full px-4 py-2 hover:bg-white/25">
                Descargar
              </a>
            )}
            <button type="button" onClick={onCerrar} className="text-sm font-bold bg-white/15 rounded-full px-4 py-2 hover:bg-white/25">
              Cerrar
            </button>
          </div>
        </div>
        {!url && <div className="h-[60vh] rounded-2xl bg-white/10 animate-pulse" />}
        {url && evidencia.tipoMime.startsWith("image/") && <img src={url} alt={evidencia.descripcion || ""} className="max-h-[80vh] object-contain rounded-2xl bg-black" />}
        {url && evidencia.tipoMime === "application/pdf" && <iframe title={evidencia.nombreArchivo} src={url} className="w-full h-[80vh] rounded-2xl bg-white" />}
      </div>
    </div>
  );
}

function SubirEvidencias({ actividadId, onSubidas }) {
  const [archivos, setArchivos] = useState([]);
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  const agregar = (lista) => {
    const validos = [...lista].filter((f) => /^image\/(jpeg|png|webp)$|^application\/pdf$/.test(f.type));
    if (validos.length < lista.length) setError("Algunos archivos no son fotos (JPG, PNG, WEBP) ni PDF y se omitieron.");
    setArchivos((a) => [...a, ...validos].slice(0, 10));
  };

  async function subir(e) {
    e.preventDefault();
    if (!archivos.length) return;
    setSubiendo(true);
    setError("");
    const datos = new FormData();
    archivos.forEach((f) => datos.append("archivos", f));
    datos.append("descripcion", descripcion);
    datos.append("fecha", fecha);
    try {
      await http.post(`/salud/actividades/${actividadId}/evidencias`, datos);
      setArchivos([]);
      setDescripcion("");
      onSubidas();
    } catch (err) {
      setError(mensajeError(err, "No fue posible subir las evidencias."));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form onSubmit={subir} className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${arrastrando ? "border-primary-soft bg-primary-light" : "border-gray-200 bg-gray-50"}`}
      >
        <span className="w-12 h-12 mx-auto rounded-2xl bg-white text-primary-soft flex items-center justify-center shadow-sm">
          <Icono nombre="imagen" size={24} />
        </span>
        <p className="m-0 mt-3 font-semibold text-ink-900">Arrastra aquí las fotos o planillas</p>
        <p className="m-0 mt-1 text-sm text-ink-500">JPG, PNG, WEBP o PDF · hasta 10 archivos de 10 MB</p>
        <button type="button" onClick={() => input.current?.click()} className={`${botonSecundario} mt-3`}>
          Elegir archivos
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => {
            agregar(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {archivos.length > 0 && (
        <>
          <ul className="list-none m-0 p-0 flex gap-2 flex-wrap">
            {archivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-xs font-semibold bg-primary-light text-primary rounded-full pl-3 pr-1 py-1">
                {f.name.length > 28 ? `${f.name.slice(0, 26)}…` : f.name}
                <button type="button" onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center">
                  <Icono nombre="cerrar" size={13} strokeWidth={2.4} />
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <Campo etiqueta="Descripción">
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} placeholder="Ej. Planilla de asistencia firmada" className={claseCampo} />
            </Campo>
            <Campo etiqueta="Fecha de la evidencia">
              <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
            </Campo>
          </div>
          <button type="submit" disabled={subiendo} className={`${botonPrimario} self-start`}>
            <Icono nombre="subir" size={18} strokeWidth={2.2} />
            {subiendo ? "Subiendo..." : `Subir ${archivos.length} archivo(s)`}
          </button>
        </>
      )}
      {error && <Aviso>{error}</Aviso>}
    </form>
  );
}

// Detalle de una actividad: indicadores, datos para SNIES/informe,
// evidencias (fotos y planillas) y lista de asistentes.
// Estudiantes inscritos desde Mi Salud: al marcar la asistencia queda
// registrada la atencion (su participacion).
function Inscritos({ actividad, onCambio }) {
  const [inscritos, setInscritos] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(null);

  const cargar = () =>
    http
      .get(`/salud/actividades/${actividad.id}/inscritos`)
      .then((r) => setInscritos(r.data.inscritos))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar los inscritos.")));
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividad.id]);

  async function marcar(ins, asistio) {
    setGuardando(ins.id);
    setError("");
    try {
      await http.patch(`/salud/actividades/${actividad.id}/inscritos/${ins.id}`, { asistio });
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la asistencia."));
    } finally {
      setGuardando(null);
    }
  }

  const asistieron = inscritos?.filter((i) => i.asistio).length || 0;
  return (
    <Tarjeta
      titulo="Estudiantes inscritos"
      subtitulo={
        inscritos
          ? `${inscritos.length}${actividad.cupos ? ` de ${actividad.cupos} cupos` : ""} · ${asistieron} con asistencia. Marca a quienes llegaron: queda en sus participaciones.`
          : "Cargando…"
      }
    >
      {error && <div className="mb-3"><Aviso>{error}</Aviso></div>}
      {inscritos && inscritos.length === 0 && <Vacio>Aún no hay estudiantes inscritos.</Vacio>}
      {inscritos && inscritos.length > 0 && (
        <ul className="m-0 p-0 list-none divide-y divide-gray-100">
          {inscritos.map((i) => (
            <li key={i.id} className="py-2.5 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-3 flex-1 min-w-[220px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={i.asistio}
                  disabled={guardando === i.id}
                  onChange={(e) => marcar(i, e.target.checked)}
                  className="w-5 h-5 accent-[#0d9488] shrink-0"
                  aria-label={`Asistió ${nombreCompleto(i.persona)}`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-900">{i.persona ? nombreCompleto(i.persona) : "Persona no encontrada"}</span>
                  <span className="block text-xs text-ink-500">
                    {i.persona?.tipoDocumento} {i.persona?.numeroDocumento}
                    {i.persona?.programa ? ` · ${i.persona.programa}` : ""}
                  </span>
                </span>
              </label>
              {i.asistio && <Insignia tono="verde">Asistió</Insignia>}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export function ActividadDetallePage() {
  const { id } = useParams();
  const catalogos = useCatalogos();
  const [actividad, setActividad] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [visor, setVisor] = useState(null);
  const [filtro, setFiltro] = useState("");

  function cargar() {
    return http
      .get(`/salud/actividades/${id}`)
      .then((res) => setActividad(res.data.actividad))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar la actividad.")));
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function eliminarEvidencia(e) {
    if (!window.confirm(`¿Eliminar la evidencia "${e.descripcion || e.nombreArchivo}"?`)) return;
    try {
      await http.delete(`/salud/evidencias/${e.id}`);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible eliminar la evidencia."));
    }
  }

  async function eliminarAtencion(a) {
    if (!window.confirm(`¿Eliminar el registro de ${nombreCompleto(a.persona)} del ${fechaCorta(a.fecha)}?`)) return;
    try {
      await http.delete(`/salud/atenciones/${a.id}`);
      cargar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible eliminar el registro."));
    }
  }

  async function cambiarActiva() {
    try {
      await http.patch(`/salud/actividades/${id}`, { activa: !actividad.activa });
      cargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  if (error && !actividad) return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9"><Aviso>{error}</Aviso></main>;
  if (!actividad) return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 text-ink-500">Cargando actividad...</main>;

  const ind = actividad.indicadores;
  const texto = filtro.trim().toLowerCase();
  const asistentes = actividad.atenciones.filter(
    (a) => !texto || `${nombreCompleto(a.persona)} ${a.persona?.numeroDocumento}`.toLowerCase().includes(texto)
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <div>
        <Link to="/salud/actividades" className="text-sm font-bold text-primary-soft">
          ← Actividades
        </Link>
        <div className="flex justify-between items-end gap-4 flex-wrap mt-3">
          <div className="min-w-0">
            <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">
              {catalogos?.categorias?.[actividad.categoria]} · Cód. SNIES {actividad.codigo} · {actividad.periodo}
            </p>
            <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">{actividad.nombre}</h1>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {actividad.permanente ? <Insignia tono="gris">Servicio permanente</Insignia> : <Insignia>Jornada</Insignia>}
              {actividad.clinica && <Insignia tono="verde">Atención de enfermería</Insignia>}
              {!actividad.activa && <Insignia tono="rojo">Inactiva</Insignia>}
              {actividad.publicada && <Insignia tono="verde">Publicada para estudiantes</Insignia>}
              <Insignia tono="gris">
                {fechaCorta(actividad.fechaInicio)} – {fechaCorta(actividad.fechaFin)}
              </Insignia>
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button type="button" onClick={() => setEditando((v) => !v)} className={botonSecundario}>
              <Icono nombre="editar" size={16} />
              {editando ? "Cerrar edición" : "Editar"}
            </button>
            <button type="button" onClick={cambiarActiva} className={botonSecundario}>
              {actividad.activa ? "Desactivar" : "Activar"}
            </button>
            <Link to={`/salud/registrar?actividad=${actividad.id}`} className={botonDorado}>
              Registrar asistentes
            </Link>
          </div>
        </div>
      </div>

      {error && <Aviso>{error}</Aviso>}

      {editando && (
        <Tarjeta titulo="Editar actividad">
          <FormularioActividad
            inicial={actividad}
            catalogos={catalogos}
            periodo={actividad.periodo}
            onCancelar={() => setEditando(false)}
            onGuardada={() => {
              setEditando(false);
              cargar();
            }}
          />
        </Tarjeta>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi destacado titulo="Asistentes / atenciones" valor={ind.asistentes} detalle={`${ind.personas} personas distintas`} />
        <Kpi
          titulo={actividad.permanente ? "En servicio" : "Jornadas realizadas"}
          valor={ind.meta ? `${ind.jornadas}/${ind.meta}` : ind.jornadas}
          detalle={ind.cumplimiento !== null ? `${ind.cumplimiento.toLocaleString("es-CO")} % de la meta` : "Sin meta definida"}
        />
        <Kpi titulo="Evidencias" valor={ind.evidencias} detalle={ind.evidencias ? "fotos y soportes" : "Sube fotos o planillas"} />
        <Kpi
          titulo="Última jornada"
          valor={ind.ultimaFecha ? new Date(`${ind.ultimaFecha}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }) : "—"}
          detalle={ind.ultimaFecha ? ind.ultimaFecha.slice(0, 4) : "Sin registros"}
        />
      </div>

      {(actividad.avances || actividad.dificultades || actividad.aprendizajes) && !editando && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Avances", actividad.avances],
            ["Dificultades", actividad.dificultades],
            ["Aprendizajes", actividad.aprendizajes],
          ]
            .filter(([, v]) => v)
            .map(([t, v]) => (
              <Tarjeta key={t} titulo={t}>
                <p className="m-0 text-sm text-ink-600 whitespace-pre-line">{v}</p>
              </Tarjeta>
            ))}
        </div>
      )}

      {actividad.publicada && <Inscritos actividad={actividad} onCambio={cargar} />}

      <Tarjeta titulo="Evidencias" subtitulo="Fotos de la jornada, planillas firmadas y actas. Salen en el registro fotográfico del informe de gestión.">
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <SubirEvidencias actividadId={actividad.id} onSubidas={cargar} />
          <div className="min-w-0">
            {actividad.evidencias.length === 0 ? (
              <Vacio>Aún no hay evidencias en esta actividad.</Vacio>
            ) : (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                {actividad.evidencias.map((e) => (
                  <Miniatura key={e.id} evidencia={e} onAbrir={setVisor} onEliminar={eliminarEvidencia} />
                ))}
              </div>
            )}
          </div>
        </div>
      </Tarjeta>

      <Tarjeta
        titulo={`Asistentes (${actividad.atenciones.length})`}
        acciones={
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre o documento" className={`${claseCampo.replace("w-full ", "")} w-full sm:w-[260px] min-h-[40px] text-sm`} aria-label="Buscar asistente" />
        }
      >
        {actividad.atenciones.length === 0 ? (
          <Vacio>Nadie registrado todavía.</Vacio>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-2 font-semibold">Fecha</th>
                  <th className="px-2 py-2 font-semibold">Persona</th>
                  <th className="px-2 py-2 font-semibold">Documento</th>
                  <th className="px-2 py-2 font-semibold">Población / programa</th>
                  <th className="px-2 py-2 font-semibold">Registró</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {asistentes.slice(0, 300).map((a) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-2 py-2.5 whitespace-nowrap">{fechaCorta(a.fecha)}</td>
                    <td className="px-2 py-2.5">
                      <Link to={`/salud/personas/${a.personaId}`} className="font-semibold text-ink-900 hover:text-primary-soft">
                        {nombreCompleto(a.persona)}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 tabular-nums">{a.persona?.numeroDocumento}</td>
                    <td className="px-2 py-2.5 text-ink-600">
                      {POBLACION_TEXTO[a.poblacion]}
                      {a.programa ? ` · ${a.programa}` : ""}
                    </td>
                    <td className="px-2 py-2.5 text-ink-500">{a.registradoPor?.nombre || (a.origen === "importado" ? "Excel" : "—")}</td>
                    <td className="px-2 py-2.5 text-right">
                      <button type="button" onClick={() => eliminarAtencion(a)} className="text-xs font-semibold text-ink-500 hover:text-red-700">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {asistentes.length > 300 && <p className="text-xs text-ink-500 px-2">Mostrando 300 de {asistentes.length}. Descarga el registro completo en Reportes.</p>}
          </div>
        )}
      </Tarjeta>

      {visor && <Visor evidencia={visor} onCerrar={() => setVisor(null)} />}
    </main>
  );
}
