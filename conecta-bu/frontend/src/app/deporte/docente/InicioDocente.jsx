import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Tarjeta, Vacio } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { BandaInicio, botonBandaPrincipal, hoyLargo } from "../comunes/componentes/ui";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { DIAS, DIAS_CORTOS, diaHoy, horas, hoyISO, useAhora } from "../comunes/lib/deporte";
import { mensajeError } from "../comunes/lib/salud";
import { IconoDisciplina } from "../comunes/Progreso";
import { CONTENEDOR } from "../comunes/estilos";
import { API } from "./constantes";

// Inicio del docente: su semana y las clases de hoy.

export function useInicioDocente() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get(`${API}/inicio`)
      .then((r) => setDatos(r.data))
      .catch((err) => setError(mensajeError(err, "No fue posible cargar tus grupos.")));
  }, []);
  return { datos, error };
}

// Semana del docente: sus clases en una cuadricula de lunes a domingo.
export function SemanaDocente({ grupos }) {
  const hoy = diaHoy();
  const [dia, setDia] = useState(hoy);
  const clases = (d) =>
    grupos
      .flatMap((g) => (g.horario || []).filter((h) => h.dia === d).map((h) => ({ ...h, grupo: g })))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return (
    <Tarjeta titulo="Mi semana" subtitulo="Toca un día para ver sus clases">
      <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Días de la semana">
        {Object.keys(DIAS).map((k) => {
          const d = Number(k);
          const n = clases(d).length;
          const activo = d === dia;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setDia(d)}
              className={`rounded-xl py-2 flex flex-col items-center gap-1 border transition-colors ${activo ? "bg-primary-dark border-primary-dark text-white" : "bg-white border-gray-200 hover:border-primary/50"}`}
            >
              <span className="text-xs font-bold">
                {DIAS_CORTOS[d]}
                {d === hoy ? " · hoy" : ""}
              </span>
              <span className="flex gap-0.5 h-1.5">
                {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-cyan" : "bg-[#F97316]"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="list-none m-0 p-0 mt-4 flex flex-col gap-2">
        {clases(dia).length === 0 && <Vacio>No tienes clases el {DIAS[dia].toLowerCase()}.</Vacio>}
        {clases(dia).map((c) => (
          <li key={`${c.grupo.id}-${c.inicio}`}>
            <Link to={`/deporte-docente/grupos/${c.grupo.id}`} className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 hover:bg-gray-50">
              <span className="w-16 text-sm font-extrabold text-primary tabular-nums">{c.inicio}</span>
              <IconoDisciplina nombre={c.grupo.disciplina?.nombre} tamano={36} />
              <span className="flex-1 min-w-0 leading-tight">
                <span className="block font-bold text-ink-900 truncate">{c.grupo.nombre}</span>
                <span className="block text-xs text-ink-500 truncate">
                  {c.inicio}–{c.fin}
                  {c.grupo.lugar ? ` · ${c.grupo.lugar}` : ""} · {c.grupo.inscritos} inscritos
                </span>
              </span>
              <Icono nombre="derecha" size={16} className="text-ink-500" />
            </Link>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export function InicioDocente() {
  const { usuario } = useAuth();
  const { datos, error } = useInicioDocente();
  const hoy = diaHoy();
  const ahora = useAhora();
  const clasesHoy = (datos?.grupos || [])
    .filter((g) => (g.horario || []).some((h) => h.dia === hoy))
    .map((g) => {
      const franja = g.horario.find((h) => h.dia === hoy);
      return { ...g, franja, empieza: new Date(`${hoyISO()}T${franja.inicio}:00-05:00`).getTime() };
    })
    .sort((a, b) => a.empieza - b.empieza);
  // La clase en curso (ya empezo) o, si ninguna, la proxima de hoy.
  const enCurso = [...clasesHoy].reverse().find((g) => g.empieza <= ahora);
  const proxima = clasesHoy.find((g) => g.empieza > ahora);
  return (
    <>
      <BandaInicio
        titulo={
          <>
            Hola, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
          </>
        }
        fecha={`${hoyLargo()}${datos?.periodo ? ` · Periodo ${datos.periodo}` : ""}`}
        texto="Aquí ves tus grupos y tomas la asistencia de tus clases. Se toma y se corrige solo mientras dura la clase, hasta su hora final."
        acciones={
          enCurso ? (
            <Link to={`/deporte-docente/grupos/${enCurso.id}?asistencia=1`} className={botonBandaPrincipal}>
              <Icono nombre="check" size={18} /> Tomar asistencia · {enCurso.nombre}
            </Link>
          ) : proxima ? (
            <span className="inline-flex items-center gap-2 min-h-[48px] px-5 rounded-full bg-white/10 text-white font-bold text-sm">
              <Icono nombre="reloj" size={18} /> La asistencia se activa a las {proxima.franja.inicio}
            </span>
          ) : null
        }
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">Clases de hoy</h2>
            {!datos && <p className="m-0 text-ink-500">Cargando…</p>}
            {datos && (
              <div className="flex gap-4 items-center">
                <span className="shrink-0 w-[76px] h-[68px] rounded-2xl bg-primary-light text-primary font-extrabold flex items-center justify-center tabular-nums text-[28px]">{clasesHoy.length}</span>
                <span className="text-ink-600">{clasesHoy.length ? clasesHoy.map((g) => g.nombre).join(", ") : "Hoy no tienes clases."}</span>
              </div>
            )}
          </>
        }
      />
      <main className={`${CONTENEDOR} flex flex-col gap-6`}>
        {error && <Aviso>{error}</Aviso>}
        {datos && datos.grupos.length === 0 && <Vacio>Aún no tienes grupos asignados este periodo. La coordinación de Deportes te los asigna.</Vacio>}
        {datos && datos.grupos.length > 0 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] items-start">
            <SemanaDocente grupos={datos.grupos} />
            <section className="flex flex-col gap-3">
              <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">Mis grupos</h2>
              {datos.grupos.map((g) => (
                <Link key={g.id} to={`/deporte-docente/grupos/${g.id}`} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-soft no-underline flex gap-4 items-center">
                  <IconoDisciplina nombre={g.disciplina?.nombre} tamano={48} />
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="font-bold text-ink-900">{g.nombre}</span>
                    <span className="text-sm text-ink-500">{g.horarioTexto}</span>
                    <span className="h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[#0d9488]" style={{ width: `${Math.min(100, (g.inscritos / g.cupo) * 100)}%` }} />
                    </span>
                    <span className="text-sm text-ink-600">
                      <strong className="tabular-nums">{g.inscritos}</strong>/{g.cupo} inscritos · {g.sesiones} clases registradas · {horas(g.horasDictadas)}
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
