import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Encabezado, Insignia, Vacio, claseCampoCorto } from "../../comunes/componentes/ui";
import { Icono } from "../../comunes/componentes/Iconos";
import { BotonFlotante, Ventana } from "../../comunes/componentes/Ventana";
import { http } from "../../../../lib/api/http";
import { horas } from "../../comunes/lib/deporte";
import { IconoDisciplina } from "../../comunes/Progreso";
import { useCatalogosDeporte } from "../../comunes/useCatalogosDeporte";
import { FormularioGrupo, GRUPO_VACIO } from "./FormularioGrupo";

// Grupos del periodo, ordenados por disciplina.

export function periodosCercanos(actual) {
  const [a, s] = actual.split("-").map(Number);
  const siguiente = s === 1 ? `${a}-2` : `${a + 1}-1`;
  const anterior = s === 1 ? `${a - 1}-2` : `${a}-1`;
  return [siguiente, actual, anterior];
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
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-28">
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
          </>
        }
      />
      {!creando && cat && <BotonFlotante onClick={() => setCreando(true)}>Nuevo grupo</BotonFlotante>}
      {creando && cat && (
        <Ventana titulo="Nuevo grupo" alCerrar={() => setCreando(false)}>
            <FormularioGrupo
              cat={cat}
              inicial={GRUPO_VACIO(periodo || cat.periodoActual)}
              onCancelar={() => setCreando(false)}
              onGuardado={(g) => {
                setCreando(false);
                navigate(`/deporte/grupos/${g.id}`);
              }}
            />
        </Ventana>
      )}
      {datos?.grupos.length === 0 && <Vacio>No hay grupos en el periodo {periodo}. Crea el primero con «Nuevo grupo».</Vacio>}
      <div className="flex flex-col gap-6">
        {porDisciplina.map(([nombre, grupos]) => (
          <section key={nombre}>
            <div className="flex items-center gap-3 mb-3">
              <IconoDisciplina nombre={nombre} tamano={44} imagen={grupos[0]?.disciplina?.imagenUrl} />
              <h2 className="m-0 font-sans text-lg font-bold text-primary-dark">{nombre}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {grupos.map((g) => (
                <Link key={g.id} to={`/deporte/grupos/${g.id}`} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-soft transition-colors no-underline flex flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-ink-900">{g.nombre}</span>
                    {!g.activo ? <Insignia tono="gris">Inactivo</Insignia> : !g.inscripcionesAbiertas ? <Insignia tono="dorado">Inscripciones cerradas</Insignia> : null}
                  </div>
                  <span className="text-sm text-ink-500">{g.horarioTexto}</span>
                  <span className="text-sm text-ink-500 flex items-center gap-1.5 flex-wrap">
                    {g.docente ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-primary">
                        <Icono nombre="persona" size={14} /> {g.docente.nombre}
                      </span>
                    ) : (
                      <span className={g.instructor ? "" : "text-[#8A4B00] font-semibold"}>{g.instructor || "Sin docente asignado"}</span>
                    )}
                    {g.lugar ? <span>· {g.lugar}</span> : null}
                  </span>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1" aria-hidden="true">
                    <div className={`h-full rounded-full ${g.inscritos >= g.cupo ? "bg-red-500" : g.inscritos / g.cupo >= 0.8 ? "bg-gold" : "bg-[#0d9488]"}`} style={{ width: `${Math.min(100, (g.inscritos / g.cupo) * 100)}%` }} />
                  </div>
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
