import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio, botonDorado, botonSecundario } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { http } from "../../../lib/api/http";
import { estadoAsistencia, fechaCorta, useAhora } from "../comunes/lib/deporte";
import { mensajeError } from "../comunes/lib/salud";
import { IconoDisciplina } from "../comunes/Progreso";
import { TomarAsistencia } from "../comunes/TomarAsistencia";
import { CONTENEDOR } from "../comunes/estilos";
import { API } from "./constantes";

// Grupo del docente: inscritos y asistencia (durante la clase).

export function GrupoDocentePage() {
  const { id } = useParams();
  const [grupo, setGrupo] = useState(null);
  const [modo, setModo] = useState(null);
  const ahora = useAhora();
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [orden, setOrden] = useState("nombre");
  const cargar = useCallback(
    () =>
      http.get(`${API}/grupos/${id}`).then((r) => {
        setGrupo(r.data.grupo);
        // Desde "Tomar asistencia" del inicio se abre directo, si la clase ya empezo.
        if (new URLSearchParams(window.location.search).get("asistencia") && estadoAsistencia(r.data.grupo.sugerenciaSesion, Date.now()).puede) setModo("asistencia");
      }),
    [id]
  );
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar el grupo.")));
  }, [cargar]);
  const activos = useMemo(() => {
    const l = (grupo?.inscritos || []).filter((i) => i.estado === "Activa").map((i) => ({ ...i, porcentaje: i.sesionesRegistradas ? Math.round((i.asistencias / i.sesionesRegistradas) * 100) : null }));
    return orden === "asistencia" ? l.sort((a, b) => (a.porcentaje ?? 101) - (b.porcentaje ?? 101)) : l;
  }, [grupo, orden]);

  if (!grupo) return <main className={CONTENEDOR}>{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  return (
    <main className={`${CONTENEDOR} flex flex-col gap-6`}>
      <Link to="/deporte-docente" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Mis grupos
      </Link>
      <div className="flex items-start gap-4 flex-wrap">
        <IconoDisciplina nombre={grupo.disciplina?.nombre} tamano={56} />
        <div className="flex-1 min-w-0">
          <p className="m-0 text-sm font-semibold text-ink-500">
            {grupo.disciplina?.nombre} · {grupo.periodo}
          </p>
          <h1 className="m-0 mt-1 text-[30px] font-extrabold">{grupo.nombre}</h1>
          <p className="m-0 mt-1 text-ink-500">
            {grupo.horarioTexto}
            {grupo.lugar ? ` · ${grupo.lugar}` : ""}
          </p>
        </div>
        {(() => {
          // Solo la clase de hoy y desde su hora de inicio (las anteriores se corrigen en «Clases registradas»).
          const est = estadoAsistencia(grupo.sugerenciaSesion, ahora);
          return (
            <button type="button" disabled={!est.puede} title={est.texto} onClick={() => setModo("asistencia")} className={`${botonDorado} disabled:opacity-60 disabled:cursor-not-allowed`}>
              <Icono nombre={est.motivo === "temprano" ? "reloj" : "check"} size={17} strokeWidth={2.4} /> {est.texto}
            </button>
          );
        })()}
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}
      {(modo === "asistencia" || modo?.sesion) && (
        <Tarjeta
          titulo={modo?.sesion ? `Corregir asistencia del ${fechaCorta(modo.sesion.fecha)}` : "Tomar asistencia"}
          subtitulo={modo?.sesion ? `Puedes corregirla hasta las ${new Date(modo.sesion.editableHasta).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" })}, hora final de la clase.` : !grupo.sugerenciaSesion.hoyTieneClase ? "Hoy no hay clase en el horario de este grupo." : "Marca a quienes no vinieron; por defecto todos están presentes."}
        >
          <TomarAsistencia
            key={modo?.sesion?.id || "nueva"}
            api={API}
            bloquearFecha
            grupo={grupo}
            sesion={modo?.sesion}
            onCancelar={() => setModo(null)}
            onGuardado={(g, mensaje) => {
              setGrupo(g);
              setModo(null);
              setAviso(mensaje);
            }}
          />
        </Tarjeta>
      )}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
        <Tarjeta
          titulo={`Estudiantes inscritos (${activos.length})`}
          acciones={
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar" className="border border-gray-200 rounded-full px-3 min-h-[38px] text-sm font-semibold bg-white">
              <option value="nombre">Por nombre</option>
              <option value="asistencia">Menor asistencia primero</option>
            </select>
          }
        >
          {activos.length === 0 && <Vacio>Aún no hay inscritos.</Vacio>}
          <ul className="list-none m-0 p-0">
            {activos.map((i) => (
              <li key={i.usuarioId} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{i.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {i.categoria} · {i.email}
                  </span>
                </span>
                <span className="w-28 hidden sm:block" aria-hidden="true">
                  <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <span className={`block h-full rounded-full ${i.porcentaje === null ? "" : i.porcentaje < 70 ? "bg-red-500" : "bg-[#0d9488]"}`} style={{ width: `${i.porcentaje ?? 0}%` }} />
                  </span>
                </span>
                <span className={`text-sm font-bold tabular-nums w-14 text-right ${i.porcentaje !== null && i.porcentaje < 70 ? "text-red-700" : "text-ink-700"}`}>{i.porcentaje === null ? "—" : `${i.porcentaje} %`}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Clases registradas" subtitulo="Se pueden corregir solo hasta la hora final de la clase">
          {grupo.sesiones.length === 0 && <Vacio>Todavía no has tomado asistencia.</Vacio>}
          <ul className="list-none m-0 p-0">
            {grupo.sesiones.map((s) => {
              const editable = new Date(s.editableHasta).getTime() > ahora;
              return (
                <li key={s.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                  <span className="flex-1 min-w-0 leading-tight">
                    <span className="block font-semibold text-ink-900">
                      {fechaCorta(s.fecha)} · {s.inicio}–{s.fin}
                    </span>
                    <span className="block text-xs text-ink-500 truncate">
                      {s.presentes.length}/{s.registrados} presentes{s.tema ? ` · ${s.tema}` : ""}
                    </span>
                  </span>
                  {editable ? (
                    <button type="button" onClick={() => setModo({ sesion: s })} className={`${botonSecundario} min-h-[34px] text-[13px]`}>
                      Corregir
                    </button>
                  ) : (
                    <Insignia tono="gris">Cerrada</Insignia>
                  )}
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      </div>
    </main>
  );
}
