import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { COLOR_POBLACION, descargar, mensajeError, useCatalogos } from "../../lib/salud";
import { Aviso, BarrasHorizontales, Campo, Insignia, Kpi, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "./ui";

// Informe de gestion (formato INFBI-002). El equipo de Salud lo prepara por
// periodo: textos del proyecto y la evaluacion, avances por actividad y
// cifras historicas; las estadisticas, la matriz de atendidos y el registro
// fotografico salen de lo registrado. Se envia al superadministrador, que lo
// descarga en PDF o Excel y lo aprueba o lo devuelve.

const PASOS = [
  { id: "proyecto", titulo: "Proyecto", icono: "archivo" },
  { id: "evaluacion", titulo: "Evaluación", icono: "estrella" },
  { id: "actividades", titulo: "Avances por actividad", icono: "lista" },
  { id: "cifras", titulo: "Cifras y años anteriores", icono: "grafica" },
  { id: "enviar", titulo: "Revisar y enviar", icono: "check" },
];

const ESTADO = {
  Borrador: { tono: "dorado", texto: "Borrador" },
  Enviado: { tono: "azul", texto: "Enviado al superadministrador" },
  Devuelto: { tono: "rojo", texto: "Devuelto para ajustes" },
  Aprobado: { tono: "verde", texto: "Aprobado" },
};

const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("es-CO"));
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "");

function AreaTexto({ valor, onCambio, filas = 6, deshabilitado, placeholder }) {
  return (
    <textarea
      value={valor || ""}
      onChange={(e) => onCambio(e.target.value)}
      rows={filas}
      disabled={deshabilitado}
      placeholder={placeholder}
      className={`${claseCampo} py-3 leading-relaxed font-normal disabled:bg-gray-50 disabled:text-ink-600`}
    />
  );
}

