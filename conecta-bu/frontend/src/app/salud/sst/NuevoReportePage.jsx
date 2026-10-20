import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { Icono } from "../comunes/componentes/Iconos";
import { ESTILO_GRUPO, diasPara } from "../comunes/lib/sst";
import { mensajeError } from "../comunes/lib/salud";
import { Aviso, Campo, Tarjeta, botonPrimario, botonSecundario, claseCampo } from "../comunes/componentes/ui";
import { SelectorDocumento } from "./DetalleReporte";
import { CampoPersona } from "./CampoPersona";

const TEXTO_DOCUMENTO = { CC: "C.C.", CE: "C.E.", TI: "T.I." };

// Paso 1: que se va a reportar (las mismas opciones del formulario de Google).
function ElegirTipo({ catalogo, onElegir }) {
  const grupos = Object.entries(catalogo.grupos);
  return (
    <div className="flex flex-col gap-7">
      {grupos.map(([grupo, nombre]) => {
        const tipos = catalogo.tipos.filter((t) => t.grupo === grupo);
        const estilo = ESTILO_GRUPO[grupo];
        return (
          <section key={grupo}>
            <h2 className="m-0 mb-3 font-sans text-[13px] font-bold tracking-[0.12em] uppercase text-ink-500">{nombre}</h2>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
              {tipos.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onElegir(t.id)}
                  className="group text-left bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3.5 hover:border-primary-soft hover:shadow-[0_10px_26px_rgba(11,42,91,0.10)] transition-all"
                >
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${estilo.color}`}>
                    <Icono nombre={t.nivel === "Internacional" ? "avion" : estilo.icono} size={21} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-bold text-primary">{grupo === "riesgo" || grupo === "posgrados" ? t.corto : t.nivel}</span>
                    <span className="block text-xs text-ink-500 mt-1">
                      {t.anticipacion ? `Mínimo ${t.anticipacion} días antes` : grupo === "riesgo" ? "Reporte inmediato" : "Con póliza estudiantil"}
                    </span>
                  </span>
                  <span className="text-ink-500 group-hover:text-primary-soft">
                    <Icono nombre="derecha" size={18} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CampoDinamico({ def, valor, onCambio, catalogo }) {
  const requerido = def.obligatorio !== false;
  const comun = { id: `c-${def.campo}`, required: requerido, value: valor ?? "", onChange: (e) => onCambio(e.target.value) };
  switch (def.tipo) {
    case "parrafo":
      return <textarea {...comun} rows={4} maxLength={4000} className={`${claseCampo} py-3 min-h-[110px]`} />;
    case "fecha":
      return <input {...comun} type="date" className={claseCampo} />;
    case "hora":
      return <input {...comun} type="time" className={claseCampo} />;
    case "numero":
      return <input {...comun} type="number" min="0" max="5000" inputMode="numeric" className={claseCampo} />;
    case "documento":
      return <input {...comun} inputMode="numeric" maxLength={20} autoComplete="off" className={claseCampo} />;
    case "placa":
      return <input {...comun} maxLength={10} className={`${claseCampo} uppercase`} placeholder="ABC123" />;
    case "opciones":
      return (
        <div role="radiogroup" aria-labelledby={`l-${def.campo}`} className="flex gap-2 flex-wrap">
          {def.opciones.map((o) => {
            const activo = valor === o;
            const texto = def.campo === "clasificacion" ? catalogo.clasificaciones[o] : TEXTO_DOCUMENTO[o] || o;
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => onCambio(o)}
                className={`rounded-full px-4 min-h-[42px] text-sm font-bold border-[1.5px] transition-colors ${
                  activo ? "boton-liquido border-transparent" : "burbuja text-ink-600 hover:bg-white"
                }`}
              >
                {texto}
              </button>
            );
          })}
        </div>
      );
    default:
      return <input {...comun} maxLength={200} className={claseCampo} />;
  }
}

// Lista de otros participantes (reemplaza el "adjunte un listado").
function ListaPersonas({ etiqueta, valor = [], onCambio }) {
  const filas = valor.length ? valor : [];
  const cambiar = (i, campo, v) => onCambio(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-semibold text-ink-900">
          {etiqueta} <span className="text-ink-500 font-normal">(opcional)</span>
        </span>
        <button type="button" onClick={() => onCambio([...filas, { nombre: "", documento: "" }])} className={`${botonSecundario} min-h-[36px] text-[13px]`}>
          <Icono nombre="mas" size={15} strokeWidth={2.4} /> Agregar persona
        </button>
      </div>
      {filas.length === 0 ? (
        <p className="m-0 text-sm text-ink-500">
          Si viajan más personas, agrégalas aquí: escribe el nombre, elígelo de la lista y su cédula se llena sola. También puedes adjuntar un listado abajo.
        </p>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {filas.map((f, i) => (
            <li key={i} className="grid gap-2 grid-cols-[1fr_150px_auto] items-center">
              <CampoPersona
                ariaLabel={`Nombre completo de la persona ${i + 1}`}
                placeholder="Nombre completo"
                valor={f.nombre}
                required
                onCambio={(v) => cambiar(i, "nombre", v)}
                onElegir={(p) => onCambio(filas.map((x, j) => (j === i ? { nombre: p.nombre, documento: p.documento, documentoRef: p.documentoRef } : x)))}
              />
              <input
                aria-label={`Cédula de la persona ${i + 1}`}
                placeholder="Cédula"
                inputMode="numeric"
                value={f.documento}
                required
                onChange={(e) => cambiar(i, "documento", e.target.value)}
                className={claseCampo}
              />
              <button
                type="button"
                onClick={() => onCambio(filas.filter((_, j) => j !== i))}
                className="w-10 h-10 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                aria-label={`Quitar persona ${i + 1}`}
              >
                <Icono nombre="cerrar" size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Confirmacion({ reporte, onOtro }) {
  return (
    <div className="max-w-[640px] mx-auto text-center bg-white border border-gray-200 rounded-xl px-6 py-12">
      <span className="w-16 h-16 mx-auto rounded-full bg-[#E3F4F1] text-[#0B6B61] flex items-center justify-center">
        <Icono nombre="check" size={32} strokeWidth={2.6} />
      </span>
      <p className="m-0 mt-5 font-mono font-bold text-ink-500">{reporte.codigo}</p>
      <h1 className="m-0 mt-1 text-[30px] font-extrabold">¡Reporte enviado!</h1>
      <p className="mt-3 mb-0 text-ink-600 max-w-[460px] mx-auto">
        La Unidad de Salud integral revisará la información
        {reporte.gestion ? ` y gestionará el reporte ante ${reporte.gestion === "ARL" ? "la ARL" : "ASIST CARD"}` : ""}. Puedes seguir el estado en
        «Mis reportes».
      </p>
      {reporte.fueraDeTiempo && (
        <div className="mt-5 text-left">
          <Aviso tono="dorado">
            Este reporte se envió con menos anticipación de la requerida ({reporte.anticipacionMinima} días). La Unidad de Salud lo tendrá en
            cuenta, pero la gestión puede no alcanzar a completarse.
          </Aviso>
        </div>
      )}
      <div className="flex gap-2.5 justify-center flex-wrap mt-7">
        <Link to={`/reportes-sst/${reporte.id}`} className={botonPrimario}>
          Ver mi reporte
        </Link>
        <button type="button" onClick={onOtro} className={botonSecundario}>
          Hacer otro reporte
        </button>
      </div>
    </div>
  );
}

export function NuevoReportePage({ catalogo }) {
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const tipoId = params.get("tipo");
  const def = catalogo.tipos.find((t) => t.id === tipoId);
  const [datos, setDatos] = useState({ nombreReporta: usuario?.nombre || "" });
  const [archivos, setArchivos] = useState({});
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null);
  const arriba = useRef(null);

  const poner = (campo) => (v) => setDatos((d) => ({ ...d, [campo]: v }));
  const esSalida = def && def.grupo !== "riesgo";
  const medio = datos.medioTransporte;

  const documentos = useMemo(() => {
    if (!def) return [];
    const requeridos = [...def.adjuntosBase, ...(catalogo.requeridosPorTransporte[medio] || [])];
    return [
      ...requeridos.map((t) => ({ tipo: t, requerido: true })),
      ...def.adjuntosOpcionales.map((t) => ({ tipo: t, requerido: false, multiple: t === "Evidencia" })),
    ];
  }, [def, medio, catalogo]);

  const dias = esSalida ? diasPara(datos.fechaSalida) : null;
  const tarde = def?.anticipacion && dias !== null && dias < def.anticipacion;

  function elegir(id) {
    setParams({ tipo: id });
    setDatos((d) => ({ nombreReporta: d.nombreReporta, celular: d.celular, area: d.area }));
    setArchivos({});
    setError("");
    window.scrollTo({ top: 0 });
  }

  async function enviar(e) {
    e.preventDefault();
    setError("");
    for (const campo of def.campos) {
      if (campo.tipo === "opciones" && campo.obligatorio !== false && !datos[campo.campo]) {
        setError(`Elige: ${campo.label.toLowerCase()}.`);
        arriba.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    if (esSalida && !medio) return setError("Elige el medio de transporte.");
    const faltan = documentos.filter((d) => d.requerido && !archivos[d.tipo]?.length);
    if (faltan.length) {
      setError(`Adjunta: ${faltan.map((d) => catalogo.adjuntos[d.tipo].toLowerCase()).join(", ")}.`);
      return;
    }
    if (!datos.consentimientoDatos) return setError("Debes autorizar el tratamiento de tus datos personales.");

    const form = new FormData();
    const permitidos = new Set(documentos.map((d) => d.tipo));
    form.append("datos", JSON.stringify({ ...datos, tipo: def.id }));
    for (const [tipo, lista] of Object.entries(archivos)) {
      if (!permitidos.has(tipo)) continue;
      for (const f of lista) form.append(tipo, f);
    }
    setEnviando(true);
    try {
      const res = await http.post("/reportes-sst", form);
      setEnviado(res.data.reporte);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(mensajeError(err, "No fue posible enviar el reporte."));
      arriba.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="max-w-[1100px] mx-auto px-5 sm:px-8 pt-10 pb-16">
        <Confirmacion
          reporte={enviado}
          onOtro={() => {
            setEnviado(null);
            setParams({});
            setDatos({ nombreReporta: datos.nombreReporta, celular: datos.celular, area: datos.area });
            setArchivos({});
          }}
        />
      </main>
    );
  }

  return (
    <main className="max-w-[1100px] mx-auto px-5 sm:px-8 pt-9 pb-16" ref={arriba}>
      <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Salud integral · Prioriza tu salud y seguridad</p>
      <h1 className="m-0 text-3xl sm:text-[36px] font-extrabold">{def ? def.nombre : "¿Qué vas a reportar?"}</h1>
      {!def && (
        <p className="mt-2 mb-8 text-ink-500 max-w-[680px]">
          Reporta las salidas con estudiantes, las salidas en representación de la Institución, los traslados de docentes de posgrados y las
          condiciones inseguras. La Unidad de Salud verifica la información y la reporta a la ARL o gestiona ASIST CARD.
        </p>
      )}

      {!def ? (
        <ElegirTipo catalogo={catalogo} onElegir={elegir} />
      ) : (
        <form onSubmit={enviar} className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px] items-start">
          <div className="flex flex-col gap-5 min-w-0">
            <Aviso tono={def.grupo === "riesgo" ? "rojo" : "azul"}>{def.aviso}</Aviso>
            {error && (
              <div role="alert">
                <Aviso>{error}</Aviso>
              </div>
            )}

            <Tarjeta titulo="Tus datos" subtitulo="Quien diligencia el reporte">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Nombre completo">
                  <input required maxLength={200} value={datos.nombreReporta || ""} onChange={(e) => poner("nombreReporta")(e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Correo institucional">
                  <input value={usuario?.email || ""} readOnly className={`${claseCampo} bg-gray-50 text-ink-500`} />
                </Campo>
                <Campo etiqueta="Celular (WhatsApp)">
                  <input required inputMode="tel" maxLength={20} value={datos.celular || ""} onChange={(e) => poner("celular")(e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Área">
                  <select required value={datos.area || ""} onChange={(e) => poner("area")(e.target.value)} className={claseCampo}>
                    <option value="">Elige tu área</option>
                    {catalogo.areas.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Campo>
              </div>
            </Tarjeta>

            <Tarjeta titulo={esSalida ? "La salida" : "El evento"}>
              <div className="grid gap-4 sm:grid-cols-2">
                {def.campos.map((c) =>
                  c.tipo === "lista" ? (
                    <ListaPersonas key={c.campo} etiqueta={c.label} valor={datos.acompanantes} onCambio={poner("acompanantes")} />
                  ) : c.tipo === "opciones" ? (
                    // Un grupo de botones no va dentro de <label> (el clic en el texto elegiria la primera opcion).
                    <div key={c.campo} className="flex flex-col gap-1.5 text-sm font-semibold text-ink-600 sm:col-span-2">
                      <span id={`l-${c.campo}`}>{c.label}</span>
                      <CampoDinamico def={c} valor={datos[c.campo]} onCambio={poner(c.campo)} catalogo={catalogo} />
                    </div>
                  ) : (
                    <Campo
                      key={c.campo}
                      etiqueta={
                        <span id={`l-${c.campo}`}>
                          {c.label}
                          {c.obligatorio === false && <span className="text-ink-500 font-normal"> (opcional)</span>}
                        </span>
                      }
                      className={c.tipo === "parrafo" || ["evento", "motivo"].includes(c.campo) ? "sm:col-span-2" : ""}
                    >
                      {c.campo === "responsableNombre" ? (
                        <CampoPersona
                          id={`c-${c.campo}`}
                          required
                          valor={datos.responsableNombre}
                          onCambio={poner("responsableNombre")}
                          onElegir={(p) => {
                            const opciones = def.campos.find((x) => x.campo === "responsableTipoDoc")?.opciones || [];
                            setDatos((d) => ({
                              ...d,
                              responsableNombre: p.nombre,
                              responsableDocumento: p.documento,
                              responsableDocumentoRef: p.documentoRef,
                              responsableTipoDoc: opciones.includes(p.tipoDocumento) ? p.tipoDocumento : d.responsableTipoDoc,
                            }));
                          }}
                        />
                      ) : (
                        <CampoDinamico def={c} valor={datos[c.campo]} onCambio={poner(c.campo)} catalogo={catalogo} />
                      )}
                    </Campo>
                  )
                )}
              </div>
              {tarde && (
                <div className="mt-4">
                  <Aviso tono="dorado">
                    {dias < 0 ? "La fecha de salida ya pasó." : `Faltan ${dias} día(s) para la salida.`} Este tipo de salida se reporta con mínimo{" "}
                    {def.anticipacion} días de anticipación. Puedes enviarlo, pero quedará marcado como fuera de tiempo.
                  </Aviso>
                </div>
              )}
            </Tarjeta>

            {esSalida && (
              <Tarjeta titulo={def.etiquetaTransporte || "Medio de transporte"}>
                <div role="radiogroup" aria-label="Medio de transporte" className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
                  {def.transportes.map((t) => {
                    const activo = medio === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => poner("medioTransporte")(t)}
                        className={`rounded-2xl border-[1.5px] px-4 py-3.5 text-left flex items-center gap-2.5 font-bold text-sm transition-colors ${
                          activo ? "boton-liquido border-transparent" : "burbuja text-ink-600 hover:bg-white"
                        }`}
                      >
                        <Icono nombre={{ Aereo: "avion", Caminando: "persona", Particular: "carro" }[t] || "bus"} size={19} strokeWidth={2} />
                        {catalogo.transportes[t]}
                      </button>
                    );
                  })}
                </div>
                {medio && catalogo.camposTransporte[medio].length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    {catalogo.camposTransporte[medio].map((c) => (
                      <Campo key={c.campo} etiqueta={c.label}>
                        <CampoDinamico def={c} valor={datos[c.campo]} onCambio={poner(c.campo)} catalogo={catalogo} />
                      </Campo>
                    ))}
                  </div>
                )}
                {medio === "Particular" && (
                  <p className="mt-3 mb-0 text-sm text-ink-500">En vehículo particular se adjuntan la licencia, la tarjeta de propiedad, la revisión técnico-mecánica y el SOAT vigente.</p>
                )}
              </Tarjeta>
            )}

            <Tarjeta titulo={esSalida ? "Documentos" : "Evidencias fotográficas"} subtitulo="PDF o fotos, hasta 10 MB cada uno">
              <div className="flex flex-col gap-2.5">
                {documentos.map((d) => (
                  <SelectorDocumento
                    key={d.tipo}
                    tipo={d.tipo}
                    etiqueta={catalogo.adjuntos[d.tipo]}
                    requerido={d.requerido}
                    multiple={d.multiple}
                    archivos={archivos[d.tipo]}
                    onCambio={(lista) => setArchivos((a) => ({ ...a, [d.tipo]: lista }))}
                  />
                ))}
                {esSalida && !medio && <p className="m-0 text-sm text-ink-500">Elige el medio de transporte para ver qué documentos se necesitan.</p>}
              </div>
            </Tarjeta>
          </div>

          <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <button type="button" onClick={() => setParams({})} className="text-sm font-bold text-primary-soft inline-flex items-center gap-1">
                <Icono nombre="izquierda" size={16} /> Cambiar tipo de reporte
              </button>
              <label className="mt-5 flex gap-3 items-start text-sm text-ink-600 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(datos.consentimientoDatos)}
                  onChange={(e) => poner("consentimientoDatos")(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#0B2A5B] shrink-0"
                />
                <span>
                  Autorizo a la Institución a recolectar, almacenar, usar y procesar mis datos personales y los de las personas que reporto, conforme a la
                  Ley 1581 de 2012 y el Decreto 1377 de 2013.
                </span>
              </label>
              <button type="submit" disabled={enviando} className={`${botonPrimario} w-full mt-5`}>
                {enviando ? "Enviando…" : "Enviar reporte"}
              </button>
            </div>
            <p className="m-0 text-xs text-ink-500 px-2">
              Los documentos solo los ven tú y el personal de la Unidad de Salud integral.
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
