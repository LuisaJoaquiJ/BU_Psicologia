import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { Navbar } from "../../components/Navbar";
import { Icono } from "../../components/Iconos";
import { DIAS, DIAS_CORTOS, diaHoy, estiloDisciplina, fechaCorta, horas } from "../../lib/deporte";
import { descargar, mensajeError } from "../../lib/salud";
import { Aviso, Insignia, Tarjeta, Vacio, botonDorado, botonPrimario, botonSecundario } from "../salud/ui";
import { AnilloHoras, BarrasDisciplina, IconoDisciplina } from "./Progreso";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../../components/ui";

// Area del estudiante en el modulo Deporte (/mi-deporte): su avance hacia
// las horas requeridas, la oferta de disciplinas para inscribirse y el
// detalle de sus horas.

function useMisHoras() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    http
      .get("/deporte/mis-horas")
      .then((r) => setDatos(r.data))
      .catch(() => setError("No fue posible cargar tus horas."));
  }, []);
  return { datos, error };
}

function descargarConstancia() {
  return descargar("/deporte/mis-horas/constancia", {}, "constancia-horas-deporte.pdf");
}

// Semana con las franjas de los grupos del estudiante.
function MiSemana({ grupos }) {
  const hoy = diaHoy();
  const franjas = grupos.flatMap((g) => g.horario.map((h) => ({ ...h, grupo: g })));
  return (
    <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <div key={d} className={`rounded-2xl p-2 min-h-[120px] ${d === hoy ? "bg-primary-light ring-2 ring-primary-soft/30" : "bg-gray-50"}`}>
          <p className={`m-0 mb-2 text-xs font-bold uppercase tracking-[0.08em] ${d === hoy ? "text-primary" : "text-ink-500"}`}>
            {DIAS_CORTOS[d]}
            {d === hoy && " · hoy"}
          </p>
          <div className="flex flex-col gap-1.5">
            {franjas
              .filter((f) => f.dia === d)
              .sort((a, b) => a.inicio.localeCompare(b.inicio))
              .map((f) => {
                const e = estiloDisciplina(f.grupo.disciplina?.nombre);
                return (
                  <div key={`${f.grupo.id}-${f.inicio}`} className="rounded-lg px-2 py-1.5 text-[11px] leading-tight" style={{ background: e.fondo, color: e.color }}>
                    <span className="block font-bold">
                      {f.inicio}–{f.fin}
                    </span>
                    <span className="block font-semibold text-ink-900 truncate">{f.grupo.disciplina?.nombre}</span>
                    {f.grupo.lugar && <span className="block text-ink-500 truncate">{f.grupo.lugar}</span>}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function InicioDeporte() {
  const { usuario } = useAuth();
  const { datos, error } = useMisHoras();
  return (
    <>
      <BandaInicio
        titulo={
          datos?.cumplido ? (
            <>
              ¡Completaste tus horas, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}!</span>
            </>
          ) : (
            <>
              Hola, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
            </>
          )
        }
        fecha={`${hoyLargo()}${datos?.periodo ? ` · Periodo ${datos.periodo}` : ""}`}
        texto={
          datos
            ? datos.cumplido
              ? `Registras ${horas(datos.total)} de práctica deportiva. Descarga tu constancia cuando la necesites.`
              : `Te faltan ${horas(datos.faltan)} para completar las ${datos.requeridas} horas de deporte. Este periodo llevas ${horas(datos.horasPeriodo)}.`
            : "Cargando tu avance…"
        }
        acciones={
          <>
            <Link to="/mi-deporte/oferta" className={botonBandaPrincipal}>
              <Icono nombre="balon" size={18} /> Ver disciplinas e inscribirme
            </Link>
            <button type="button" onClick={descargarConstancia} className={botonBandaSecundario}>
              <Icono nombre="descarga" size={17} /> Constancia
            </button>
          </>
        }
        lado={datos ? <AnilloHoras total={datos.total} requeridas={datos.requeridas} /> : <div className="w-[168px] h-[168px] rounded-full bg-white/10 animate-pulse" />}
      />
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">

      {error && <Aviso>{error}</Aviso>}

      <Tarjeta titulo="Mi semana" subtitulo={datos?.grupos?.length ? `${datos.grupos.length} grupo(s) este periodo` : null}>
        {datos && datos.grupos.length === 0 ? (
          <Vacio>
            Aún no estás inscrito en ningún grupo este periodo.{" "}
            <Link to="/mi-deporte/oferta" className="font-bold text-primary-soft">
              Mira la oferta
            </Link>
            .
          </Vacio>
        ) : (
          <div className="overflow-x-auto">{datos && <MiSemana grupos={datos.grupos} />}</div>
        )}
      </Tarjeta>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Horas por disciplina">
          {datos?.porDisciplina?.length ? <BarrasDisciplina datos={datos.porDisciplina} /> : <Vacio>Tus horas aparecerán cuando el instructor registre tu asistencia.</Vacio>}
        </Tarjeta>
        <Tarjeta
          titulo="Últimas horas registradas"
          acciones={
            <Link to="/mi-deporte/horas" className="text-sm font-bold text-primary-soft">
              Ver todo →
            </Link>
          }
        >
          {datos?.historial?.length === 0 && <Vacio>Sin registros todavía.</Vacio>}
          <ul className="list-none m-0 p-0">
            {datos?.historial?.slice(0, 6).map((h) => (
              <li key={`${h.tipo}-${h.id}`} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <IconoDisciplina nombre={h.disciplina} tamano={36} />
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{h.grupo || h.disciplina}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {fechaCorta(h.fecha)} · {h.detalle}
                  </span>
                </span>
                <span className="font-bold text-primary tabular-nums">+{horas(h.horas)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </main>
    </>
  );
}

function FilaGrupo({ grupo, onInscribir, onRetirar, ocupado }) {
  const [confirmar, setConfirmar] = useState(false);
  const lleno = grupo.cuposDisponibles === 0 && !grupo.inscrito;
  const ocupacion = grupo.cupo ? Math.round(((grupo.cupo - grupo.cuposDisponibles) / grupo.cupo) * 100) : 0;
  return (
    <li className={`rounded-2xl border p-4 flex flex-col gap-3 ${grupo.inscrito ? "border-[#9ED9CB] bg-[#F1FAF7]" : "border-gray-200"}`}>
      <div className="flex justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="m-0 font-bold text-primary">{grupo.nombre}</p>
          <p className="m-0 text-sm text-ink-500">
            {[grupo.instructor && `Instructor: ${grupo.instructor}`, grupo.lugar].filter(Boolean).join(" · ")}
          </p>
        </div>
        {grupo.inscrito && (
          <Insignia tono="verde">
            <Icono nombre="check" size={13} strokeWidth={3} /> Inscrito
          </Insignia>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {grupo.horario.map((h) => (
          <span key={`${h.dia}-${h.inicio}`} className="text-xs font-semibold bg-white border border-gray-200 rounded-full px-2.5 py-1">
            {DIAS[h.dia]} {h.inicio}–{h.fin}
          </span>
        ))}
        <span className="text-xs font-semibold text-ink-500 px-1 py-1">{horas(grupo.horasSemana)} por semana</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${ocupacion >= 100 ? "bg-red-500" : ocupacion >= 80 ? "bg-[#D97706]" : "bg-[#0d9488]"}`} style={{ width: `${ocupacion}%` }} />
          </div>
          <p className="m-0 mt-1 text-xs text-ink-500">
            {grupo.cuposDisponibles} de {grupo.cupo} cupos disponibles
          </p>
        </div>
        {grupo.inscrito ? (
          confirmar ? (
            <span className="flex gap-2 items-center">
              <span className="text-sm text-ink-600">¿Retirarte?</span>
              <button type="button" disabled={ocupado} onClick={() => onRetirar(grupo)} className={`${botonSecundario} text-red-700`}>
                Sí, retirarme
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className={botonSecundario}>
                No
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmar(true)} className={botonSecundario}>
              Retirarme
            </button>
          )
        ) : grupo.cruceCon ? (
          <span className="text-sm font-semibold text-[#B45309]">Se cruza con {grupo.cruceCon}</span>
        ) : !grupo.inscripcionesAbiertas ? (
          <span className="text-sm font-semibold text-ink-500">Inscripciones cerradas</span>
        ) : (
          <button type="button" disabled={lleno || ocupado} onClick={() => onInscribir(grupo)} className={botonPrimario}>
            {lleno ? "Sin cupos" : "Inscribirme"}
          </button>
        )}
      </div>
    </li>
  );
}

function OfertaPage() {
  const [oferta, setOferta] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(() => {
    http
      .get("/deporte/oferta")
      .then((r) => setOferta(r.data))
      .catch(() => setError("No fue posible cargar la oferta."));
  }, []);
  useEffect(cargar, [cargar]);

  async function accion(grupo, tipo) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r = tipo === "inscribir" ? await http.post(`/deporte/grupos/${grupo.id}/inscripcion`) : await http.delete(`/deporte/grupos/${grupo.id}/inscripcion`);
      setOferta(r.data);
      setAviso(tipo === "inscribir" ? `Quedaste inscrito en ${grupo.nombre}. Tus horas se suman con la asistencia que registre el instructor.` : `Te retiraste de ${grupo.nombre}. Las horas que ya tenías se conservan.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setOcupado(false);
    }
  }

  const visibles = useMemo(() => (oferta?.disciplinas || []).filter((d) => !filtro || d.tipo === filtro), [oferta, filtro]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16">
      <div className="flex justify-between items-end gap-4 flex-wrap mb-6">
        <div>
          <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Deporte · periodo {oferta?.periodo || "…"}</p>
          <h1 className="m-0 text-3xl sm:text-[36px] font-extrabold">Disciplinas e inscripciones</h1>
          <p className="mt-1.5 mb-0 text-ink-500 max-w-[640px]">
            Elige el grupo que mejor se ajuste a tu horario. Puedes inscribirte hasta en {oferta?.maxGruposPorPeriodo || 2} grupo(s) por periodo
            {oferta ? ` (llevas ${oferta.inscritoEn})` : ""}.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por tipo">
          {[
            ["", "Todas"],
            ["Individual", "Individuales"],
            ["Colectivo", "En equipo"],
            ["Mental", "Mentales"],
          ].map(([v, t]) => (
            <button
              key={t}
              type="button"
              aria-pressed={filtro === v}
              onClick={() => setFiltro(v)}
              className={`rounded-full px-4 min-h-[40px] text-sm font-bold ${filtro === v ? "bg-primary text-white" : "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
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
      {!oferta && <p className="text-ink-500">Cargando…</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        {visibles.map((d) => {
          const e = estiloDisciplina(d.nombre);
          return (
            <section key={d.id} className="bg-white border border-gray-200 rounded-[24px] overflow-hidden flex flex-col">
              <div className="flex items-center gap-4 px-5 py-4" style={{ background: e.fondo }}>
                <span className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center" style={{ color: e.color }}>
                  <Icono nombre={e.icono} size={24} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 font-sans text-lg font-bold text-ink-900">{d.nombre}</h2>
                  <p className="m-0 text-sm text-ink-600">{d.descripcion}</p>
                </div>
              </div>
              <div className="p-5 flex-1">
                {d.grupos.length === 0 ? (
                  <Vacio>Sin grupos abiertos este periodo.</Vacio>
                ) : (
                  <ul className="list-none m-0 p-0 flex flex-col gap-3">
                    {d.grupos.map((g) => (
                      <FilaGrupo key={g.id} grupo={g} ocupado={ocupado} onInscribir={(x) => accion(x, "inscribir")} onRetirar={(x) => accion(x, "retirar")} />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function MisHorasPage() {
  const { datos, error } = useMisHoras();
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <p className="m-0 mb-1.5 text-sm font-semibold text-ink-500">Deporte</p>
          <h1 className="m-0 text-3xl sm:text-[36px] font-extrabold">Mis horas</h1>
        </div>
        <button type="button" onClick={descargarConstancia} className={botonPrimario}>
          <Icono nombre="descarga" size={17} /> Descargar constancia
        </button>
      </div>
      {error && <Aviso>{error}</Aviso>}
      {datos && (
        <>
          <div className="bg-white border border-gray-200 rounded-[22px] p-5">
            <div className="flex justify-between items-end gap-3 flex-wrap mb-2">
              <p className="m-0 text-ink-600">
                <strong className="font-display text-3xl text-primary">{horas(datos.total)}</strong> de {datos.requeridas} horas requeridas
              </p>
              {datos.cumplido ? <Insignia tono="verde">Requisito cumplido</Insignia> : <Insignia tono="dorado">Faltan {horas(datos.faltan)}</Insignia>}
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gold" style={{ width: `${datos.porcentaje}%` }} />
            </div>
            <div className="flex gap-2 flex-wrap mt-4">
              {datos.porPeriodo.map((p) => (
                <span key={p.periodo} className="text-sm bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                  {p.periodo}: <strong>{horas(p.horas)}</strong>
                </span>
              ))}
            </div>
          </div>
          <Tarjeta titulo="Historial" subtitulo="Asistencias registradas por los instructores y horas reconocidas por Bienestar">
            {datos.historial.length === 0 ? (
              <Vacio>Aún no tienes horas registradas.</Vacio>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[560px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.06em] text-ink-500 bg-gray-50">
                      <th className="px-3 py-2.5">Fecha</th>
                      <th className="px-3 py-2.5">Disciplina</th>
                      <th className="px-3 py-2.5">Detalle</th>
                      <th className="px-3 py-2.5 text-right">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.historial.map((h) => (
                      <tr key={`${h.tipo}-${h.id}`} className="border-t border-gray-100">
                        <td className="px-3 py-2.5 whitespace-nowrap">{fechaCorta(h.fecha)}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold">{h.disciplina}</span>
                          {h.grupo && <span className="block text-xs text-ink-500">{h.grupo}</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {h.tipo === "reconocida" && (
                            <Insignia tono="azul" className="mr-1.5">
                              Reconocida
                            </Insignia>
                          )}
                          {h.detalle}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">{horas(h.horas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </main>
  );
}

export function MiDeportePanel() {
  return (
    <div>
      <Navbar modulo="deporte" />
      <Routes>
        <Route index element={<InicioDeporte />} />
        <Route path="oferta" element={<OfertaPage />} />
        <Route path="horas" element={<MisHorasPage />} />
      </Routes>
    </div>
  );
}