function PasoProyecto({ datos, poner, editable }) {
  const objetivos = datos.objetivos || [];
  const cambiarObjetivo = (i, campo, v) => poner("objetivos")(objetivos.map((o, j) => (j === i ? { ...o, [campo]: v } : o)));
  return (
    <div className="flex flex-col gap-5">
      <Tarjeta titulo="Datos del proyecto" subtitulo="Encabezado del formato INFBI-002">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Responsable del proyecto">
            <input value={datos.responsable || ""} disabled={!editable} onChange={(e) => poner("responsable")(e.target.value)} maxLength={200} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Fecha de presentación">
            <input
              type="date"
              value={String(datos.fechaPresentacion || "").slice(0, 10)}
              disabled={!editable}
              onChange={(e) => poner("fechaPresentacion")(e.target.value)}
              className={claseCampo}
            />
          </Campo>
        </div>
        <fieldset className="mt-4 border-0 p-0 m-0">
          <legend className="text-sm font-semibold text-ink-600 mb-2">Tipo de acción</legend>
          <div className="flex gap-2.5 flex-wrap">
            {[
              ["accionMejora", "Mejora continua"],
              ["accionCorrectiva", "Correctivo"],
              ["accionPreventiva", "Preventivo"],
            ].map(([k, t]) => (
              <label key={k} className={`flex items-center gap-2 border-[1.5px] rounded-full px-4 min-h-[42px] text-sm font-bold cursor-pointer ${datos[k] ? "border-primary bg-primary-light text-primary" : "border-gray-200 text-ink-600"}`}>
                <input type="checkbox" checked={Boolean(datos[k])} disabled={!editable} onChange={(e) => poner(k)(e.target.checked)} className="w-4 h-4 accent-[#0B2A5B]" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
      </Tarjeta>
      {[
        ["descripcion", "Descripción del proyecto"],
        ["justificacion", "Justificación del proyecto"],
        ["alineacion", "Alineación estratégica"],
      ].map(([k, t]) => (
        <Tarjeta key={k} titulo={t}>
          <AreaTexto valor={datos[k]} onCambio={poner(k)} deshabilitado={!editable} filas={k === "alineacion" ? 3 : 7} />
        </Tarjeta>
      ))}
      <Tarjeta
        titulo="Objetivos, resultados y beneficios esperados"
        acciones={
          editable && (
            <button type="button" onClick={() => poner("objetivos")([...objetivos, { objetivo: "", resultado: "", beneficio: "" }])} className={`${botonSecundario} min-h-[38px]`}>
              <Icono nombre="mas" size={15} strokeWidth={2.4} /> Agregar objetivo
            </button>
          )
        }
      >
        {objetivos.length === 0 && <Vacio>Agrega al menos un objetivo.</Vacio>}
        <ol className="list-none m-0 p-0 flex flex-col gap-4">
          {objetivos.map((o, i) => (
            <li key={i} className="border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-primary">Objetivo {i + 1}</span>
                {editable && (
                  <button type="button" onClick={() => poner("objetivos")(objetivos.filter((_, j) => j !== i))} className="text-sm font-bold text-ink-500 hover:text-red-600">
                    Quitar
                  </button>
                )}
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {[
                  ["objetivo", "Objetivo"],
                  ["resultado", "Resultados"],
                  ["beneficio", "Beneficios esperados"],
                ].map(([k, t]) => (
                  <Campo key={k} etiqueta={t}>
                    <AreaTexto valor={o[k]} onCambio={(v) => cambiarObjetivo(i, k, v)} deshabilitado={!editable} filas={6} />
                  </Campo>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Tarjeta>
    </div>
  );
}

function PasoEvaluacion({ datos, poner, editable, cifras }) {
  const k = cifras.kpis;
  const resumen = `En el periodo ${cifras.periodo} se registraron ${num(k.atenciones)} atenciones a ${num(k.personas)} personas en ${num(k.actividades)} actividades (${num(
    k.jornadas
  )} jornadas)${k.cumplimientoPromedio !== null ? `, con un cumplimiento promedio de metas del ${num(k.cumplimientoPromedio)} %` : ""}. El servicio de enfermería realizó ${num(k.enfermeria)} atenciones.`;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px] items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <Tarjeta
          titulo="Logros significativos"
          acciones={
            editable && (
              <button type="button" onClick={() => poner("logros")(`${datos.logros ? `${datos.logros}\n\n` : ""}${resumen}`)} className={`${botonSecundario} min-h-[38px]`}>
                <Icono nombre="grafica" size={15} /> Insertar cifras del periodo
              </button>
            )
          }
        >
          <AreaTexto valor={datos.logros} onCambio={poner("logros")} deshabilitado={!editable} filas={8} placeholder="¿Qué se logró en el periodo? Campañas destacadas, población alcanzada, alianzas…" />
        </Tarjeta>
        <Tarjeta titulo="Dificultades presentadas">
          <AreaTexto valor={datos.dificultades} onCambio={poner("dificultades")} deshabilitado={!editable} filas={7} />
        </Tarjeta>
        <Tarjeta titulo="Acciones de mejora">
          <AreaTexto valor={datos.accionesMejora} onCambio={poner("accionesMejora")} deshabilitado={!editable} filas={7} />
        </Tarjeta>
      </div>
      <aside className="lg:sticky lg:top-6 flex flex-col gap-3">
        <Kpi destacado titulo={`Atenciones ${cifras.periodo}`} valor={num(k.atenciones)} detalle={cifras.comparacion ? `${num(cifras.comparacion.total)} en ${cifras.comparacion.periodo}` : null} />
        <Kpi titulo="Personas atendidas" valor={num(k.personas)} />
        <Kpi titulo="Cumplimiento promedio" valor={k.cumplimientoPromedio === null ? "—" : `${num(k.cumplimientoPromedio)} %`} detalle={`${k.metasCumplidas} de ${k.actividadesConMeta} metas en 90 % o más`} />
      </aside>
    </div>
  );
}

function EditorActividad({ actividad, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [valores, setValores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setValores({
      avances: actividad.avances || "",
      dificultades: actividad.dificultades || "",
      aprendizajes: actividad.aprendizajes || "",
      pendientes: actividad.pendientes || "",
      observaciones: actividad.observaciones || "",
      presupuesto: actividad.presupuesto ?? "",
    });
  }, [actividad]);
  const tono = { verde: "verde", amarillo: "dorado", rojo: "rojo" }[actividad.semaforo] || "gris";

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await http.patch(`/salud/actividades/${actividad.id}`, { ...valores, presupuesto: valores.presupuesto === "" ? null : Number(valores.presupuesto) });
      setAbierto(false);
      alGuardar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className="border border-gray-200 rounded-2xl">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="w-full text-left flex items-center gap-3 p-4" aria-expanded={abierto}>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-primary truncate">{actividad.nombre}</span>
          <span className="block text-xs text-ink-500">
            {actividad.categoria} · {num(actividad.atenciones)} atenciones · meta {num(actividad.meta)} · logro {num(actividad.logro)}
          </span>
        </span>
        {!String(actividad.avances || "").trim() && <Insignia tono="dorado">Sin avances</Insignia>}
        <Insignia tono={tono}>{actividad.cumplimiento === null ? "Sin meta" : `${num(actividad.cumplimiento)} %`}</Insignia>
        <span className={`transition-transform ${abierto ? "rotate-90" : ""}`}>
          <Icono nombre="derecha" size={18} />
        </span>
      </button>
      {abierto && (
        <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2">
          {[
            ["avances", "Avances"],
            ["dificultades", "Dificultades"],
            ["aprendizajes", "Aprendizajes"],
            ["pendientes", "Pendientes"],
            ["observaciones", "Observaciones"],
          ].map(([k, t]) => (
            <Campo key={k} etiqueta={t}>
              <AreaTexto valor={valores[k]} onCambio={(v) => setValores((x) => ({ ...x, [k]: v }))} filas={4} />
            </Campo>
          ))}
          <Campo etiqueta="Presupuesto ejecutado (pesos)">
            <input type="number" min="0" value={valores.presupuesto} onChange={(e) => setValores((x) => ({ ...x, presupuesto: e.target.value }))} className={claseCampo} />
          </Campo>
          {error && (
            <div className="sm:col-span-2">
              <Aviso>{error}</Aviso>
            </div>
          )}
          <div className="sm:col-span-2 flex gap-2.5">
            <button type="button" disabled={guardando} onClick={guardar} className={botonPrimario}>
              {guardando ? "Guardando…" : "Guardar actividad"}
            </button>
            <Link to={`/salud/actividades/${actividad.id}`} className={botonSecundario}>
              Ver actividad y evidencias
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

function PasoActividades({ cifras, recargar }) {
  return (
    <Tarjeta
      titulo="Avances, dificultades y aprendizajes por actividad"
      subtitulo="Van en la matriz de atendidos (hoja ATENDIDOS) y en el PDF. Se guardan en cada actividad, así que también sirven para el siguiente informe."
    >
      {cifras.actividades.length === 0 && <Vacio>No hay actividades con atenciones en este periodo.</Vacio>}
      <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
        {cifras.actividades.map((a) => (
          <EditorActividad key={a.id} actividad={a} alGuardar={recargar} />
        ))}
      </ul>
    </Tarjeta>
  );
}

const CAMPOS_HISTORICO = [
  ["estudiantes", "Estudiantes"],
  ["docentes", "Docentes"],
  ["administrativos", "Administrativos"],
  ["externos", "Externos"],
  ["egresados", "Egresados"],
  ["enfermeria", "Enfermería"],
  ["poblacionGeneral", "Población general"],
];

function Historicos({ alGuardar }) {
  const [filas, setFilas] = useState(null);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    http.get("/salud/informes/historicos").then((r) => setFilas(r.data.historicos));
  }, []);
  const cambiar = (i, k, v) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  async function guardar() {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const r = await http.put("/salud/informes/historicos", { historicos: filas });
      setFilas(r.data.historicos);
      setAviso("Cifras históricas guardadas.");
      alGuardar();
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Tarjeta
      titulo="Cifras de años anteriores"
      subtitulo="Las del informe de gestión de cada año (hoja ESTADÍSTICAS). Se usan para las gráficas comparativas; los periodos registrados en Conecta BU se calculan solos. Enfermería y población general son opcionales."
      acciones={
        <button type="button" onClick={() => setFilas((fs) => [...(fs || []), { periodo: "", estudiantes: 0, docentes: 0, administrativos: 0, externos: 0, egresados: 0, enfermeria: "", poblacionGeneral: "" }])} className={`${botonSecundario} min-h-[38px]`}>
          <Icono nombre="mas" size={15} strokeWidth={2.4} /> Agregar año
        </button>
      }
    >
      {!filas ? (
        <p className="text-ink-500">Cargando…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.05em] text-ink-500 bg-gray-50">
                  <th className="px-2 py-2.5 font-bold">Año / periodo</th>
                  {CAMPOS_HISTORICO.map(([k, t]) => (
                    <th key={k} className="px-2 py-2.5 font-bold text-right">
                      {t}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-1.5 py-1.5">
                      <input aria-label="Año o periodo" value={f.periodo} onChange={(e) => cambiar(i, "periodo", e.target.value)} placeholder="2025" className={`${claseCampo} min-h-[38px] w-[92px] px-2.5`} />
                    </td>
                    {CAMPOS_HISTORICO.map(([k, t]) => (
                      <td key={k} className="px-1.5 py-1.5">
                        <input
                          aria-label={`${t} ${f.periodo}`}
                          type="number"
                          min="0"
                          value={f[k] ?? ""}
                          onChange={(e) => cambiar(i, k, e.target.value)}
                          className={`${claseCampo} min-h-[38px] px-2 min-w-[84px] text-right tabular-nums`}
                        />
                      </td>
                    ))}
                    <td>
                      <button type="button" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))} className="w-9 h-9 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center" aria-label={`Quitar ${f.periodo}`}>
                        <Icono nombre="cerrar" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <div className="mt-3">
              <Aviso>{error}</Aviso>
            </div>
          )}
          {aviso && (
            <div className="mt-3">
              <Aviso tono="verde">{aviso}</Aviso>
            </div>
          )}
          <button type="button" onClick={guardar} disabled={guardando} className={`${botonPrimario} mt-4`}>
            {guardando ? "Guardando…" : "Guardar cifras históricas"}
          </button>
        </>
      )}
    </Tarjeta>
  );
}

function ColumnasComparativas({ filas }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <div>
      <div className="flex items-end gap-2 h-[170px]" role="img" aria-label="Población atendida por periodo">
        {filas.map((f) => (
          <div key={f.periodo} title={`${f.periodo}: ${num(f.total)} personas atendidas`} className="flex-1 h-full flex flex-col justify-end items-center group relative min-w-0">
            <span className={`text-[10px] font-bold text-ink-600 mb-1 tabular-nums whitespace-nowrap ${filas.length > 10 ? "hidden sm:block" : ""}`}>{num(f.total)}</span>
            <div className={`w-full max-w-[38px] rounded-t-md ${f.fuente === "conecta" ? "bg-gold" : "bg-primary-soft"}`} style={{ height: `${Math.max(3, (f.total / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1.5">
        {filas.map((f) => (
          <span key={f.periodo} className="flex-1 text-center text-[10px] sm:text-[11px] text-ink-500 whitespace-nowrap overflow-hidden">
            {f.periodo}
          </span>
        ))}
      </div>
      <p className="m-0 mt-3 text-xs text-ink-500 flex gap-4 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary-soft" /> Informes de años anteriores
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gold" /> Registrado en Conecta BU
        </span>
      </p>
    </div>
  );
}

function PasoCifras({ cifras, recargar }) {
  const k = cifras.kpis;
  const total = k.atenciones;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi destacado titulo="Atenciones" valor={num(k.atenciones)} />
        <Kpi titulo="Personas atendidas" valor={num(k.personas)} />
        <Kpi titulo="Actividades" valor={num(k.actividades)} detalle={`${num(k.jornadas)} jornadas`} />
        <Kpi titulo="Enfermería" valor={num(k.enfermeria)} detalle={`${num(k.remisiones)} remisiones`} />
        <Kpi titulo="Registro fotográfico" valor={num(k.evidencias)} />
      </div>
      <Tarjeta titulo="Población atendida por periodo" subtitulo="Impacto poblacional frente a años anteriores (pasa el mouse sobre una barra para ver el detalle)">
        <ColumnasComparativas filas={cifras.impacto} />
      </Tarjeta>
      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo={`Población atendida ${cifras.periodo}`}>
          <BarrasHorizontales
            datos={cifras.porPoblacion.map((p) => ({ nombre: p.nombre, total: p.total, color: COLOR_POBLACION[p.clave] }))}
            formato={(v) => `${v} · ${total ? Math.round((v / total) * 100) : 0} %`}
          />
        </Tarjeta>
        <Tarjeta titulo={`Asistencia población objeto ${cifras.periodo}`}>
          <BarrasHorizontales datos={cifras.asistenciaObjeto.filter((a) => a.total > 0)} />
        </Tarjeta>
      </div>
      <Historicos alGuardar={recargar} />
    </div>
  );
}

function PasoEnviar({ informe, revision, onEnviar, enviando, periodo, sucio }) {
  const [confirmar, setConfirmar] = useState(false);
  const editable = informe.editable;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
      <div className="flex flex-col gap-5">
        <Tarjeta titulo="Lo que falta para enviar">
          {revision.faltantes.length === 0 ? (
            <Aviso tono="verde">Todos los campos obligatorios están completos.</Aviso>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {revision.faltantes.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Icono nombre="cerrar" size={13} strokeWidth={2.6} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo="Para revisar" subtitulo="No impiden el envío, pero mejoran el informe.">
          {revision.avisos.length === 0 && <Vacio>Sin observaciones.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {revision.avisos.map((a) => (
              <li key={a.tipo}>
                <Aviso tono="dorado">
                  <strong>{a.texto}.</strong>
                  {a.actividades.length > 0 && <span className="block mt-1 text-[13px]">{a.actividades.slice(0, 8).join(" · ")}{a.actividades.length > 8 ? " …" : ""}</span>}
                </Aviso>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <aside className="bg-white border border-gray-200 rounded-[22px] p-5 flex flex-col gap-3 lg:sticky lg:top-6">
        <p className="m-0 font-bold text-primary">Enviar al superadministrador</p>
        <p className="m-0 text-sm text-ink-600">
          Al enviarlo se guarda una copia de las cifras de hoy: el superadministrador recibe exactamente lo que ves en la vista previa y lo descarga en PDF o Excel.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => descargar(`/salud/informes/${periodo}/archivo`, { formato: "pdf" }, `informe-gestion-${periodo}.pdf`)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Vista previa PDF
          </button>
          <button type="button" onClick={() => descargar(`/salud/informes/${periodo}/archivo`, { formato: "xlsx" }, `informe-gestion-${periodo}.xlsx`)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        </div>
        {editable && !confirmar && (
          <button type="button" disabled={!revision.listo || sucio} onClick={() => setConfirmar(true)} className={`${botonDorado} w-full`}>
            <Icono nombre="subir" size={18} /> Enviar informe {informe.estado === "Devuelto" ? "corregido" : ""}
          </button>
        )}
        {sucio && editable && <p className="m-0 text-xs text-[#B45309]">Guarda los cambios antes de enviar.</p>}
        {confirmar && (
          <div className="border border-gold rounded-2xl p-4 bg-gold-light">
            <p className="m-0 text-sm font-semibold text-[#5C4206]">¿Enviar el informe {periodo}? Después no se puede editar, salvo que el superadministrador lo devuelva.</p>
            <div className="flex gap-2 mt-3">
              <button type="button" disabled={enviando} onClick={onEnviar} className={botonPrimario}>
                {enviando ? "Enviando…" : "Sí, enviar"}
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className={botonSecundario}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {!editable && <Aviso tono="azul">Este informe ya fue enviado. Si el superadministrador lo devuelve, podrás corregirlo y enviarlo de nuevo.</Aviso>}
      </aside>
    </div>
  );
}

export function InformeGestionPage() {
  const catalogos = useCatalogos();
  const [periodo, setPeriodo] = useState("");
  const [paso, setPaso] = useState("proyecto");
  const [respuesta, setRespuesta] = useState(null);
  const [datos, setDatos] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (catalogos && !periodo) setPeriodo(catalogos.periodoActual);
  }, [catalogos, periodo]);

  const cargar = useCallback(
    (conservarTextos = false) => {
      if (!periodo) return;
      http
        .get(`/salud/informes/${periodo}`)
        .then((r) => {
          setRespuesta(r.data);
          if (!conservarTextos) {
            setDatos(r.data.informe);
            setSucio(false);
          }
        })
        .catch((err) => setError(mensajeError(err, "No fue posible cargar el informe.")));
    },
    [periodo]
  );
  useEffect(() => {
    setRespuesta(null);
    cargar();
  }, [cargar]);

  const periodos = useMemo(() => {
    const lista = new Set([...(catalogos?.periodos || []), catalogos?.periodoActual].filter(Boolean));
    return [...lista].sort().reverse();
  }, [catalogos]);

  const poner = (campo) => (valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setSucio(true);
  };

  async function guardar() {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const r = await http.put(`/salud/informes/${periodo}`, datos);
      setRespuesta(r.data);
      setDatos(r.data.informe);
      setSucio(false);
      setAviso("Borrador guardado.");
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    } finally {
      setGuardando(false);
    }
  }

  async function enviar() {
    setEnviando(true);
    setError("");
    try {
      const r = await http.post(`/salud/informes/${periodo}/enviar`);
      setRespuesta(r.data);
      setDatos(r.data.informe);
      setAviso("Informe enviado al superadministrador.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(mensajeError(err, "No fue posible enviar el informe."));
    } finally {
      setEnviando(false);
    }
  }

  const informe = respuesta?.informe;
  const estado = ESTADO[informe?.estado] || ESTADO.Borrador;
  const editable = informe?.editable;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Salud integral · Formato INFBI-002</p>
          <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">Informe de gestión</h1>
          <p className="mt-1.5 mb-0 text-ink-500 max-w-[640px]">
            Proyecto, evaluación, relación de atendidos, estadísticas con gráficas y registro fotográfico. Se envía al superadministrador, que lo descarga
            en PDF o Excel.
          </p>
        </div>
        <div className="flex gap-2.5 items-end flex-wrap">
          <label className="text-xs font-semibold text-ink-500 flex flex-col gap-1">
            Periodo
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={claseCampoCorto}>
              {periodos.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!periodo} onClick={() => descargar(`/salud/informes/${periodo}/archivo`, { formato: "pdf" }, `informe-gestion-${periodo}.pdf`)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> PDF
          </button>
          <button type="button" disabled={!periodo} onClick={() => descargar(`/salud/informes/${periodo}/archivo`, { formato: "xlsx" }, `informe-gestion-${periodo}.xlsx`)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        </div>
      </div>

      {informe && (
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Insignia tono={estado.tono} className="text-[13px] px-3 py-1.5">
            {estado.texto}
            {informe.version > 0 ? ` · versión ${informe.version}` : ""}
          </Insignia>
          {informe.fechaEnvio && <span className="text-sm text-ink-500">Enviado el {fechaHora(informe.fechaEnvio)} por {informe.enviadoPor}</span>}
          {informe.estado === "Borrador" && informe.copiadoDe && (
            <span className="text-sm text-ink-500">
              {informe.copiadoDe === "plantilla" ? "Textos tomados del formato vigente" : `Textos copiados del informe ${informe.copiadoDe}`}: revísalos y ajústalos.
            </span>
          )}
        </div>
      )}
      {informe?.estado === "Devuelto" && informe.observacionRevision && (
        <div className="mb-5">
          <Aviso tono="rojo">
            <strong>El superadministrador devolvió el informe:</strong> {informe.observacionRevision}
          </Aviso>
        </div>
      )}
      {informe?.estado === "Aprobado" && (
        <div className="mb-5">
          <Aviso tono="verde">
            Aprobado por {informe.revisadoPor} el {fechaHora(informe.fechaRevision)}.{informe.observacionRevision ? ` ${informe.observacionRevision}` : ""}
          </Aviso>
        </div>
      )}
      {error && (
        <div className="mb-5" role="alert">
          <Aviso>{error}</Aviso>
        </div>
      )}
      {aviso && (
        <div className="mb-5">
          <Aviso tono="verde">{aviso}</Aviso>
        </div>
      )}

      {!respuesta || !datos ? (
        <p className="text-ink-500">Cargando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
          <nav aria-label="Secciones del informe" className="flex lg:flex-col gap-1.5 overflow-x-auto lg:sticky lg:top-6 pb-1">
            {PASOS.map((p, i) => {
              const activo = paso === p.id;
              const pendiente =
                (p.id === "proyecto" && respuesta.revision.faltantes.some((f) => /Responsable|Fecha|Descripción|Justificación|objetivo/.test(f))) ||
                (p.id === "evaluacion" && respuesta.revision.faltantes.some((f) => /Logros|Dificultades|Acciones/.test(f)));
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaso(p.id)}
                  aria-current={activo ? "step" : undefined}
                  className={`whitespace-nowrap lg:whitespace-normal flex items-center gap-2.5 rounded-xl px-3.5 py-2 min-h-[46px] text-sm font-bold text-left ${
                    activo ? "bg-primary text-white" : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0 ${activo ? "bg-gold text-primary" : "bg-gray-100"}`}>{i + 1}</span>
                  <span className="flex-1">{p.titulo}</span>
                  {pendiente && <span className="w-2 h-2 rounded-full bg-[#D97706]" title="Falta información" />}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {paso === "proyecto" && <PasoProyecto datos={datos} poner={poner} editable={editable} />}
            {paso === "evaluacion" && <PasoEvaluacion datos={datos} poner={poner} editable={editable} cifras={respuesta.cifras} />}
            {paso === "actividades" && <PasoActividades cifras={respuesta.cifras} recargar={() => cargar(true)} />}
            {paso === "cifras" && <PasoCifras cifras={respuesta.cifras} recargar={() => cargar(true)} />}
            {paso === "enviar" && <PasoEnviar informe={informe} revision={respuesta.revision} onEnviar={enviar} enviando={enviando} periodo={periodo} sucio={sucio} />}
          </div>
        </div>
      )}

      {editable && sucio && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-600">Tienes cambios sin guardar en el informe {periodo}.</span>
            <button type="button" onClick={guardar} disabled={guardando} className={botonPrimario}>
              {guardando ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
