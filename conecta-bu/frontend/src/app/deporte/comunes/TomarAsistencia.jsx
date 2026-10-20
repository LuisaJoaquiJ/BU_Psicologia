import { useState } from "react";
import { Aviso, Campo, Vacio, botonPrimario, botonSecundario, claseCampo } from "./componentes/ui";
import { useConfirmar } from "./componentes/Confirmar";
import { http } from "../../../lib/api/http";
import { mensajeError } from "./lib/salud";

// Lista para tomar la asistencia de una clase (coordinación y docente).

// Toma de asistencia: lista de inscritos activos con marcar todos. "api" es
// la base de las rutas (coordinacion o panel del docente).
export function TomarAsistencia({ grupo, sesion, onGuardado, onCancelar, api = "/deporte/admin", bloquearFecha = false }) {
  const activos = grupo.inscritos.filter((i) => i.estado === "Activa");
  const [buscar, setBuscar] = useState("");
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

  const { confirmar, avisar } = useConfirmar();
  async function guardar(e) {
    e.preventDefault();
    const ausentes = activos.filter((i) => !datos.presentes.has(i.usuarioId));
    if (
      !(await confirmar({
        titulo: sesion ? "¿Guardar la corrección de asistencia?" : "¿Guardar la asistencia?",
        mensaje: `Cada presente suma las horas de la clase.${ausentes.length && ausentes.length <= 5 ? ` No asistieron: ${ausentes.map((i) => i.nombre.split(" ")[0]).join(", ")}.` : ""}`,
        detalle: [["Clase", `${datos.fecha} · ${datos.inicio}–${datos.fin}`], ["Presentes", `${datos.presentes.size} de ${activos.length}`], ["Ausentes", ausentes.length]],
        boton: "Sí, guardar",
      }))
    )
      return;
    setGuardando(true);
    setError("");
    const cuerpo = { fecha: datos.fecha, inicio: datos.inicio, fin: datos.fin, tema: datos.tema, presentes: [...datos.presentes] };
    try {
      const r = sesion ? await http.put(`${api}/sesiones/${sesion.id}`, cuerpo) : await http.post(`${api}/grupos/${grupo.id}/sesiones`, cuerpo);
      const mensaje = sesion ? "Asistencia corregida." : `Asistencia guardada: ${datos.presentes.size} presente(s).`;
      avisar(mensaje);
      onGuardado(r.data.grupo, mensaje);
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
          <input type="date" required disabled={Boolean(sesion) || bloquearFecha} value={datos.fecha} onChange={(e) => setDatos((d) => ({ ...d, fecha: e.target.value }))} className={claseCampo} />
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
        <div className="flex-[1_1_220px] min-w-0">
          <p className="m-0 text-sm font-semibold text-ink-600" aria-live="polite">
            {datos.presentes.size} de {activos.length} presentes
          </p>
          <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-[#0d9488] transition-[width] duration-300" style={{ width: `${activos.length ? (datos.presentes.size / activos.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setDatos((d) => ({ ...d, presentes: new Set(activos.map((i) => i.usuarioId)) }))} className={`${botonSecundario} min-h-[36px]`}>
            Todos presentes
          </button>
          <button type="button" onClick={() => setDatos((d) => ({ ...d, presentes: new Set() }))} className={`${botonSecundario} min-h-[36px]`}>
            Ninguno
          </button>
        </div>
      </div>
      {activos.length > 8 && (
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar estudiante" aria-label="Buscar estudiante" className={claseCampo} />
      )}
      {activos.length === 0 ? (
        <Vacio>No hay estudiantes inscritos en este grupo.</Vacio>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-2 sm:grid-cols-2">
          {activos
            .filter((i) => !buscar || `${i.nombre} ${i.email}`.toLowerCase().includes(buscar.toLowerCase()))
            .map((i) => {
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
