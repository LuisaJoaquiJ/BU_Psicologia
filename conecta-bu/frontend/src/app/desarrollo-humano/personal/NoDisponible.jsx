import { useEffect, useState } from "react";
import { http } from "../../../lib/api/http";
import { fechaLarga, formatearHora } from "../comunes/lib/format";
import { Icono } from "../comunes/componentes/Iconos";
import { Aviso, Campo, botonPrimario, claseCampo } from "../comunes/componentes/ui";

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

  // Muestra antes de guardar las citas que se cancelarían.
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
    <form onSubmit={guardar} className="flex flex-col gap-4 max-w-[820px]">
      <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 sm:p-6 flex flex-col gap-3.5">
        <div>
          <h3 className="m-0 text-lg font-extrabold text-ink-900">¿Por qué no vas a estar disponible?</h3>
          <p className="mt-1 mb-0 text-sm text-ink-500">Los estudiantes no ven el motivo: solo dejan de ver horarios en ese tiempo.</p>
        </div>

        <div role="radiogroup" aria-label="Motivo" className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {MOTIVOS.map(([m, icono]) => {
            const activo = v.motivo === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setV((x) => ({ ...x, motivo: m }))}
                className={`flex items-center gap-2.5 min-h-[46px] px-3.5 rounded-xl border-[1.5px] text-left text-xs sm:text-sm font-bold cursor-pointer transition-all duration-150 ${
                  activo
                    ? "border-[#19407B] bg-[#EBF2FA] text-[#19407B]"
                    : "border-transparent bg-[#F4F6F9] text-ink-700 hover:bg-[#EAEFF5] hover:text-ink-900"
                }`}
              >
                <Icono
                  nombre={icono}
                  size={18}
                  strokeWidth={2}
                  className={`shrink-0 ${activo ? "text-[#19407B]" : "text-ink-500"}`}
                />
                <span className="leading-tight">{m}</span>
              </button>
            );
          })}
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

      <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5 sm:p-6 flex flex-col gap-4">
        <h3 className="m-0 text-lg font-extrabold text-ink-900">¿Cuándo?</h3>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <label className="flex items-center gap-2.5 min-h-[40px] text-sm font-bold text-ink-700 cursor-pointer select-none">
            <input type="checkbox" checked={v.varios} onChange={set("varios")} className="w-4 h-4 rounded accent-[#19407B]" />
            Son varios días seguidos
          </label>

          <div role="radiogroup" aria-label="Horas" className="inline-flex rounded-xl bg-gray-100/90 p-1 gap-1">
            {[
              [true, "Todo el día"],
              [false, "Solo unas horas"],
            ].map(([valor, texto]) => {
              const activo = v.todoElDia === valor;
              return (
                <button
                  key={texto}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setV((x) => ({ ...x, todoElDia: valor }))}
                  className={`min-h-[36px] px-3.5 rounded-lg text-xs sm:text-sm font-bold cursor-pointer transition-all duration-150 ${
                    activo
                      ? "bg-white text-[#19407B] shadow-sm ring-1 ring-gray-200/80"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {texto}
                </button>
              );
            })}
          </div>
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
        {!v.todoElDia && v.varios && <p className="m-0 text-xs text-ink-500">Ese horario se repite cada día del rango.</p>}
      </section>

      {afectadas.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 text-amber-950">
          <p className="m-0 text-sm font-extrabold">
            {afectadas.length === 1 ? "Hay 1 cita agendada en ese tiempo." : `Hay ${afectadas.length} citas agendadas en ese tiempo.`} Al guardar se cancelan y
            se avisa a {afectadas.length === 1 ? "el estudiante" : "los estudiantes"}:
          </p>
          <ul className="mt-2 mb-0 pl-5 text-xs sm:text-sm text-amber-900 space-y-1">
            {afectadas.map((c) => (
              <li key={c.id}>
                {c.estudiante} · {c.servicio} · {fechaLarga(`${c.fecha}T12:00:00Z`)} {formatearHora(c.horaInicio)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <Aviso>{error}</Aviso>}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={enviando}
          className={`${botonPrimario} w-full sm:w-auto px-6 disabled:cursor-not-allowed`}
        >
          {enviando
            ? "Guardando…"
            : afectadas.length
            ? `Guardar y cancelar ${afectadas.length === 1 ? "la cita" : `${afectadas.length} citas`}`
            : "Guardar ausencia"}
        </button>
      </div>
    </form>
  );
}