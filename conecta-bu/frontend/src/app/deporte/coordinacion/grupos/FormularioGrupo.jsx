import { useState } from "react";
import { Aviso, Campo, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { http } from "../../../../lib/api/http";
import { DIAS } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { EditorHorario } from "./EditorHorario";
import { periodosCercanos } from "./GruposPage";

// Formulario para crear o editar un grupo.

export const GRUPO_VACIO = (periodo) => ({ disciplinaId: "", periodo, nombre: "", docenteId: "", instructor: "", lugar: "", cupo: 25, horario: [{ dia: 1, inicio: "14:00", fin: "16:00" }], inscripcionesAbiertas: true });

export function FormularioGrupo({ cat, inicial, onGuardado, onCancelar }) {
  const [datos, setDatos] = useState(inicial);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const poner = (k) => (e) => setDatos((d) => ({ ...d, [k]: e?.target ? e.target.value : e }));
  const disciplina = cat.disciplinas.find((d) => d.id === datos.disciplinaId);
  const { confirmar, avisar } = useConfirmar();

  async function guardar(e) {
    e.preventDefault();
    const docente = (cat.docentes || []).find((d) => d.id === datos.docenteId);
    if (
      !(await confirmar({
        titulo: datos.id ? `¿Guardar los cambios de ${datos.nombre}?` : `¿Crear el grupo ${datos.nombre}?`,
        mensaje: datos.inscripcionesAbiertas ? "Los estudiantes lo verán en la oferta y podrán inscribirse." : "Las inscripciones quedarán cerradas.",
        detalle: [
          ["Disciplina", disciplina?.nombre],
          ["Docente", docente?.nombre || datos.instructor || "Sin docente"],
          ["Horario", datos.horario.map((h) => `${DIAS[h.dia]} ${h.inicio}–${h.fin}`).join(" · ")],
          ["Lugar", datos.lugar],
          ["Cupo", datos.cupo],
          ["Periodo", datos.periodo],
        ],
        boton: datos.id ? "Sí, guardar" : "Sí, crear grupo",
      }))
    )
      return;
    setGuardando(true);
    setError("");
    try {
      const cuerpo = { ...datos, cupo: Number(datos.cupo), docenteId: datos.docenteId || null };
      const r = datos.id ? await http.patch(`/deporte/admin/grupos/${datos.id}`, cuerpo) : await http.post("/deporte/admin/grupos", cuerpo);
      avisar(datos.id ? "Grupo actualizado." : "Grupo creado.");
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
        <Campo etiqueta="Docente asignado" ayuda={datos.docenteId ? "Solo este docente verá el grupo y tomará su asistencia." : "Regístralo en «Docentes» para que tome la asistencia desde su panel."}>
          <select value={datos.docenteId || ""} onChange={poner("docenteId")} className={claseCampo}>
            <option value="">Sin docente asignado</option>
            {(cat.docentes || [])
              .filter((d) => d.activo || d.id === datos.docenteId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                  {d.especialidad ? ` · ${d.especialidad}` : ""}
                </option>
              ))}
          </select>
        </Campo>
        {!datos.docenteId && (
          <Campo etiqueta="Instructor (solo nombre)">
            <input maxLength={150} value={datos.instructor || ""} onChange={poner("instructor")} className={claseCampo} />
          </Campo>
        )}
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
