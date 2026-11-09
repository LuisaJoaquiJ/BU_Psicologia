import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { mensajeError } from "../comun/formato";
import { campo } from "./Marco";

// Equipo a cargo de un grupo: el docente que lo dirige y los monitores que ayudan. Se
// eligen entre las personas del equipo segun su rol (solo lo ve el administrador del area).
export function ResponsablesGrupo({ grupo, equipo, alGuardar }) {
  // Dirige un docente o la coordinacion; ayudan docentes y monitores. Siempre hay al menos una persona.
  const directores = equipo.filter((m) => m.rol === "docente" || m.rol === "administrador");
  const [docente, setDocente] = useState(grupo.docenteEmail || "");
  const [elegidos, setElegidos] = useState(grupo.monitoresEmails || []);
  const [mensaje, setMensaje] = useState({ tono: "", texto: "" });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setDocente(grupo.docenteEmail || "");
    setElegidos(grupo.monitoresEmails || []);
  }, [grupo.docenteEmail, grupo.monitoresEmails]);

  const ayudantes = equipo.filter((m) => (m.rol === "docente" || m.rol === "monitor") && m.email !== docente);
  const sinNadie = !docente && elegidos.length === 0;
  const nombreDe = (email) => equipo.find((m) => m.email === email)?.nombre || email;
  const resumen = [
    grupo.docenteEmail ? `Dirige: ${nombreDe(grupo.docenteEmail)}` : "Sin quien dirija",
    `${(grupo.monitoresEmails || []).length} ${(grupo.monitoresEmails || []).length === 1 ? "ayudante" : "ayudantes"}`,
  ].join(" · ");

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setMensaje({ tono: "", texto: "" });
    try {
      await http.put(`/cultura/admin/grupos/${grupo.id}/responsables`, { docenteEmail: docente || null, monitoresEmails: elegidos });
      setMensaje({ tono: "ok", texto: "Quedó guardado." });
      alGuardar?.();
    } catch (err) {
      setMensaje({ tono: "error", texto: mensajeError(err, "No fue posible guardar los responsables.") });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <details className="mt-3">
      <summary className="min-h-[44px] flex items-center gap-2 text-sm font-semibold cursor-pointer">
        Responsables del grupo
        <span className="text-ink-500 font-normal">{resumen}</span>
      </summary>
      <form onSubmit={guardar} className="mt-1 grid gap-3">
        {equipo.length === 0 ? (
          <p className="m-0 text-sm text-ink-500">Cuando haya docentes y monitores en el equipo podrás asignarlos aquí.</p>
        ) : (
          <>
            <label className="text-sm font-semibold">
              Quién dirige el grupo
              <select className={`${campo} w-full mt-1`} value={docente} onChange={(e) => setDocente(e.target.value)}>
                <option value="">Nadie (deben ayudar otras personas)</option>
                {directores.map((m) => (
                  <option key={m.email} value={m.email}>
                    {m.nombre || m.email} · {m.rol === "administrador" ? "Coordinación" : "Docente"}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="m-0 p-0 border-0">
              <legend className="text-sm font-semibold mb-1">Quiénes ayudan</legend>
              {ayudantes.length === 0 ? (
                <p className="m-0 text-sm text-ink-500">No hay más docentes ni monitores en el equipo.</p>
              ) : (
                <ul className="list-none m-0 p-0 flex flex-wrap gap-x-4 gap-y-1">
                  {ayudantes.map((m) => (
                    <li key={m.email}>
                      <label className="inline-flex items-center gap-2 min-h-[36px] text-sm">
                        <input type="checkbox" checked={elegidos.includes(m.email)} onChange={() => setElegidos((l) => (l.includes(m.email) ? l.filter((x) => x !== m.email) : [...l, m.email]))} />
                        {m.nombre || m.email} <span className="text-ink-500">· {m.rol === "docente" ? "Docente" : "Monitor"}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={guardando || equipo.length === 0 || sinNadie} className="boton-liquido min-h-[44px] px-4 rounded-full font-bold disabled:opacity-60">
            {guardando ? "Guardando…" : "Guardar responsables"}
          </button>
          {sinNadie && equipo.length > 0 && <p className="m-0 text-sm text-ink-500">Debe haber al menos una persona a cargo.</p>}
          <p role="status" className={`m-0 text-sm font-semibold ${mensaje.tono === "error" ? "text-red-700" : "text-[#0B6B61]"}`}>
            {mensaje.texto}
          </p>
        </div>
      </form>
    </details>
  );
}
