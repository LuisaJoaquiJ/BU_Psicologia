import { useEffect, useRef, useState } from "react";
import { http } from "../lib/api/http";
import { Icono } from "./Iconos";
import { useAvisos } from "./avisos/Avisos";

// Registro fotografico del informe de gestion (Salud y Arte y Cultura): muestra las evidencias del
// periodo, deja subir fotos y soportes a una actividad y entran al informe (PDF y Excel) solas.
//   evidencias: [{ id, tipoMime, nombreArchivo, actividad, fecha, descripcion }]
//   destinos: [{ valor, etiqueta, grupo? }]  a que actividad se sube
//   rutaArchivo(e): ruta protegida del archivo
//   subir(destino, archivos, { descripcion, fecha }): sube los archivos (devuelve una promesa)
//   eliminar(e): opcional; borra una evidencia
//   editable: false cuando el informe ya se envio

const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const fechaCorta = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(".", "") : "");

// Foto protegida: se pide con la sesion y se muestra desde la memoria del navegador.
function useArchivo(ruta) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!ruta) return undefined;
    let activa = true;
    let objeto = null;
    http
      .get(ruta, { responseType: "blob" })
      .then((r) => {
        if (!activa) return;
        objeto = URL.createObjectURL(r.data);
        setUrl(objeto);
      })
      .catch(() => activa && setUrl(null));
    return () => {
      activa = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [ruta]);
  return url;
}

function Miniatura({ evidencia, ruta, alEliminar, alAbrir }) {
  const esImagen = evidencia.tipoMime?.startsWith("image/");
  const url = useArchivo(esImagen ? ruta : null);
  return (
    <li className="vidrio-panel rounded-2xl overflow-hidden flex flex-col">
      <button type="button" onClick={() => alAbrir(evidencia, ruta)} aria-label={`Ver ${evidencia.nombreArchivo}`} className="relative aspect-[4/3] bg-primary-light flex items-center justify-center">
        {esImagen && url ? (
          <img src={url} alt={evidencia.descripcion || evidencia.nombreArchivo} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-primary">
            <Icono nombre="archivo" size={28} strokeWidth={1.8} />
            <span className="text-xs font-bold">{esImagen ? "Cargando…" : "PDF"}</span>
          </span>
        )}
      </button>
      <div className="p-3 flex items-start gap-2 text-[13px]">
        <span className="min-w-0 flex-1">
          <strong className="block text-ink-900 truncate">{evidencia.actividad}</strong>
          <span className="block text-ink-500 truncate">
            {fechaCorta(evidencia.fecha)}
            {evidencia.descripcion ? ` · ${evidencia.descripcion}` : ""}
          </span>
        </span>
        {alEliminar && (
          <button type="button" onClick={() => alEliminar(evidencia)} aria-label={`Quitar ${evidencia.nombreArchivo}`} title="Quitar" className="w-9 h-9 -m-1.5 shrink-0 rounded-full inline-flex items-center justify-center text-red-700 hover:bg-red-50">
            <Icono nombre="cerrar" size={15} strokeWidth={2.4} />
          </button>
        )}
      </div>
    </li>
  );
}

function Visor({ visor, alCerrar }) {
  const url = useArchivo(visor.ruta);
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && alCerrar();
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [alCerrar]);
  const esImagen = visor.evidencia.tipoMime?.startsWith("image/");
  return (
    <div role="dialog" aria-label={visor.evidencia.nombreArchivo} className="fixed inset-0 z-[80] bg-black/80 p-4 flex flex-col items-center justify-center gap-3" onClick={alCerrar}>
      <div className="w-full max-w-4xl flex items-center justify-between gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="m-0 text-sm truncate">
          {visor.evidencia.actividad} · {visor.evidencia.nombreArchivo}
        </p>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 inline-flex items-center justify-center">
          <Icono nombre="cerrar" size={18} strokeWidth={2.4} />
        </button>
      </div>
      <div className="w-full max-w-4xl flex-1 min-h-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {!url && <p className="text-white/80">Cargando…</p>}
        {url && esImagen && <img src={url} alt={visor.evidencia.descripcion || ""} className="max-h-[80vh] max-w-full object-contain rounded-2xl bg-black" />}
        {url && !esImagen && <iframe title={visor.evidencia.nombreArchivo} src={url} className="w-full h-[80vh] rounded-2xl bg-white" />}
      </div>
    </div>
  );
}

