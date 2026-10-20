import { useState } from "react";
import { Aviso, Campo, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { SelectorFoto, fotoInicial, guardarFoto } from "../../comunes/componentes/SelectorFoto";
import { http } from "../../../../lib/api/http";
import { fechaCorta, hoyISO } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";
import { SelectorCategorias, textoCategorias } from "../../comunes/Pastillas";

// Formulario para crear o editar un evento deportivo (con foto).

// ---- Eventos deportivos (RF-002) -------------------------------------------------------
export const EVENTO_VACIO = { nombre: "", tipo: "Torneo", disciplinaId: "", descripcion: "", fecha: "", horaInicio: "08:00", horaFin: "12:00", lugar: "", cupo: "", fechaLimite: "", horasReconocidas: "", categorias: [], estado: "Publicado" };

export function FormularioEvento({ cat, inicial, onGuardado, onCancelar }) {
  const [d, setD] = useState(inicial);
  const [foto, setFoto] = useState(() => fotoInicial(inicial.imagenUrl));
  const [error, setError] = useState("");
  const { confirmar, avisar } = useConfirmar();
  const poner = (k) => (e) => setD((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  async function guardar(e) {
    e.preventDefault();
    setError("");
    const publicar = d.estado === "Publicado";
    if (
      !(await confirmar({
        titulo: d.id ? "¿Guardar los cambios del evento?" : publicar ? "¿Publicar este evento?" : `¿Guardar el evento como ${d.estado.toLowerCase()}?`,
        mensaje: publicar ? "Los estudiantes lo verán en su área de Deporte y podrán inscribirse." : undefined,
        detalle: [
          ["Evento", d.nombre],
          ["Fecha", `${fechaCorta(d.fecha)} · ${d.horaInicio}–${d.horaFin}`],
          ["Cupo", d.cupo || "Sin límite"],
          ["Horas que suma", d.horasReconocidas ? `${d.horasReconocidas} h` : "Ninguna"],
          ["Pueden inscribirse", textoCategorias(d.categorias)],
        ],
        boton: d.id ? "Sí, guardar" : publicar ? "Sí, publicar" : "Sí, guardar",
      }))
    )
      return;
    try {
      const cuerpo = { ...d, cupo: d.cupo === "" ? null : Number(d.cupo), horasReconocidas: d.horasReconocidas === "" ? null : Number(d.horasReconocidas), fechaLimite: d.fechaLimite || null, disciplinaId: d.disciplinaId || null };
      const r = d.id ? await http.patch(`/deporte/admin/eventos/${d.id}`, cuerpo) : await http.post("/deporte/admin/eventos", cuerpo);
      // La foto va aparte: si falla, el evento igual queda guardado.
      const fallo = await guardarFoto(`/deporte/admin/eventos/${r.data.evento.id}/imagen`, foto, inicial.imagenUrl);
      avisar(fallo || (d.id ? "Evento actualizado." : publicar ? "Evento publicado." : "Evento guardado."), fallo ? "error" : "exito");
      const cambioFoto = !fallo && (foto.archivo || foto.quitar);
      onGuardado(cambioFoto ? (await http.get(`/deporte/admin/eventos/${r.data.evento.id}`)).data.evento : r.data.evento);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar el evento."));
    }
  }
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo etiqueta="Nombre" className="sm:col-span-2">
          <input required maxLength={150} value={d.nombre} onChange={poner("nombre")} placeholder="Torneo interfacultades de fútbol" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Tipo">
          <select value={d.tipo} onChange={poner("tipo")} className={claseCampo}>
            {(cat?.tiposEvento || []).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Disciplina (opcional)">
          <select value={d.disciplinaId || ""} onChange={poner("disciplinaId")} className={claseCampo}>
            <option value="">Varias / ninguna</option>
            {(cat?.disciplinas || []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" required min={d.id ? undefined : hoyISO()} value={d.fecha} onChange={poner("fecha")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Desde">
          <input type="time" required value={d.horaInicio} onChange={poner("horaInicio")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Hasta">
          <input type="time" required value={d.horaFin} onChange={poner("horaFin")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Lugar">
          <input maxLength={150} value={d.lugar || ""} onChange={poner("lugar")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Cupo" ayuda="Vacío = sin límite">
          <input type="number" min="1" value={d.cupo ?? ""} onChange={poner("cupo")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Inscripciones hasta" ayuda="Vacío = hasta el día del evento">
          <input type="date" max={d.fecha || undefined} value={d.fechaLimite || ""} onChange={poner("fechaLimite")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Horas que reconoce" ayuda="A quien asista (vacío = ninguna)">
          <input type="number" min="0.5" max="40" step="0.5" value={d.horasReconocidas ?? ""} onChange={poner("horasReconocidas")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Estado">
          <select value={d.estado} onChange={poner("estado")} className={claseCampo}>
            {["Publicado", "Borrador", "Cancelado", "Finalizado"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Descripción (opcional)" className="sm:col-span-2 lg:col-span-4">
          <textarea rows={3} maxLength={1500} value={d.descripcion || ""} onChange={poner("descripcion")} className={claseCampo} />
        </Campo>
      </div>
      <div>
        <p className="m-0 mb-2 text-sm font-semibold text-ink-600">Pueden inscribirse</p>
        <SelectorCategorias categorias={cat?.categorias || []} valor={d.categorias} onCambio={(c) => setD((x) => ({ ...x, categorias: c }))} />
      </div>
      <SelectorFoto foto={foto} onCambio={setFoto} etiqueta="Foto del evento (opcional)" ayuda="JPG, PNG o WEBP, hasta 5 MB. Si no subes ninguna, usamos la de la disciplina." />
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <button type="submit" className={botonPrimario}>
          {d.id ? "Guardar cambios" : d.estado === "Borrador" ? "Guardar borrador" : "Publicar evento"}
        </button>
        <button type="button" onClick={onCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
