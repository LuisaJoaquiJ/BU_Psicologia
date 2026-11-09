import { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../../lib/api/http";
import { EvidenciasInforme } from "../../../components/EvidenciasInforme";
import { mensajeError } from "../comun/formato";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, BarrasHorizontales, Campo, Insignia, Kpi, Tarjeta, Vacio, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "../comunes/componentes/ui";

// Informe de gestion de Arte y Cultura (mismo recorrido que el de Salud integral): proyecto,
// evaluacion, actividades con quienes asistieron, estadisticas, evidencias y envio al
// superadministrador. Las cifras salen de lo registrado; los textos los escribe el area.

const PASOS = [
  { id: "proyecto", titulo: "Proyecto" },
  { id: "evaluacion", titulo: "Evaluación" },
  { id: "actividades", titulo: "Actividades y asistentes" },
  { id: "estadisticas", titulo: "Estadísticas" },
  { id: "evidencias", titulo: "Evidencias y fotos" },
  { id: "enviar", titulo: "Revisar y enviar" },
];

const ESTADO = {
  Borrador: { tono: "dorado", texto: "Borrador" },
  Enviado: { tono: "azul", texto: "Enviado al superadministrador" },
  Devuelto: { tono: "rojo", texto: "Devuelto para ajustes" },
  Aprobado: { tono: "verde", texto: "Aprobado" },
};

const num = (x) => (x === null || x === undefined ? "—" : Number(x).toLocaleString("es-CO"));
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "");
const fechaCorta = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }).replace(".", "") : "");