// Una actividad con sus fotos y su propio boton para agregar.
function TarjetaActividad({ destino, evidencias, rutaArchivo, editable, subir, alCambiar, alAbrir, alQuitar }) {
  const avisos = useAvisos();
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  async function elegir(e) {
    const lista = [...e.target.files];
    e.target.value = "";
    const validos = lista.filter((f) => TIPOS.includes(f.type)).slice(0, 10);
    if (validos.length < lista.length) avisos.aviso("Se omitieron archivos que no son JPG, PNG, WEBP o PDF, o pasaban de 10.");
    if (!validos.length) return;
    setSubiendo(true);
    try {
      await subir(destino.valor, validos, {});
      avisos.exito(`Se subieron ${validos.length} ${validos.length === 1 ? "archivo" : "archivos"} a "${destino.etiqueta}".`);
      alCambiar?.();
    } catch (err) {
      avisos.error(err.response?.data?.message || "No fue posible subir las evidencias.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section className="vidrio-panel rounded-[22px] p-5 flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <h3 className="m-0 flex-1 min-w-0 text-base font-extrabold text-primary-dark">{destino.etiqueta}</h3>
        <span className="text-sm text-ink-500">{evidencias.length ? `${evidencias.length} ${evidencias.length === 1 ? "archivo" : "archivos"}` : "Sin evidencias"}</span>
        {editable && (
          <>
            <input ref={entrada} type="file" accept={TIPOS.join(",")} multiple onChange={elegir} className="sr-only" aria-label={`Agregar fotos o PDF a ${destino.etiqueta}`} />
            <button type="button" disabled={subiendo} onClick={() => entrada.current?.click()} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold inline-flex items-center gap-2 disabled:opacity-50">
              <Icono nombre="archivo" size={16} /> {subiendo ? "Subiendo…" : "Agregar fotos"}
            </button>
          </>
        )}
      </header>
      {evidencias.length > 0 && (
        <ul className="list-none m-0 p-0 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {evidencias.map((e) => (
            <Miniatura key={e.id} evidencia={e} ruta={rutaArchivo(e)} alAbrir={alAbrir} alEliminar={editable ? () => alQuitar(e) : null} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function EvidenciasInforme({ evidencias, destinos, destinoDe, rutaArchivo, subir, eliminar, editable, alCambiar, sinFotos = [], conDetalle = true }) {
  const avisos = useAvisos();
  const [destino, setDestino] = useState("");
  const [archivos, setArchivos] = useState([]);
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [visor, setVisor] = useState(null);
  const entrada = useRef(null);
  const grupos = [...new Set(destinos.map((d) => d.grupo || ""))];

  function elegir(e) {
    const lista = [...e.target.files];
    e.target.value = "";
    const validos = lista.filter((f) => TIPOS.includes(f.type));
    if (validos.length < lista.length) avisos.aviso("Algunos archivos no son fotos (JPG, PNG, WEBP) ni PDF y se omitieron.");
    setArchivos((a) => [...a, ...validos].slice(0, 10));
  }

  async function enviar(e) {
    e.preventDefault();
    if (!destino || !archivos.length) return;
    setSubiendo(true);
    try {
      await subir(destino, archivos, { descripcion, fecha });
      avisos.exito(`Se subieron ${archivos.length} ${archivos.length === 1 ? "archivo" : "archivos"} al informe.`);
      setArchivos([]);
      setDescripcion("");
      alCambiar?.();
    } catch (err) {
      avisos.error(err.response?.data?.message || "No fue posible subir las evidencias.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar(evidencia) {
    if (!window.confirm(`¿Quitar "${evidencia.descripcion || evidencia.nombreArchivo}" del registro fotográfico?`)) return;
    try {
      await eliminar(evidencia);
      avisos.exito("Se quitó la evidencia.");
      alCambiar?.();
    } catch (err) {
      avisos.error(err.response?.data?.message || "No fue posible quitar la evidencia.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="vidrio-panel rounded-[22px] p-5">
        <h2 className="m-0 text-lg font-extrabold text-primary-dark">Registro fotográfico y soportes</h2>
        <p className="mt-1 mb-0 text-sm text-ink-500 max-w-[62ch]">
          Las fotos y planillas de las actividades del periodo entran solas al informe (PDF y Excel). {evidencias.length ? `Hay ${evidencias.length} cargadas.` : "Todavía no hay ninguna."}
        </p>
        {sinFotos.length > 0 && (
          <p className="m-0 mt-3 text-sm rounded-xl bg-gold-light text-[#5C4206] px-4 py-3">
            <strong>Sin registro fotográfico:</strong> {sinFotos.join(", ")}.
          </p>
        )}
      </section>

      {destinoDe &&
        destinos.map((d) => (
          <TarjetaActividad
            key={d.valor}
            destino={d}
            evidencias={evidencias.filter((e) => destinoDe(e) === d.valor)}
            rutaArchivo={rutaArchivo}
            editable={editable && Boolean(eliminar)}
            subir={subir}
            alCambiar={alCambiar}
            alAbrir={(ev, ruta) => setVisor({ evidencia: ev, ruta })}
            alQuitar={quitar}
          />
        ))}

      {!destinoDe && editable && (
        <form onSubmit={enviar} className="vidrio-panel rounded-[22px] p-5 grid gap-3 sm:grid-cols-2">
          <h3 className="m-0 sm:col-span-2 text-base font-extrabold text-primary-dark">Agregar evidencias</h3>
          <label className="text-sm font-semibold sm:col-span-2">
            ¿De qué actividad son?
            <select required value={destino} onChange={(e) => setDestino(e.target.value)} className="w-full mt-1 border border-[#DCE3EE] rounded-xl px-3.5 min-h-[44px] text-[15px] bg-white/90">
              <option value="">Elige la actividad…</option>
              {grupos.map((g) =>
                g ? (
                  <optgroup key={g} label={g}>
                    {destinos.filter((d) => d.grupo === g).map((d) => (
                      <option key={d.valor} value={d.valor}>
                        {d.etiqueta}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  destinos.filter((d) => !d.grupo).map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.etiqueta}
                    </option>
                  ))
                )
              )}
            </select>
          </label>
          <div className="sm:col-span-2">
            <input ref={entrada} type="file" accept={TIPOS.join(",")} multiple onChange={elegir} className="sr-only" aria-label="Elegir fotos o PDF" />
            <button type="button" onClick={() => entrada.current?.click()} className="min-h-[44px] px-4 rounded-full burbuja text-primary-dark font-bold inline-flex items-center gap-2">
              <Icono nombre="archivo" size={16} /> Elegir fotos o PDF
            </button>
            <span className="ml-3 text-sm text-ink-500">JPG, PNG, WEBP o PDF · hasta 10 archivos de 5 MB</span>
            {archivos.length > 0 && (
              <ul className="list-none m-0 mt-3 p-0 flex flex-wrap gap-2">
                {archivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 border border-gray-200 pl-2.5 pr-1 py-1 text-[13px]">
                    <span className="max-w-[200px] truncate">{f.name}</span>
                    <button type="button" onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} className="w-7 h-7 rounded-full inline-flex items-center justify-center text-ink-500 hover:bg-red-50 hover:text-red-700">
                      <Icono nombre="cerrar" size={13} strokeWidth={2.6} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {conDetalle && (<>
          <label className="text-sm font-semibold">
            Descripción (opcional)
            <input maxLength={300} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué se ve en la foto" className="w-full mt-1 border border-[#DCE3EE] rounded-xl px-3.5 min-h-[44px] text-[15px] bg-white/90" />
          </label>
          <label className="text-sm font-semibold">
            Fecha de la evidencia (opcional)
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full mt-1 border border-[#DCE3EE] rounded-xl px-3.5 min-h-[44px] text-[15px] bg-white/90" />
          </label>
          </>)}
          <div className="sm:col-span-2">
            <button disabled={subiendo || !destino || !archivos.length} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold disabled:opacity-50">
              {subiendo ? "Subiendo…" : `Subir ${archivos.length || ""} ${archivos.length === 1 ? "archivo" : "archivos"}`.replace("  ", " ")}
            </button>
          </div>
        </form>
      )}

      {!destinoDe && evidencias.length > 0 && (
        <ul className="list-none m-0 p-0 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
          {evidencias.map((e) => (
            <Miniatura key={e.id} evidencia={e} ruta={rutaArchivo(e)} alAbrir={(ev, ruta) => setVisor({ evidencia: ev, ruta })} alEliminar={editable && eliminar ? () => quitar(e) : null} />
          ))}
        </ul>
      )}
      {visor && <Visor visor={visor} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
