import { useEffect, useState } from "react";
import { Aviso, Campo, Vacio, botonPrimario, botonSecundario, claseCampo } from "../../comunes/componentes/ui";
import { useConfirmar } from "../../comunes/componentes/Confirmar";
import { Icono } from "../../comunes/componentes/Iconos";
import { http } from "../../../../lib/api/http";
import { fechaCorta, horas, hoyISO } from "../../comunes/lib/deporte";
import { mensajeError } from "../../comunes/lib/salud";

// Reconocer horas a un estudiante (torneos, representación, eventos externos).

// Reconocer horas por torneos, representacion o eventos externos. "detalle"
// es la respuesta de /estudiantes/:id (estudiante, total...).
export function FormularioHoras({ cat, detalle: d, onGuardado, onCancelar }) {
  const [form, setForm] = useState({ horas: "", motivo: "", disciplinaId: "", fecha: hoyISO() });
  const [error, setError] = useState("");
  const { confirmar, avisar } = useConfirmar();
  async function reconocer(e) {
    e.preventDefault();
    setError("");
    if (
      !(await confirmar({
        titulo: `¿Reconocer ${horas(Number(form.horas))} a ${d.estudiante.nombre}?`,
        mensaje: `Pasaría de ${horas(d.total)} a ${horas(d.total + Number(form.horas))}.`,
        detalle: [["Motivo", form.motivo], ["Fecha", fechaCorta(form.fecha)], ["Disciplina", cat?.disciplinas.find((x) => x.id === form.disciplinaId)?.nombre || "Sin disciplina"]],
        boton: "Sí, reconocer",
      }))
    )
      return;
    try {
      const r = await http.post(`/deporte/admin/estudiantes/${d.estudiante.id}/horas`, { ...form, horas: Number(form.horas), disciplinaId: form.disciplinaId || undefined });
      avisar(`Horas reconocidas a ${d.estudiante.nombre}.`);
      onGuardado(r.data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible guardar."));
    }
  }
  return (
    <form onSubmit={reconocer} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-ink-600">
        Torneos, representación institucional, eventos deportivos… <strong className="text-ink-900">{d.estudiante.nombre}</strong> lleva {horas(d.total)} de {d.requeridas}.
      </p>
      <div className="grid gap-3 grid-cols-2">
        <Campo etiqueta="Horas">
          <input type="number" min="0.5" max="40" step="0.5" required value={form.horas} onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))} className={claseCampo} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" required max={hoyISO()} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} className={claseCampo} />
        </Campo>
      </div>
      <Campo etiqueta="Motivo">
        <input required maxLength={200} value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Torneo regional de voleibol" className={claseCampo} />
      </Campo>
      <Campo etiqueta="Disciplina (opcional)">
        <select value={form.disciplinaId} onChange={(e) => setForm((f) => ({ ...f, disciplinaId: e.target.value }))} className={claseCampo}>
          <option value="">Sin disciplina</option>
          {cat?.disciplinas.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nombre}
            </option>
          ))}
        </select>
      </Campo>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex gap-2">
        <button type="submit" className={botonPrimario}>
          Reconocer horas
        </button>
        <button type="button" onClick={onCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Desde la lista: buscar al estudiante y luego reconocerle las horas.
export function ReconocerDesdeLista({ cat, onCerrar, onGuardado }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) return setResultados(null);
    const t = setTimeout(() => {
      http.get("/deporte/admin/estudiantes", { params: { q: q.trim() } }).then((r) => setResultados(r.data.estudiantes.slice(0, 8)));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  async function elegir(e) {
    setError("");
    try {
      setElegido((await http.get(`/deporte/admin/estudiantes/${e.id}`)).data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible cargar al estudiante."));
    }
  }
  if (elegido)
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setElegido(null)} className="self-start text-sm font-bold text-primary-soft inline-flex items-center gap-1">
          <Icono nombre="izquierda" size={15} /> Elegir otro estudiante
        </button>
        <FormularioHoras cat={cat} detalle={elegido} onCancelar={onCerrar} onGuardado={onGuardado} />
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="¿A quién?" ayuda="Escribe al menos 2 letras del nombre o del correo.">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o correo del estudiante" className={claseCampo} />
      </Campo>
      {error && <Aviso>{error}</Aviso>}
      {resultados && resultados.length === 0 && <Vacio>No encontramos estudiantes con «{q}».</Vacio>}
      {resultados?.length > 0 && (
        <ul className="list-none m-0 p-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {resultados.map((e) => (
            <li key={e.id} className="border-t border-gray-100 first:border-t-0">
              <button type="button" onClick={() => elegir(e)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="flex-1 min-w-0 leading-tight">
                  <span className="block font-semibold text-ink-900 truncate">{e.nombre}</span>
                  <span className="block text-xs text-ink-500 truncate">
                    {e.categoria} · {e.email}
                  </span>
                </span>
                <span className="text-sm text-ink-600 tabular-nums whitespace-nowrap">{horas(e.total)}</span>
                <Icono nombre="derecha" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
