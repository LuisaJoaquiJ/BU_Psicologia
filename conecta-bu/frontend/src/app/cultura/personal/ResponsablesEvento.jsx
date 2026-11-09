import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";
import { ROLES_EQUIPO } from "./rol";

const nombreDeRol = (id) => ROLES_EQUIPO.find((r) => r.id === id)?.nombre || id;

// Personas a cargo de un evento (opcional): una o mas del equipo. Ellas toman su asistencia;
// sin nadie, lo maneja la coordinacion.
// Si el evento es de un grupo, tambien cuenta el equipo de ese grupo.
export function ResponsablesEvento({ evento, equipo, alGuardar }) {
  const [elegidos, setElegidos] = useState(evento.responsablesEmails || []);
  const [mensaje, setMensaje] = useState({ tono: "", texto: "" });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setElegidos(evento.responsablesEmails || []), [evento.responsablesEmails]);

  const nombreDe = (email) => equipo.find((m) => m.email === email)?.nombre || email;
  const resumen = (evento.responsablesEmails || []).length ? (evento.responsablesEmails || []).map(nombreDe).join(", ") : "Solo la coordinación";

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje({ tono: "", texto: "" });
    try {
      await http.put(`/cultura/admin/agenda/${evento.id}/responsables`, { responsablesEmails: elegidos });
      setMensaje({ tono: "ok", texto: "Quedó guardado." });
      alGuardar?.();
    } catch (err) {
      setMensaje({ tono: "error", texto: mensajeError(err, "No fue posible guardar.") });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="mt-3">
      <summary className="min-h-[44px] flex items-center gap-2 text-sm font-semibold cursor-pointer">
        A cargo del evento
        <span className="text-ink-500 font-normal truncate">{resumen}</span>
      </summary>
      <form onSubmit={guardar} className="mt-1 grid gap-3">
        <ul className="list-none m-0 p-0 flex flex-wrap gap-x-4 gap-y-1">
          {equipo.map((m) => (
            <li key={m.email}>
              <label className="inline-flex items-center gap-2 min-h-[36px] text-sm">
                <input type="checkbox" checked={elegidos.includes(m.email)} onChange={() => setElegidos((l) => (l.includes(m.email) ? l.filter((x) => x !== m.email) : [...l, m.email]))} />
                {m.nombre || m.email} <span className="text-ink-500">· {nombreDeRol(m.rol)}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={guardando} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar responsables"}
          </button>
          <p role="status" className={`m-0 text-sm font-semibold ${mensaje.tono === "error" ? "text-red-700" : "text-[#0B6B61]"}`}>
            {mensaje.texto}
          </p>
        </div>
      </form>
    </details>
  );
}
