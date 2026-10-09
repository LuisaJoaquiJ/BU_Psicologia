import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { DIAS, fechaCorta, horas } from "../../lib/deporte";
import { mensajeError } from "../../lib/salud";
import { Aviso, Campo, Encabezado, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "../salud/ui";
import { IconoDisciplina } from "./Progreso";

// Grupos del modulo Deporte: crear la oferta del periodo, ver inscritos y
// tomar asistencia por sesion (cada sesion suma sus horas a los presentes).

export function useCatalogosDeporte() {
  const [cat, setCat] = useState(null);
  const recargar = useCallback(() => http.get("/deporte/admin/catalogos").then((r) => setCat(r.data)), []);
  useEffect(() => {
    recargar();
  }, [recargar]);
  return { cat, recargar };
}

function periodosCercanos(actual) {
  const [a, s] = actual.split("-").map(Number);
  const siguiente = s === 1 ? `${a}-2` : `${a + 1}-1`;
  const anterior = s === 1 ? `${a - 1}-2` : `${a}-1`;
  return [siguiente, actual, anterior];
}

function EditorHorario({ horario, onCambio }) {
  const cambiar = (i, k, v) => onCambio(horario.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  return (
    <div className="flex flex-col gap-2">
      {horario.map((h, i) => (
        <div key={i} className="flex gap-2 items-center flex-wrap">
          <select aria-label="Día" value={h.dia} onChange={(e) => cambiar(i, "dia", Number(e.target.value))} className={claseCampoCorto}>
            {Object.entries(DIAS).map(([d, n]) => (
              <option key={d} value={d}>
                {n}
              </option>
            ))}
          </select>
          <input aria-label="Desde" type="time" value={h.inicio} onChange={(e) => cambiar(i, "inicio", e.target.value)} className={`${claseCampoCorto} w-[130px]`} />
          <span className="text-ink-500">a</span>
          <input aria-label="Hasta" type="time" value={h.fin} onChange={(e) => cambiar(i, "fin", e.target.value)} className={`${claseCampoCorto} w-[130px]`} />
          {horario.length > 1 && (
            <button type="button" onClick={() => onCambio(horario.filter((_, j) => j !== i))} aria-label="Quitar franja" className="w-9 h-9 rounded-full text-ink-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center">
              <Icono nombre="cerrar" size={16} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onCambio([...horario, { dia: 3, inicio: "14:00", fin: "16:00" }])} className="self-start text-sm font-bold text-primary-soft">
        + Agregar otro día
      </button>
    </div>
  );
}

const GRUPO_VACIO = (periodo) => ({ disciplinaId: "", periodo, nombre: "", instructor: "", lugar: "", cupo: 25, horario: [{ dia: 1, inicio: "14:00", fin: "16:00" }], inscripcionesAbiertas: true });

export function FormularioGrupo({ cat, inicial, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const poner = (k) => (e) => setDatos((d) => ({ ...d, [k]: e?.target ? e.target.value : e }));
  const disciplina = cat.disciplinas.find((d) => d.id === datos.disciplinaId);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const cuerpo = { ...datos, cupo: Number(datos.cupo) };
      const r = datos.id ? await http.patch(`/deporte/admin/grupos/${datos.id}`, cuerpo) : await http.post("/deporte/admin/grupos", cuerpo);
      onGuardado(r.data.grupo);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar el grupo."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Disciplina">
          <select
            required
            value={datos.disciplinaId}
            onChange={(e) => {
              const d = cat.disciplinas.find((x) => x.id === e.target.value);
              setDatos((x) => ({ ...x, disciplinaId: e.target.value, nombre: x.nombre || (d ? `${d.nombre} · Grupo 1` : "") }));
            }}
            className={claseCampo}
          >
            <option value="">Elige la disciplina</option>
            {cat.disciplinas
              .filter((d) => d.activa || d.id === datos.disciplinaId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
          </select>
        </Campo>
        <Campo etiqueta="Nombre del grupo">
          <input required maxLength={80} value={datos.nombre} onChange={poner("nombre")} placeholder={disciplina ? `${disciplina.nombre} · Grupo 1` : "Natación · Grupo 1"} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Instructor">
          <input maxLength={150} value={datos.instructor || ""} onChange={poner("instructor")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Lugar">
          <input maxLength={150} value={datos.lugar || ""} onChange={poner("lugar")} placeholder="Coliseo, piscina, sala…" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Cupo">
          <input type="number" min="1" max="500" required value={datos.cupo} onChange={poner("cupo")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Periodo">
          <select value={datos.periodo} onChange={poner("periodo")} className={claseCampo}>
            {periodosCercanos(cat.periodoActual).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Campo>
      </div>
      <fieldset className="border-0 p-0 m-0">
        <legend className="text-sm font-semibold text-ink-600 mb-2">Horario</legend>
        <EditorHorario horario={datos.horario} onCambio={poner("horario")} />
      </fieldset>
      <label className="flex items-center gap-2.5 text-sm font-semibold text-ink-700 cursor-pointer">
        <input type="checkbox" checked={datos.inscripcionesAbiertas} onChange={(e) => setDatos((d) => ({ ...d, inscripcionesAbiertas: e.target.checked }))} className="w-4 h-4 accent-[#0B2A5B]" />
        Inscripciones abiertas para los estudiantes
      </label>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2.5">
        <button type="submit" disabled={guardando} className={botonPrimario}>
          {guardando ? "Guardando…" : datos.id ? "Guardar cambios" : "Crear grupo"}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className={botonSecundario}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export function GruposPage() {
  const { cat } = useCatalogosDeporte();
  const [periodo, setPeriodo] = useState("");
  const [datos, setDatos] = useState(null);
  const [creando, setCreando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (cat && !periodo) setPeriodo(cat.periodoActual);
  }, [cat, periodo]);
  const cargar = useCallback(() => {
    if (periodo) http.get("/deporte/admin/grupos", { params: { periodo } }).then((r) => setDatos(r.data));
  }, [periodo]);
  useEffect(cargar, [cargar]);

  const porDisciplina = useMemo(() => {
    const mapa = new Map();
    for (const g of datos?.grupos || []) {
      const k = g.disciplina?.nombre || "—";
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(g);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [datos]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <Encabezado
        kicker="Deporte"
        titulo="Grupos"
        descripcion="La oferta de cada periodo: disciplina, horario, lugar, instructor y cupos. Los estudiantes se inscriben desde su área de Deporte."
        acciones={
          <>
            {cat && (
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={claseCampoCorto} aria-label="Periodo">
                {periodosCercanos(cat.periodoActual).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => setCreando(true)} className={botonDorado}>
              <Icono nombre="mas" size={17} strokeWidth={2.4} /> Nuevo grupo
            </button>
          </>
        }
      />
      {creando && cat && (
        <div className="mb-6">
          <Tarjeta titulo="Nuevo grupo">
            <FormularioGrupo
              cat={cat}
              inicial={GRUPO_VACIO(periodo || cat.periodoActual)}
              onCancelar={() => setCreando(false)}
              onGuardado={(g) => {
                setCreando(false);
                navigate(`/deporte/grupos/${g.id}`);
              }}
            />
          </Tarjeta>
        </div>
      )}
      {datos?.grupos.length === 0 && <Vacio>No hay grupos en el periodo {periodo}. Crea el primero con «Nuevo grupo».</Vacio>}
      <div className="flex flex-col gap-6">
        {porDisciplina.map(([nombre, grupos]) => (
          <section key={nombre}>
            <div className="flex items-center gap-3 mb-3">
              <IconoDisciplina nombre={nombre} tamano={36} />
              <h2 className="m-0 font-sans text-lg font-bold text-primary">{nombre}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {grupos.map((g) => (
                <Link key={g.id} to={`/deporte/grupos/${g.id}`} className="bg-white border border-gray-200 rounded-[20px] p-4 hover:border-primary-soft transition-colors no-underline flex flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-ink-900">{g.nombre}</span>
                    {!g.activo ? <Insignia tono="gris">Inactivo</Insignia> : !g.inscripcionesAbiertas ? <Insignia tono="dorado">Inscripciones cerradas</Insignia> : null}
                  </div>
                  <span className="text-sm text-ink-500">{g.horarioTexto}</span>
                  <span className="text-sm text-ink-500">{[g.instructor, g.lugar].filter(Boolean).join(" · ")}</span>
                  <div className="flex gap-4 text-sm mt-1">
                    <span>
                      <strong className="tabular-nums">{g.inscritos}</strong>/{g.cupo} inscritos
                    </span>
                    <span>
                      <strong className="tabular-nums">{g.sesiones}</strong> sesiones
                    </span>
                    <span>
                      <strong className="tabular-nums">{horas(g.horasDictadas)}</strong> dictadas
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

// Toma de asistencia: lista de inscritos activos con marcar todos.
function TomarAsistencia({ grupo, sesion, onGuardado, onCancelar }) {
  const activos = grupo.inscritos.filter((i) => i.estado === "Activa");
  const [datos, setDatos] = useState(() =>
    sesion
      ? { fecha: sesion.fecha, inicio: sesion.inicio, fin: sesion.fin, tema: sesion.tema || "", presentes: new Set(sesion.presentes) }
      : { ...grupo.sugerenciaSesion, tema: "", presentes: new Set(activos.map((i) => i.usuarioId)) }
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const alternar = (id) =>
    setDatos((d) => {
      const p = new Set(d.presentes);
      if (p.has(id)) p.delete(id);
      else p.add(id);
      return { ...d, presentes: p };
    });

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    const cuerpo = { fecha: datos.fecha, inicio: datos.inicio, fin: datos.fin, tema: datos.tema, presentes: [...datos.presentes] };
    try {
      const r = sesion ? await http.put(`/deporte/admin/sesiones/${sesion.id}`, cuerpo) : await http.post(`/deporte/admin/grupos/${grupo.id}/sesiones`, cuerpo);
      onGuardado(r.data.grupo, sesion ? "Asistencia corregida." : `Asistencia guardada: ${datos.presentes.size} presente(s).`);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar la asistencia."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr]">
        <Campo etiqueta="Fecha">
          <input type="date" required disabled={Boolean(sesion)} value={datos.fecha} onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value }))} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Desde">
          <input type="time" required value={datos.inicio} disabled={Boolean(sesion)} onChange={(e) => setDatos((d) => ({ ...d, inicio: e.target.value }))} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Hasta">
          <input type="time" required value={datos.fin} onChange={(e) => setDatos((d) => ({ ...d, fin: e.target.value }))} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Tema (opcional)">
          <input maxLength={200} value={datos.tema} onChange={(e) => setDatos((d) => ({ ...d, tema: e.target.value }))} placeholder="Técnica de crol, partido amistoso…" className={claseCampo} />
        </Campo>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="m-0 text-sm font-semibold text-ink-600">
          {datos.presentes.size} de {activos.length} presentes
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setDatos((d) => ({ ...d, presentes: new Set(activos.map((i) => i.usuarioId)) }))} className={`${botonSecundario} min-h-[36px]`}>
            Todos presentes
          </button>
          <button type="button" onClick={() => setDatos((d) => ({ ...d, presentes: new Set() }))} className={`${botonSecundario} min-h-[36px]`}>
            Ninguno
          </button>
        </div>
      </div>
      {activos.length === 0 ? (
        <Vacio>No hay estudiantes inscritos en este grupo.</Vacio>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-2 sm:grid-cols-2">
          {activos.map((i) => {
            const presente = datos.presentes.has(i.usuarioId);
            return (
              <li key={i.usuarioId}>
                <label className={`flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 cursor-pointer ${presente ? "border-[#0d9488] bg-[#F1FAF7]" : "border-gray-200 bg-white"}`}>
                  <input type="checkbox" checked={presente} onChange={() => alternar(i.usuarioId)} className="w-5 h-5 accent-[#0d9488]" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-semibold text-ink-900 truncate">{i.nombre}</span>
                    <span className="block text-xs text-ink-500 truncate">{i.email}</span>
                  </span>
                  <span className={`text-xs font-bold ${presente ? "text-[#0B6B61]" : "text-ink-500"}`}>{presente ? "Asistió" : "No asistió"}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2.5">
        <button type="submit" disabled={guardando || activos.length === 0} className={botonPrimario}>
          {guardando ? "Guardando…" : "Guardar asistencia"}
        </button>
        <button type="button" onClick={onCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function GrupoDetallePage() {
  const { id } = useParams();
  const { cat } = useCatalogosDeporte();
  const [grupo, setGrupo] = useState(null);
  const [modo, setModo] = useState(null); // "asistencia" | "editar" | { sesion }
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => http.get(`/deporte/admin/grupos/${id}`).then((r) => setGrupo(r.data.grupo)), [id]);
  useEffect(() => {
    cargar().catch((err) => setError(mensajeError(err, "No fue posible cargar el grupo.")));
  }, [cargar]);

  async function accion(promesa, mensaje) {
    setError("");
    setAviso("");
    try {
      const r = await promesa;
      setGrupo(r.data.grupo);
      setAviso(mensaje);
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
          <p className="m-0 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">
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
          <button type="button" onClick={() => setModo("asistencia")} className={botonDorado}>
            <Icono nombre="check" size={17} strokeWidth={2.4} /> Tomar asistencia
          </button>
        </div>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {aviso && <Aviso tono="verde">{aviso}</Aviso>}

      {modo === "editar" && cat && (
        <Tarjeta titulo="Editar grupo">
          <FormularioGrupo
            cat={cat}
            inicial={{ id: grupo.id, disciplinaId: grupo.disciplinaId, periodo: grupo.periodo, nombre: grupo.nombre, instructor: grupo.instructor || "", lugar: grupo.lugar || "", cupo: grupo.cupo, horario: grupo.horario, inscripcionesAbiertas: grupo.inscripcionesAbiertas }}
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
          <div key={t} className="bg-white border border-gray-200 rounded-[20px] p-4">
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
              accion(http.post(`/deporte/admin/grupos/${grupo.id}/inscritos`, { email }), "Estudiante inscrito.").then((ok) => ok && setEmail(""));
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
                    {i.email} · {i.asistencias}/{grupo.sesiones.length} sesiones
                  </span>
                </span>
                {i.estado !== "Activa" && <Insignia tono="gris">Retirado</Insignia>}
                <span className="font-bold tabular-nums text-primary">{horas(i.horas)}</span>
                {i.estado === "Activa" && (
                  <button
                    type="button"
                    onClick={() => accion(http.delete(`/deporte/admin/grupos/${grupo.id}/inscritos/${i.usuarioId}`), `${i.nombre} fue retirado del grupo.`)}
                    className="text-xs font-bold text-ink-500 hover:text-red-600"
                  >
                    Retirar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Sesiones" subtitulo="Toca una sesión para corregir su asistencia">
          {grupo.sesiones.length === 0 && <Vacio>Todavía no se ha tomado asistencia.</Vacio>}
          <ul className="list-none m-0 p-0">
            {grupo.sesiones.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <button type="button" onClick={() => setModo({ sesion: s })} className="flex-1 min-w-0 text-left leading-tight">
                  <span className="block font-semibold text-ink-900">
                    {fechaCorta(s.fecha)} · {s.inicio}–{s.fin}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {s.presentes.length}/{s.registrados} presentes{s.tema ? ` · ${s.tema}` : ""}
                  </span>
                </button>
                <span className="font-bold tabular-nums">{horas(s.horas)}</span>
                <button
                  type="button"
                  onClick={() => window.confirm("¿Eliminar esta sesión? Se quitan sus horas a los estudiantes.") && accion(http.delete(`/deporte/admin/sesiones/${s.id}`), "Sesión eliminada.")}
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
