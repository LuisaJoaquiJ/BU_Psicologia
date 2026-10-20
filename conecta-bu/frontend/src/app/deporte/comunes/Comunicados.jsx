import { useState } from "react";
import { Aviso, Campo, Insignia, botonPrimario, botonSecundario, claseCampo, claseCampoCorto } from "./componentes/ui";
import { useConfirmar } from "./componentes/Confirmar";
import { Icono } from "./componentes/Iconos";
import { FotoDeporte, SelectorFoto, fotoInicial, guardarFoto } from "./componentes/SelectorFoto";
import { http } from "../../../lib/api/http";
import { fechaCorta, hoyISO } from "./lib/deporte";
import { mensajeError } from "./lib/salud";
import { Pastillas } from "./Pastillas";

// Comunicados (RF-011): tarjeta y formulario, compartidos por la coordinación,
// el docente y el estudiante.

// ---- Comunicados (RF-011) ---------------------------------------------------------------
const TONO_PRIORIDAD = { Informativa: "azul", Importante: "dorado", Urgente: "rojo" };

const BORDE_PRIORIDAD = { Informativa: "border-l-[#2a78d6]", Importante: "border-l-[#d97706]", Urgente: "border-l-red-600" };

export function TarjetaComunicado({ a, onEliminar }) {
  return (
    <article className={`bg-white border border-gray-200 border-l-[5px] ${BORDE_PRIORIDAD[a.prioridad]} rounded-2xl p-4 flex flex-col gap-1.5`}>
      <div className="flex justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 items-center">
          <Insignia tono={TONO_PRIORIDAD[a.prioridad]}>{a.prioridad}</Insignia>
          <span className="text-xs font-semibold text-ink-500">Para: {a.destino || "Todos los inscritos"}</span>
        </div>
        <span className="text-xs text-ink-500">{new Date(a.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
      </div>
      <h3 className="m-0 text-base font-extrabold text-ink-900">{a.titulo}</h3>
      <p className="m-0 text-sm text-ink-700 whitespace-pre-line">{a.mensaje}</p>
      {(a.vistaFoto || a.imagenUrl) && (
        <FotoDeporte url={a.vistaFoto ? null : a.imagenUrl} respaldo={a.vistaFoto} alt={`Imagen del comunicado ${a.titulo}`} className="w-full max-h-[260px] rounded-xl mt-1" />
      )}
      <div className="flex justify-between items-center gap-2 flex-wrap text-xs text-ink-500">
        <span>
          {a.autor ? `${a.autor}` : ""}
          {a.alcanzados !== undefined ? ` · llega a ${a.alcanzados} estudiante${a.alcanzados === 1 ? "" : "s"}` : ""}
          {a.vigenteHasta ? ` · visible hasta ${fechaCorta(a.vigenteHasta)}` : ""}
        </span>
        {onEliminar && (
          <button type="button" onClick={onEliminar} className="font-bold text-ink-500 hover:text-red-600">
            Eliminar
          </button>
        )}
      </div>
    </article>
  );
}

// Formulario de comunicado. "grupos" limita los grupos posibles (docente).
export function FormularioComunicado({ cat, grupos, soloGrupo = false, api = "/deporte/admin", onEnviado, onCancelar }) {
  const inicial = { titulo: "", mensaje: "", prioridad: "Informativa", alcance: soloGrupo ? "Grupo" : "Todos", disciplinaId: "", grupoId: grupos?.[0]?.id || "", vigenteHasta: "" };
  const [d, setD] = useState(inicial);
  const [foto, setFoto] = useState(() => fotoInicial(null));
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { confirmar, avisar } = useConfirmar();
  const poner = (k) => (e) => setD((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  async function enviar(e) {
    e.preventDefault();
    if (
      !(await confirmar({
        titulo: "¿Enviar este comunicado?",
        mensaje: "Les aparecerá a los estudiantes en su área de Deporte.",
        detalle: [["Para", destino], ["Prioridad", d.prioridad], ["Título", d.titulo], ["Imagen", foto.archivo ? foto.archivo.name : "Sin imagen"], ["Visible hasta", d.vigenteHasta ? fechaCorta(d.vigenteHasta) : "Sin fecha límite"]],
        boton: "Sí, enviar",
      }))
    )
      return;
    setEnviando(true);
    setError("");
    try {
      const r = await http.post(`${api}/alertas`, { ...d, vigenteHasta: d.vigenteHasta || null });
      const fallo = await guardarFoto(`${api}/alertas/${r.data.alerta.id}/imagen`, foto, null);
      setD({ ...inicial, grupoId: d.grupoId });
      setFoto(fotoInicial(null));
      avisar(`Comunicado enviado: le llega a ${r.data.alerta.alcanzados} estudiante${r.data.alerta.alcanzados === 1 ? "" : "s"}.${fallo ? ` ${fallo}` : ""}`, fallo ? "error" : "exito");
      onEnviado(r.data.alerta);
    } catch (err) {
      setError(mensajeError(err, "No fue posible enviar el comunicado."));
    } finally {
      setEnviando(false);
    }
  }
  const destino =
    d.alcance === "Grupo"
      ? grupos?.find((g) => g.id === d.grupoId)?.nombre || "(elige el grupo)"
      : d.alcance === "Disciplina"
        ? cat?.disciplinas.find((x) => x.id === d.disciplinaId)?.nombre || "(elige la disciplina)"
        : "Todos los inscritos";
  return (
    <form onSubmit={enviar} className="grid gap-5 lg:grid-cols-[1.2fr_1fr] items-start">
      <div className="flex flex-col gap-3">
        {!soloGrupo && (
          <div>
            <p className="m-0 mb-2 text-sm font-semibold text-ink-600">¿A quién le llega?</p>
            <Pastillas etiqueta="Alcance" opciones={[["Todos", "Todos los inscritos"], ["Disciplina", "Una disciplina"], ["Grupo", "Un grupo"]]} valor={d.alcance} onCambio={poner("alcance")} />
          </div>
        )}
        {d.alcance === "Disciplina" && (
          <Campo etiqueta="Disciplina">
            <select required value={d.disciplinaId} onChange={poner("disciplinaId")} className={claseCampo}>
              <option value="">Elige la disciplina</option>
              {cat?.disciplinas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {d.alcance === "Grupo" && (
          <Campo etiqueta="Grupo">
            <select required value={d.grupoId} onChange={poner("grupoId")} className={claseCampo}>
              <option value="">Elige el grupo</option>
              {(grupos || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div>
          <p className="m-0 mb-2 text-sm font-semibold text-ink-600">Prioridad</p>
          <Pastillas etiqueta="Prioridad" opciones={cat?.prioridades || ["Informativa", "Importante", "Urgente"]} valor={d.prioridad} onCambio={poner("prioridad")} />
        </div>
        <Campo etiqueta="Título">
          <input required maxLength={120} value={d.titulo} onChange={poner("titulo")} placeholder="Cambio de escenario el lunes" className={claseCampo} />
        </Campo>
        <Campo etiqueta="Mensaje">
          <textarea required rows={4} maxLength={2000} value={d.mensaje} onChange={poner("mensaje")} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Visible hasta (opcional)">
          <input type="date" min={hoyISO()} value={d.vigenteHasta} onChange={poner("vigenteHasta")} className={claseCampoCorto} />
        </Campo>
        <SelectorFoto foto={foto} onCambio={setFoto} etiqueta="Imagen (opcional)" ayuda="Un afiche, un mapa del escenario… JPG, PNG o WEBP, hasta 5 MB." />
        {error && <Aviso>{error}</Aviso>}
        <div>
          <button type="submit" disabled={enviando} className={botonPrimario}>
            <Icono nombre="chat" size={16} /> {enviando ? "Enviando…" : "Enviar comunicado"}
          </button>
          {onCancelar && (
            <button type="button" onClick={onCancelar} className={`${botonSecundario} ml-2`}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:sticky lg:top-4">
        <p className="m-0 text-sm font-semibold text-ink-600">Así lo verán los estudiantes</p>
        <TarjetaComunicado a={{ ...d, titulo: d.titulo || "Título del comunicado", mensaje: d.mensaje || "Escribe el mensaje…", fecha: new Date().toISOString(), destino, vigenteHasta: d.vigenteHasta || null, vistaFoto: foto.vista }} />
      </div>
    </form>
  );
}
