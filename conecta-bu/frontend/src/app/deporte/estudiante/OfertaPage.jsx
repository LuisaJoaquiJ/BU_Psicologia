import { useCallback, useEffect, useMemo, useState } from "react";
import { Aviso, Insignia, Vacio } from "../comunes/componentes/ui";
import { useConfirmar } from "../comunes/componentes/Confirmar";
import { Icono } from "../comunes/componentes/Iconos";
import { FotoDeporte } from "../comunes/componentes/SelectorFoto";
import { http } from "../../../lib/api/http";
import { DIAS, DIAS_CORTOS, estiloDisciplina } from "../comunes/lib/deporte";
import { mensajeError } from "../comunes/lib/salud";
import { Pastillas } from "../comunes/Pastillas";
import { FilaGrupo } from "./FilaGrupo";

// Disciplinas e inscripción: oferta del periodo con filtros.

export function OfertaPage() {
  const [oferta, setOferta] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [buscar, setBuscar] = useState("");
  const [dias, setDias] = useState([]);
  const [franja, setFranja] = useState("");
  const [conCupos, setConCupos] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(() => {
    http
      .get("/deporte/oferta")
      .then((r) => setOferta(r.data))
      .catch(() => setError("No fue posible cargar la oferta."));
  }, []);
  useEffect(() => {
    cargar();
    // Cupos en vivo: se actualizan cada 30 segundos mientras la pagina esta abierta.
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const { confirmar, avisar } = useConfirmar();
  async function accion(grupo, tipo) {
    const horario = grupo.horario.map((h) => `${DIAS[h.dia]} ${h.inicio}–${h.fin}`).join(" · ");
    const ok = await confirmar(
      tipo === "inscribir"
        ? { titulo: `¿Inscribirte en ${grupo.nombre}?`, mensaje: "Tus horas se suman con la asistencia que registre el docente.", detalle: [["Horario", horario], ["Lugar", grupo.lugar], ["Docente", grupo.instructor], ["Cupos libres", grupo.cuposDisponibles]], boton: "Sí, inscribirme" }
        : { titulo: `¿Retirarte de ${grupo.nombre}?`, mensaje: "Liberas tu cupo para otra persona. Las horas que ya tienes se conservan.", boton: "Sí, retirarme", cancelar: "No, seguir inscrito", peligro: true }
    );
    if (!ok) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r = tipo === "inscribir" ? await http.post(`/deporte/grupos/${grupo.id}/inscripcion`) : await http.delete(`/deporte/grupos/${grupo.id}/inscripcion`);
      setOferta(r.data);
      setAviso(tipo === "inscribir" ? `Quedaste inscrito en ${grupo.nombre}. Tus horas se suman con la asistencia que registre el docente.` : `Te retiraste de ${grupo.nombre}. Las horas que ya tenías se conservan.`);
      avisar(tipo === "inscribir" ? `Quedaste inscrito en ${grupo.nombre}.` : `Te retiraste de ${grupo.nombre}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(mensajeError(err, "No fue posible completar la acción."));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setOcupado(false);
    }
  }

  // Filtros del catalogo (RF-017): texto, dias, franja, cupos y tipo.
  const visibles = useMemo(() => {
    const t = buscar
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const norm = (x) =>
      String(x || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const enFranja = (h) => {
      const hh = Number(h.inicio.slice(0, 2));
      return !franja || (franja === "manana" ? hh < 12 : franja === "tarde" ? hh >= 12 && hh < 18 : hh >= 18);
    };
    return (oferta?.disciplinas || [])
      .filter((d) => !filtro || d.tipo === filtro)
      .map((d) => ({
        ...d,
        grupos: d.grupos.filter(
          (g) =>
            (!t || norm(`${d.nombre} ${g.nombre} ${g.instructor || ""} ${g.lugar || ""}`).includes(t)) &&
            (!dias.length || g.horario.some((h) => dias.includes(h.dia))) &&
            g.horario.some(enFranja) &&
            (!conCupos || g.cuposDisponibles > 0 || g.inscrito)
        ),
      }))
      .filter((d) => d.grupos.length || (!t && !dias.length && !franja && !conCupos));
  }, [oferta, filtro, buscar, dias, franja, conCupos]);
  const totalGrupos = visibles.reduce((s, d) => s + d.grupos.length, 0);
  const hayFiltros = buscar || dias.length || franja || conCupos || filtro;

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
          {oferta && (
            <p className="m-0 mt-2 text-sm text-ink-600 flex items-center gap-2 flex-wrap">
              Tu categoría: <Insignia tono="azul">{oferta.categoria}</Insignia>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                <span className="w-2 h-2 rounded-full bg-[#1baf7a] animate-pulse" aria-hidden="true" /> Cupos en vivo
              </span>
            </p>
          )}
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
              className={`rounded-full px-4 min-h-[40px] text-sm font-bold ${filtro === v ? "boton-liquido" : "burbuja text-ink-600 hover:bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-col gap-3">
        <div className="flex gap-3 flex-wrap items-center">
          <label className="relative flex-[1_1_260px]">
            <span className="sr-only">Buscar</span>
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
              <Icono nombre="buscar" size={18} />
            </span>
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Busca por deporte, docente o lugar"
              className="w-full border border-gray-200 rounded-full pl-10 pr-4 min-h-[44px] text-sm bg-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-700 cursor-pointer">
            <input type="checkbox" checked={conCupos} onChange={(e) => setConCupos(e.target.checked)} className="w-4 h-4 accent-[#0B2A5B]" />
            Solo con cupos
          </label>
        </div>
        <div className="flex gap-x-6 gap-y-3 flex-wrap items-center">
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Días">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const activo = dias.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setDias((x) => (activo ? x.filter((y) => y !== d) : [...x, d]))}
                  className={`w-11 h-10 rounded-xl text-sm font-bold border ${activo ? "bg-primary text-white border-primary" : "bg-white border-gray-200 text-ink-600 hover:border-primary/50"}`}
                >
                  {DIAS_CORTOS[d]}
                </button>
              );
            })}
          </div>
          <Pastillas etiqueta="Franja" opciones={[["", "Cualquier hora"], ["manana", "Mañana"], ["tarde", "Tarde"], ["noche", "Noche"]]} valor={franja} onCambio={setFranja} />
        </div>
        {oferta && (
          <p className="m-0 text-sm text-ink-500" aria-live="polite">
            {totalGrupos} grupo{totalGrupos === 1 ? "" : "s"}
            {hayFiltros ? " con estos filtros" : " en el periodo"}
            {hayFiltros && (
              <button
                type="button"
                onClick={() => {
                  setBuscar("");
                  setDias([]);
                  setFranja("");
                  setConCupos(false);
                  setFiltro("");
                }}
                className="ml-2 font-bold text-primary-soft"
              >
                Quitar filtros
              </button>
            )}
          </p>
        )}
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
      {oferta && visibles.length === 0 && <Vacio>No hay grupos con esos filtros. Prueba con otros días u horas.</Vacio>}
      <div className="grid gap-5 lg:grid-cols-2">
        {visibles.map((d) => {
          const e = estiloDisciplina(d.nombre);
          return (
            <section key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              {d.imagenUrl && <FotoDeporte url={d.imagenUrl} alt={`Foto de ${d.nombre}`} className="w-full h-[150px]" />}
              <div className="flex items-center gap-4 px-5 py-4" style={{ background: e.fondo }}>
                <span className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center" style={{ color: e.color }}>
                  <Icono nombre={e.icono} size={24} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h2 className="m-0 font-sans text-lg font-bold text-ink-900">{d.nombre}</h2>
                  <p className="m-0 text-sm text-ink-600">{d.descripcion}</p>
                  {d.restriccion && (
                    <p className="m-0 mt-1 text-xs font-bold text-[#8A4B00] inline-flex items-center gap-1">
                      <Icono nombre="escudo" size={13} /> {d.restriccion}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-5 flex-1">
                {d.grupos.length === 0 ? (
                  <Vacio>Sin grupos abiertos este periodo.</Vacio>
                ) : (
                  <ul className="list-none m-0 p-0 flex flex-col gap-3">
                    {d.grupos.map((g) => (
                      <FilaGrupo key={g.id} grupo={g} restriccion={d.restriccion} ocupado={ocupado} onInscribir={(x) => accion(x, "inscribir")} onRetirar={(x) => accion(x, "retirar")} />
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
