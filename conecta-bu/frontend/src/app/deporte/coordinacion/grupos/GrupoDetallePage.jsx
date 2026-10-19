import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio, botonDorado, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { http } from "../../../../lib/api/http";
import { estadoAsistencia, fechaCorta, horas, useAhora } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { IconoDisciplina } from "../../comunes/Progreso";
import { TomarAsistencia } from "../../comunes/TomarAsistencia";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { FormularioGrupo } from "./FormularioGrupo";

// Detalle de un grupo: inscritos, asistencia y clases registradas.

export function GrupoDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [grupo, setGrupo] = useState(null);
  const [modo, setModo] = useState(null); // "asistencia" | "editar" | { sesion }
  const ahora = useAhora();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => http.get(`/deporte/admin/grupos/${id}`).then((r) => setGrupo(r.data.grupo)), [id]);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar el grupo.")));
  }, [cargar]);

  const { confirmar, avisar } = useConfirmar();
  async function accion(pregunta, hacer, mensaje) {
    if (pregunta && !(await confirmar(pregunta))) return false;
    setError("");
    setAviso("");
    try {
      const r = await hacer();
      setGrupo(r.data.grupo);
      setAviso(mensaje);
      avisar(mensaje);
      return true;
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
      return false;
    }
  }

  if (!grupo) return <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9">{error ? <Aviso>{error}</Aviso> : <p className="text-ink-500">Cargando…</p>}</main>;
  const activos = grupo.inscritos.filter((i) => i.estado === "Activa");

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <Link to="/deporte/grupos" className="text-sm font-bold text-primary-soft inline-flex items-center gap-1 w-fit">
        <Icono nombre="izquierda" size={16} /> Grupos
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
            {grupo.instructor ? ` · ${grupo.instructor}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setModo("editar")} className={botonSecundario}>
            <Icono nombre="editar" size={15} /> Editar
          </button>
          {(() => {
            // La asistencia de la clase de hoy se toma de su hora de inicio a su hora final.
            const est = estadoAsistencia(grupo.sugerenciaSesion, ahora);
            return (
              <button type="button" disabled={!est.puede} title={est.texto} onClick={() => setModo("asistencia")} className={`${botonDorado} disabled:opacity-60 disabled:cursor-not-allowed`}>
                <Icono nombre={est.motivo === "temprano" ? "reloj" : "check"} size={17} strokeWidth={2.4} /> {est.texto}
              </button>
            );
          })()}
        </div>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      {modo === "editar" && cat && (
        <Tarjeta titulo="Editar grupo">
          <FormularioGrupo
            cat={cat}
            inicial={{ id: grupo.id, disciplinaId: grupo.disciplinaId, periodo: grupo.periodo, nombre: grupo.nombre, docenteId: grupo.docenteId || "", instructor: grupo.docenteId ? "" : grupo.instructor || "", lugar: grupo.lugar || "", cupo: grupo.cupo, horario: grupo.horario, inscripcionesAbiertas: grupo.inscripcionesAbiertas }}
            onCancelar={() => setModo(null)}
            onGuardado={(g) => {
              setGrupo(g);
              setModo(null);
              setAviso("Grupo actualizado.");
            }}
          />
        </Tarjeta>
      )}
      {(modo === "asistencia" || modo?.sesion) && (
        <Tarjeta
          titulo={modo?.sesion ? `Corregir asistencia del ${fechaCorta(modo.sesion.fecha)}` : "Tomar asistencia"}
          subtitulo={!modo?.sesion && !grupo.sugerenciaSesion.hoyTieneClase ? "Hoy no hay clase en el horario de este grupo: revisa la fecha y las horas." : "Cada estudiante presente suma las horas de la sesión."}
        >
          <TomarAsistencia
            key={modo?.sesion?.id || "nueva"}
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

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {[
          ["Inscritos", `${activos.length} / ${grupo.cupo}`],
          ["Sesiones", grupo.sesiones.length],
          ["Horas dictadas", horas(grupo.sesiones.reduce((s, x) => s + x.horas, 0))],
          ["Inscripciones", grupo.inscripcionesAbiertas ? "Abiertas" : "Cerradas"],
        ].map(([t, v]) => (
          <div key={t} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="m-0 text-[13px] text-ink-500">{t}</p>
            <p className="m-0 mt-1 font-display text-[28px] font-semibold text-primary tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] items-start">
        <Tarjeta titulo="Inscritos" subtitulo="Horas que lleva cada estudiante en este grupo">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              accion(
                { titulo: `¿Inscribir a ${email} en ${grupo.nombre}?`, mensaje: activos.length >= grupo.cupo ? `El grupo ya está lleno (${activos.length}/${grupo.cupo}); como coordinación puedes inscribirlo igual.` : `Quedarán ${activos.length + 1} de ${grupo.cupo} cupos ocupados.`, boton: "Sí, inscribir" },
                () => http.post(`/deporte/admin/grupos/${grupo.id}/inscritos`, { email }),
                "Estudiante inscrito."
              ).then((ok) => ok && setEmail(""));
            }}
            className="flex gap-2 mb-4 flex-wrap"
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@uniautonoma.edu.co" aria-label="Correo del estudiante" className={`${claseCampo} flex-[1_1_220px]`} />
            <button type="submit" className={botonSecundario}>
              <Icono nombre="mas" size={15} strokeWidth={2.4} /> Inscribir
            </button>
          </form>
          {grupo.inscritos.length === 0 && <Vacio>Aún no hay inscritos.</Vacio>}
          <ul className="list-none m-0 p-0">
            {grupo.inscritos.map((i) => (
              <li key={i.usuarioId} className={`flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0 ${i.estado !== "Activa" ? "opacity-60" : ""}`}>
                <span className="flex-1 min-w-0 leading-tight">
                  <Link to={`/deporte/estudiantes/${i.usuarioId}`} className="block font-semibold text-ink-900 truncate">
                    {i.nombre}
                  </Link>
                  <span className="block text-xs text-ink-500 truncate">
                    {i.categoria} · {i.email} · {i.asistencias}/{grupo.sesiones.length} sesiones
                  </span>
                </span>
                {i.estado !== "Activa" && <Insignia tono="gris">Retirado</Insignia>}
                <span className="font-bold tabular-nums text-primary">{horas(i.horas)}</span>
                {i.estado === "Activa" && (
                  <button
                    type="button"
                    onClick={() =>
                      accion(
                        { titulo: `¿Retirar a ${i.nombre} de ${grupo.nombre}?`, mensaje: "Libera su cupo. Las horas que ya tiene se conservan.", boton: "Sí, retirar", peligro: true },
                        () => http.delete(`/deporte/admin/grupos/${grupo.id}/inscritos/${i.usuarioId}`),
                        `${i.nombre} fue retirado del grupo.`
                      )
                    }
                    className="text-xs font-bold text-ink-500 hover:text-red-600"
                  >
                    Retirar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Sesiones" subtitulo="La asistencia se corrige solo hasta la hora final de la clase">
          {grupo.sesiones.length === 0 && <Vacio>Todavía no se ha tomado asistencia.</Vacio>}
          <ul className="list-none m-0 p-0">
            {grupo.sesiones.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900">
                    {fechaCorta(s.fecha)} · {s.inicio}–{s.fin}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {s.presentes.length}/{s.registrados} presentes{s.tema ? ` · ${s.tema}` : ""}
                  </span>
                </span>
                {new Date(s.editableHasta).getTime() > ahora ? (
                  <button type="button" onClick={() => setModo({ sesion: s })} className={`${botonSecundario} min-h-[34px] text-[13px]`}>
                    Corregir
                  </button>
                ) : (
                  <Insignia tono="gris">Cerrada</Insignia>
                )}
                <span className="font-bold tabular-nums">{horas(s.horas)}</span>
                <button
                  type="button"
                  onClick={() =>
                    accion(
                      { titulo: `¿Eliminar la clase del ${fechaCorta(s.fecha)}?`, mensaje: `Se quitan ${horas(s.horas)} a los ${s.presentes.length} estudiantes que asistieron. No se puede deshacer.`, boton: "Sí, eliminar", peligro: true },
                      () => http.delete(`/deporte/admin/sesiones/${s.id}`),
                      "Sesión eliminada."
                    )
                  }
                  aria-label="Eliminar sesión"
                  className="w-8 h-8 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                >
                  <Icono nombre="cerrar" size={15} />
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </main>
  );
}