async function bajar(periodo, formato, aviso) {
  try {
    const r = await http.get(`/cultura/admin/informe-gestion/${periodo}/archivo`, { params: { formato }, responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-gestion-cultura-${periodo}.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    aviso("No fue posible descargar el informe.");
  }
}

function AreaTexto({ valor, onCambio, filas = 6, deshabilitado, placeholder }) {
  return <textarea value={valor || ""} onChange={(e) => onCambio(e.target.value)} rows={filas} disabled={deshabilitado} placeholder={placeholder} className={`${claseCampo} py-3 leading-relaxed font-normal disabled:bg-gray-50 disabled:text-ink-600`} />;
}

function PasoProyecto({ datos, poner, editable }) {
  const objetivos = datos.objetivos || [];
  const cambiar = (i, campo, v) => poner("objetivos")(objetivos.map((o, j) => (j === i ? { ...o, [campo]: v } : o)));
  return (
    <div className="flex flex-col gap-5">
      <Tarjeta titulo="Datos del proyecto" subtitulo="Encabezado del formato de informe de gestión">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Responsable del proyecto">
            <input value={datos.responsable || ""} disabled={!editable} onChange={(e) => poner("responsable")(e.target.value)} maxLength={200} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Fecha de presentación">
            <input type="date" value={String(datos.fechaPresentacion || "").slice(0, 10)} disabled={!editable} onChange={(e) => poner("fechaPresentacion")(e.target.value)} className={claseCampo} />
          </Campo>
        </div>
      </Tarjeta>
      {[
        ["descripcion", "Descripción del proyecto", 7],
        ["justificacion", "Justificación del proyecto", 7],
        ["alineacion", "Alineación estratégica", 3],
      ].map(([k, t, filas]) => (
        <Tarjeta key={k} titulo={t}>
          <AreaTexto valor={datos[k]} onCambio={poner(k)} deshabilitado={!editable} filas={filas} />
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
                  <button type="button" onClick={() => poner("objetivos")(objetivos.filter((_, j) => j !== i))} className="min-h-[36px] px-2 text-sm font-bold text-ink-500 hover:text-red-600">
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
                    <AreaTexto valor={o[k]} onCambio={(v) => cambiar(i, k, v)} deshabilitado={!editable} filas={6} />
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
  const resumen = `En el periodo ${cifras.periodo} Arte y Cultura ofreció ${num(k.grupos)} grupos y talleres (${num(k.inscritos)} inscripciones), con ${num(k.asistencias)} asistencias en ${num(k.sesiones)} sesiones, y realizó ${num(k.eventos)} eventos con ${num(k.asistentesEventos)} asistentes. Participaron ${num(k.personas)} personas.`;
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
          <AreaTexto valor={datos.logros} onCambio={poner("logros")} deshabilitado={!editable} filas={8} placeholder="¿Qué se logró en el periodo? Muestras, grupos nuevos, participación, alianzas…" />
        </Tarjeta>
        <Tarjeta titulo="Dificultades presentadas">
          <AreaTexto valor={datos.dificultades} onCambio={poner("dificultades")} deshabilitado={!editable} filas={7} />
        </Tarjeta>
        <Tarjeta titulo="Acciones de mejora">
          <AreaTexto valor={datos.accionesMejora} onCambio={poner("accionesMejora")} deshabilitado={!editable} filas={7} />
        </Tarjeta>
      </div>
      <aside className="lg:sticky lg:top-6 flex flex-col gap-3">
        <Kpi destacado titulo={`Asistencias ${cifras.periodo}`} valor={num(k.asistencias + k.asistentesEventos)} detalle={`${num(k.asistencias)} en grupos · ${num(k.asistentesEventos)} en eventos`} />
        <Kpi titulo="Personas que participaron" valor={num(k.personas)} />
        <Kpi titulo="Grupos y talleres" valor={num(k.grupos)} detalle={`${num(k.eventos)} eventos`} />
      </aside>
    </div>
  );
}

// Tabla de asistentes dentro de un desplegable (<details>): se abre solo lo que se quiere revisar.
function TablaAsistentes({ asistentes, conSesiones }) {
  if (!asistentes.length) return <p className="m-0 mt-3 text-sm text-ink-500">Nadie registrado.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-ink-500">
            <th className="py-2 pr-3 font-semibold">Nombre</th>
            <th className="py-2 pr-3 font-semibold">Programa</th>
            <th className="py-2 pr-3 font-semibold">Tipo</th>
            {conSesiones && <th className="py-2 font-semibold text-right">Sesiones</th>}
          </tr>
        </thead>
        <tbody>
          {asistentes.map((p, i) => (
            <tr key={`${p.nombre}-${i}`} className="border-t border-gray-100">
              <td className="py-2 pr-3 font-semibold text-ink-900">{p.nombre}</td>
              <td className="py-2 pr-3 text-ink-600">{p.programa}</td>
              <td className="py-2 pr-3 text-ink-600">{p.tipo}</td>
              {conSesiones && <td className="py-2 text-right tabular-nums">{p.sesiones}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actividad({ titulo, detalle, cifras, children }) {
  return (
    <li>
      <details className="group vidrio-panel rounded-2xl px-4 py-1">
        <summary className="list-none cursor-pointer min-h-[56px] py-3 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="text-ink-400 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none">
            <Icono nombre="derecha" size={16} strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-ink-900">{titulo}</strong>
            {detalle && <span className="block text-[13px] text-ink-500">{detalle}</span>}
          </span>
          <span className="shrink-0 text-right text-[13px] text-ink-600">{cifras}</span>
        </summary>
        <div className="pb-4">{children}</div>
      </details>
    </li>
  );
}

function PasoActividades({ cifras }) {
  const sinCuenta = (n) => (n ? ` · ${num(n)} más sin cuenta (conteo manual)` : "");
  return (
    <div className="flex flex-col gap-6">
      <Tarjeta titulo="Grupos y talleres" subtitulo="Abre cada grupo para ver quiénes asistieron y a cuántas sesiones.">
        {cifras.grupos.length === 0 && <Vacio>No hay grupos con actividad en este periodo.</Vacio>}
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {cifras.grupos.map((g) => (
            <Actividad
              key={g.id}
              titulo={g.nombre}
              detalle={`${g.categoria}${g.director ? ` · Dirige ${g.director}` : ""}`}
              cifras={
                <>
                  <strong className="text-ink-900 tabular-nums">{num(g.asistencias)}</strong> asistencias · {num(g.sesiones)} sesiones
                  {g.porcentaje !== null && <span className="block">{g.porcentaje} % de asistencia</span>}
                </>
              }
            >
              <p className="m-0 text-sm text-ink-600">
                {num(g.inscritos)} inscritos · promedio de {num(g.promedio)} personas por sesión{sinCuenta(g.sinCuenta)}
              </p>
              <TablaAsistentes asistentes={g.asistentes} conSesiones />
            </Actividad>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Eventos y presentaciones" subtitulo="Asistieron quienes el personal marcó como presentes.">
        {cifras.eventos.length === 0 && <Vacio>No hubo eventos en este periodo.</Vacio>}
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {cifras.eventos.map((e) => (
            <Actividad
              key={e.id}
              titulo={e.nombre}
              detalle={`${fechaCorta(e.fecha)} · ${e.horario}${e.lugar ? ` · ${e.lugar}` : ""}`}
              cifras={
                <>
                  <strong className="text-ink-900 tabular-nums">{num(e.asistentes.length)}</strong> asistentes
                  <span className="block">{num(e.inscritos)} inscritos</span>
                </>
              }
            >
              <p className="m-0 text-sm text-ink-600">{e.categoria}{sinCuenta(e.sinCuenta)}</p>
              <TablaAsistentes asistentes={e.asistentes} />
            </Actividad>
          ))}
        </ul>
      </Tarjeta>

      {(cifras.pausas.length > 0 || cifras.representaciones.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Tarjeta titulo="Pausas creativas">
            {cifras.pausas.length === 0 ? (
              <Vacio>Sin pausas creativas.</Vacio>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-2 text-sm">
                {cifras.pausas.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                    <span>
                      <strong className="text-ink-900">{p.tecnica}</strong>
                      <span className="block text-ink-500">{fechaCorta(p.fecha)} · {p.lugar}</span>
                    </span>
                    <span className="text-ink-600 tabular-nums">{num(p.impacto)} personas</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta titulo="Representaciones en redes">
            {cifras.representaciones.length === 0 ? (
              <Vacio>Sin representaciones.</Vacio>
            ) : (
              <ul className="list-none m-0 p-0 flex flex-col gap-3 text-sm">
                {cifras.representaciones.map((r) => (
                  <li key={r.id} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                    <strong className="text-ink-900">{r.red} · {r.nombre}</strong>
                    <span className="block text-ink-500">
                      {fechaCorta(r.fecha)}
                      {r.posicion ? ` · ${r.posicion}` : ""}
                    </span>
                    {r.participantes.length > 0 && <span className="block text-ink-600">{r.participantes.map((p) => p.nombre).join(", ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      )}
    </div>
  );
}

function PasoEstadisticas({ cifras }) {
  const k = cifras.kpis;
  const maximo = Math.max(1, ...cifras.mensual.map((m) => m.asistenciasGrupos + m.asistentesEventos));
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi destacado titulo="Personas" valor={num(k.personas)} detalle="sin repetir" />
        <Kpi titulo="Grupos y talleres" valor={num(k.grupos)} detalle={`${num(k.talleres)} talleres · ${num(k.representativos)} representativos`} />
        <Kpi titulo="Asistencias en grupos" valor={num(k.asistencias)} detalle={`${num(k.sesiones)} sesiones`} />
        <Kpi titulo="Asistentes a eventos" valor={num(k.asistentesEventos)} detalle={`${num(k.eventos)} eventos`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <Tarjeta titulo={`Participantes por tipo de persona ${cifras.periodo}`}>
          <BarrasHorizontales datos={cifras.porTipo.map((t) => ({ nombre: t.nombre, total: t.personas })).filter((t) => t.total > 0)} />
        </Tarjeta>
        <Tarjeta titulo="Asistencia por mes" subtitulo="Grupos más eventos">
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {cifras.mensual.map((m) => {
              const total = m.asistenciasGrupos + m.asistentesEventos;
              return (
                <li key={m.mes} className="grid grid-cols-[88px_1fr_48px] items-center gap-3 text-sm">
                  <span className="text-ink-600">{m.mes}</span>
                  <span className="h-3 rounded-full bg-primary-light overflow-hidden">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(total / maximo) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums text-ink-900">{num(total)}</span>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Pausas creativas" valor={num(k.pausas)} detalle={`${num(k.impactoPausas)} personas alcanzadas`} />
        <Kpi titulo="Representaciones" valor={num(k.representaciones)} />
        <Kpi titulo="Sin cuenta (conteo manual)" valor={num(k.asistentesSinCuenta)} />
        <Kpi titulo="Evidencias cargadas" valor={num(k.evidencias)} detalle={`${num(k.fotos)} fotos`} />
      </div>
    </div>
  );
}

function PasoEvidencias({ respuesta, editable, recargar }) {
  const { cifras, revision } = respuesta;
  const sinFotos = revision.avisos?.find((a) => a.tipo === "evidencias")?.actividades || [];
  const destinos = [
    ...cifras.grupos.map((g) => ({ valor: `grupoId:${g.id}`, etiqueta: g.nombre, grupo: "Grupos y talleres" })),
    ...cifras.eventos.map((e) => ({ valor: `eventoId:${e.id}`, etiqueta: `${e.nombre} · ${fechaCorta(e.fecha)}`, grupo: "Eventos" })),
    ...cifras.pausas.map((p) => ({ valor: `pausaId:${p.id}`, etiqueta: `${p.tecnica} · ${fechaCorta(p.fecha)}`, grupo: "Pausas creativas" })),
    ...cifras.representaciones.map((r) => ({ valor: `representacionId:${r.id}`, etiqueta: `${r.red} · ${r.nombre}`, grupo: "Representaciones" })),
  ];
  return (
    <EvidenciasInforme
      evidencias={cifras.evidencias}
      destinos={destinos}
      sinFotos={sinFotos}
      editable={editable}
      conDetalle={false}
      alCambiar={recargar}
      rutaArchivo={(e) => `/cultura/admin/evidencias/${e.id}/archivo`}
      subir={async (destino, archivos) => {
        const [campo, id] = destino.split(":");
        // El servidor recibe un archivo por vez.
        for (const archivo of archivos) {
          const datos = new FormData();
          datos.append(campo, id);
          datos.append("evidencia", archivo);
          await http.post("/cultura/admin/evidencias", datos);
        }
      }}
      eliminar={(e) => http.delete(`/cultura/admin/evidencias/${e.id}`)}
    />
  );
}

function PasoEnviar({ informe, revision, onEnviar, enviando, periodo, sucio, alError }) {
  const [confirmar, setConfirmar] = useState(false);
  const editable = informe.editable;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
      <div className="flex flex-col gap-5">
        <Tarjeta titulo="Lo que falta para enviar">
          {revision.faltantes.length === 0 ? (
            <Aviso tono="verde">Todo lo obligatorio está completo.</Aviso>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {revision.faltantes.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <span className="w-6 h-6 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Icono nombre="cerrar" size={13} strokeWidth={2.6} />
                  </span>
                  <span className="first-letter:uppercase">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
        <Tarjeta titulo="Para revisar" subtitulo="No impiden el envío, pero mejoran el informe.">
          {(revision.avisos || []).length === 0 && <Vacio>Sin observaciones.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {(revision.avisos || []).map((a) => (
              <li key={a.tipo}>
                <Aviso tono="dorado">
                  <strong>{a.texto}.</strong>
                  {a.actividades.length > 0 && (
                    <span className="block mt-1 text-[13px]">
                      {a.actividades.slice(0, 8).join(" · ")}
                      {a.actividades.length > 8 ? " …" : ""}
                    </span>
                  )}
                </Aviso>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <aside className="vidrio-panel rounded-[22px] p-5 flex flex-col gap-3 lg:sticky lg:top-6">
        <p className="m-0 font-bold text-primary">Enviar al superadministrador</p>
        <p className="m-0 text-sm text-ink-600">Al enviarlo se guarda una copia de las cifras de hoy: el superadministrador recibe exactamente lo que ves en la vista previa y lo descarga en PDF o Excel.</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => bajar(periodo, "pdf", alError)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Vista previa PDF
          </button>
          <button type="button" onClick={() => bajar(periodo, "xlsx", alError)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> Excel
          </button>
        </div>
        {editable && !confirmar && (
          <button type="button" disabled={!revision.listo || sucio} onClick={() => setConfirmar(true)} className={`${botonPrimario} w-full`}>
            <Icono nombre="subir" size={18} /> Enviar informe{informe.estado === "Devuelto" ? " corregido" : ""}
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
        {!editable && <p className="m-0 text-sm text-ink-500">Este informe ya no se puede editar.</p>}
      </aside>
    </div>
  );
}

export function InformeGestionCultura() {
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState("");
  const [paso, setPaso] = useState("proyecto");
  const [respuesta, setRespuesta] = useState(null);
  const [datos, setDatos] = useState(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // Periodos: el actual y los que ya tienen informe (AAAA-1 o AAAA-2).
  useEffect(() => {
    const hoy = new Date(Date.now() - 5 * 3600e3);
    const actual = `${hoy.getUTCFullYear()}-${hoy.getUTCMonth() < 6 ? 1 : 2}`;
    http
      .get("/cultura/admin/informe-gestion")
      .then((r) => {
        const lista = new Set([actual, ...r.data.map((i) => i.periodo)]);
        setPeriodos([...lista].sort().reverse());
      })
      .catch(() => setPeriodos([actual]))
      .finally(() => setPeriodo((p) => p || actual));
  }, []);

  const cargar = useCallback(
    (conservarTextos = false) => {
      if (!periodo) return;
      http
        .get(`/cultura/admin/informe-gestion/${periodo}`)
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

  const poner = (campo) => (valor) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setSucio(true);
  };

  async function guardar() {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      const r = await http.put(`/cultura/admin/informe-gestion/${periodo}`, datos);
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
      const r = await http.post(`/cultura/admin/informe-gestion/${periodo}/enviar`);
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
  const faltantes = useMemo(() => respuesta?.revision?.faltantes || [], [respuesta]);
  const pendiente = (id) =>
    (id === "proyecto" && faltantes.some((f) => /responsable|descripción|justificación|objetivo/.test(f))) ||
    (id === "evaluacion" && faltantes.some((f) => /logros|dificultades/.test(f))) ||
    (id === "evidencias" && faltantes.some((f) => /foto/.test(f))) ||
    (id === "actividades" && faltantes.some((f) => /actividades del periodo/.test(f)));

  return (
    <>
      <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
        <div className="min-w-0">
          <h2 className="m-0 text-2xl font-extrabold text-primary-dark">Informe de gestión</h2>
          <p className="mt-1 mb-0 text-ink-500 max-w-[640px]">Proyecto, evaluación, quiénes asistieron a cada actividad, estadísticas y registro fotográfico. Se envía al superadministrador, que lo descarga en PDF o Excel.</p>
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
          <button type="button" disabled={!periodo} onClick={() => bajar(periodo, "pdf", setError)} className={botonSecundario}>
            <Icono nombre="descarga" size={16} /> PDF
          </button>
          <button type="button" disabled={!periodo} onClick={() => bajar(periodo, "xlsx", setError)} className={botonSecundario}>
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
          {informe.fechaEnvio && (
            <span className="text-sm text-ink-500">
              Enviado el {fechaHora(informe.fechaEnvio)} por {informe.enviadoPor}
            </span>
          )}
          {informe.estado === "Borrador" && informe.copiadoDe && (
            <span className="text-sm text-ink-500">{informe.copiadoDe === "plantilla" ? "Textos tomados del formato vigente" : `Textos copiados del informe ${informe.copiadoDe}`}: revísalos y ajústalos.</span>
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
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      {!respuesta || !datos ? (
        <p className="text-ink-500">Cargando…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr] items-start">
          <nav aria-label="Secciones del informe" className="flex lg:flex-col gap-1.5 overflow-x-auto lg:sticky lg:top-6 pb-1">
            {PASOS.map((p, i) => {
              const activo = paso === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaso(p.id)}
                  aria-current={activo ? "step" : undefined}
                  className={`whitespace-nowrap lg:whitespace-normal flex items-center gap-2.5 rounded-xl px-3.5 py-2 min-h-[46px] text-sm font-bold text-left ${activo ? "boton-liquido" : "burbuja text-ink-600 hover:bg-white"}`}
                >
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0 ${activo ? "bg-gold text-primary" : "bg-gray-100"}`}>{i + 1}</span>
                  <span className="flex-1">{p.titulo}</span>
                  {pendiente(p.id) && <span className="w-2 h-2 rounded-full bg-[#D97706]" title="Falta información" />}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0">
            {paso === "proyecto" && <PasoProyecto datos={datos} poner={poner} editable={editable} />}
            {paso === "evaluacion" && <PasoEvaluacion datos={datos} poner={poner} editable={editable} cifras={respuesta.cifras} />}
            {paso === "actividades" && <PasoActividades cifras={respuesta.cifras} />}
            {paso === "estadisticas" && <PasoEstadisticas cifras={respuesta.cifras} />}
            {paso === "evidencias" && <PasoEvidencias respuesta={respuesta} editable={editable} recargar={() => cargar(true)} />}
            {paso === "enviar" && <PasoEnviar informe={informe} revision={respuesta.revision} onEnviar={enviar} enviando={enviando} periodo={periodo} sucio={sucio} alError={setError} />}
          </div>
        </div>
      )}

      {editable && sucio && (
        <div className="fixed bottom-0 right-0 left-0 lg:left-[var(--menu,0px)] z-[55] bg-white/95 backdrop-blur border-t border-gray-200">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink-600">Tienes cambios sin guardar en el informe {periodo}.</span>
            <button type="button" onClick={guardar} disabled={guardando} className={botonPrimario}>
              {guardando ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
