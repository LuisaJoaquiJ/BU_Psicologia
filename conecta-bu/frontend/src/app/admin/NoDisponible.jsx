import { useEffect, useState } from "react";
import { http } from "../../lib/api/http";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Icono } from "../../components/Iconos";
import { Aviso, Campo, botonPrimario, claseCampo } from "../../components/ui";

// "No estaré disponible": el profesional marca el tiempo en que no atiende
// (compromiso institucional, incapacidad, permiso, salida...). Esos horarios
// dejan de ofrecerse a los estudiantes. El motivo solo lo ve el personal.

export const MOTIVOS = [
  ["Compromiso institucional", "escudo"],
  ["Reunión", "usuarios"],
  ["Capacitación", "birrete"],
  ["Salida institucional", "bus"],
  ["Permiso laboral", "archivo"],
  ["Incapacidad", "pulso"],
  ["Vacaciones", "estrella"],
  ["Calamidad doméstica", "alerta"],
  ["Otro", "editar"],
];

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function textoBloqueo(b) {
  const dias =
    b.fechaInicio === b.fechaFin
      ? fechaLarga(`${b.fechaInicio}T12:00:00Z`)
      : `${fechaLarga(`${b.fechaInicio}T12:00:00Z`)} al ${fechaLarga(`${b.fechaFin}T12:00:00Z`).toLowerCase()}`;
  const horas = b.todoElDia ? "todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`;
  return `${dias} · ${horas}`;
}

export function FormularioNoDisponible({ api = "/admin", fechaInicial, alGuardar }) {
  const [v, setV] = useState({
    motivo: "",
    detalle: "",
    varios: false,
    fechaInicio: fechaInicial && fechaInicial >= hoyISO() ? fechaInicial : hoyISO(),
    fechaFin: "",
    todoElDia: true,
    horaInicio: "08:00",
    horaFin: "12:00",
  });
  const [afectadas, setAfectadas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const cuerpo = {
    motivo: v.motivo || "Otro",
    detalle: v.detalle || "-",
    fechaInicio: v.fechaInicio,
    fechaFin: v.varios && v.fechaFin ? v.fechaFin : v.fechaInicio,
    todoElDia: v.todoElDia,
    horaInicio: v.horaInicio,
    horaFin: v.horaFin,
  };
  const clave = JSON.stringify([cuerpo.fechaInicio, cuerpo.fechaFin, cuerpo.todoElDia, cuerpo.horaInicio, cuerpo.horaFin]);

  // Muestra antes de guardar las citas que se cancelarian.
  useEffect(() => {
    const t = setTimeout(() => {
      http
        .post(`${api}/horarios/bloqueos/citas-afectadas`, cuerpo)
        .then((res) => setAfectadas(res.data.citas))
        .catch(() => setAfectadas([]));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, api]);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (!v.motivo) {
      setError("Elige el motivo.");
      return;
    }
    setEnviando(true);
    try {
      const res = await http.post(`${api}/horarios/bloqueos`, { ...cuerpo, detalle: v.detalle, confirmar: afectadas.length > 0 });
      await alGuardar(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos guardar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <section className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-3">
        <h3 className="m-0 text-lg font-extrabold">¿Por qué no vas a estar disponible?</h3>
        <p className="m-0 text-sm text-ink-500">Los estudiantes no ven el motivo: solo dejan de ver horarios en ese tiempo.</p>
        <div role="radiogroup" aria-label="Motivo" className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {MOTIVOS.map(([m, icono]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={v.motivo === m}
              onClick={() => setV((x) => ({ ...x, motivo: m }))}
              className={`flex items-center gap-2.5 min-h-[52px] px-3 rounded-2xl border-[1.5px] text-left text-sm font-bold transition-colors ${
                v.motivo === m ? "border-primary bg-primary-light text-primary-dark" : "border-gray-200 bg-white text-ink-900 hover:border-primary/50"
              }`}
            >
              <Icono nombre={icono} size={18} strokeWidth={2} className="shrink-0 text-primary" />
              {m}
            </button>
          ))}
        </div>
        <Campo etiqueta={v.motivo === "Otro" ? "Cuéntanos el motivo" : "Detalle (opcional)"}>
          <input
            required={v.motivo === "Otro"}
            value={v.detalle}
            onChange={set("detalle")}
            maxLength={300}
            placeholder="Ej.: Comité de Bienestar en rectoría"
            className={claseCampo}
          />
        </Campo>
      </section>

      <section className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-4">
        <h3 className="m-0 text-lg font-extrabold">¿Cuándo?</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2.5 min-h-[44px] text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={v.varios} onChange={set("varios")} className="w-5 h-5 accent-[#19407B]" />
            Son varios días seguidos
          </label>
          <label className="flex items-center gap-2.5 min-h-[44px] text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={v.todoElDia} onChange={set("todoElDia")} className="w-5 h-5 accent-[#19407B]" />
            Todo el día
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta={v.varios ? "Desde" : "Día"}>
            <input required type="date" min={hoyISO()} value={v.fechaInicio} onChange={set("fechaInicio")} className={claseCampo} />
          </Campo>
          {v.varios && (
            <Campo etiqueta="Hasta">
              <input required type="date" min={v.fechaInicio} value={v.fechaFin} onChange={set("fechaFin")} className={claseCampo} />
            </Campo>
          )}
          {!v.todoElDia && (
            <>
              <Campo etiqueta="Desde las">
                <input required type="time" value={v.horaInicio} onChange={set("horaInicio")} className={claseCampo} />
              </Campo>
              <Campo etiqueta="Hasta las">
                <input required type="time" value={v.horaFin} onChange={set("horaFin")} className={claseCampo} />
              </Campo>
            </>
          )}
        </div>
      </section>

      {afectadas.length > 0 && (
        <div className="rounded-[18px] border border-[#F2C46D] bg-[#FFF6E0] p-5 text-[#5C4206]">
          <p className="m-0 font-extrabold">
            {afectadas.length === 1 ? "Hay 1 cita agendada en ese tiempo." : `Hay ${afectadas.length} citas agendadas en ese tiempo.`} Al guardar se cancelan y
            se avisa a {afectadas.length === 1 ? "el estudiante" : "los estudiantes"}:
          </p>
          <ul className="mt-2 mb-0 pl-5 text-sm">
            {afectadas.map((c) => (
              <li key={c.id}>
                {c.estudiante} · {c.servicio} · {fechaLarga(`${c.fecha}T12:00:00Z`)} {formatearHora(c.horaInicio)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end">
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? "Guardando…" : afectadas.length ? `Guardar y cancelar ${afectadas.length === 1 ? "la cita" : `${afectadas.length} citas`}` : "Guardar"}
        </button>
      </div>
    </form>
  );
}
