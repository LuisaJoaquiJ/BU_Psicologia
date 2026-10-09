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
];
const OTRO = "__otro__";

// Franjas de una hora que se pueden marcar (7 a. m. a 7 p. m.).
const HORAS = Array.from({ length: 12 }, (_, i) => 7 + i);
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const horaCorta = (h) => (h === 12 ? "12 m." : h < 12 ? `${h} a. m.` : `${h - 12} p. m.`);

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoyISO = () => isoDia(new Date());
const largo = (iso) => fechaLarga(`${iso}T12:00:00Z`);

export function textoBloqueo(b) {
  const dias = b.fechaInicio === b.fechaFin ? largo(b.fechaInicio) : `${largo(b.fechaInicio)} al ${largo(b.fechaFin).toLowerCase()}`;
  const horas = b.todoElDia ? "todo el día" : `${formatearHora(b.horaInicio)} a ${formatearHora(b.horaFin)}`;
  return `${dias} · ${horas}`;
}

// Calendario pequeño para elegir un dia o varios dias seguidos: se toca el
// primero y, si son varios, el ultimo.
function ElegirDias({ desde, hasta, abierto, onCambiar }) {
  const hoy = hoyISO();
  const base = new Date(`${desde || hoy}T12:00:00`);
  const [mes, setMes] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const fin = hasta || desde;

  const celdas = [];
  for (let i = 0; i < (mes.getDay() + 6) % 7; i++) celdas.push(null);
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= total; d++) celdas.push(isoDia(new Date(mes.getFullYear(), mes.getMonth(), d)));

  function tocar(dia) {
    // "abierto": ya se toco el primer dia y falta (si se quiere) el ultimo.
    if (abierto && dia > desde) onCambiar(desde, dia, false);
    else onCambiar(dia, null, true);
  }
  const mover = (n) => setMes(new Date(mes.getFullYear(), mes.getMonth() + n, 1));
  const enMesActual = mes.getFullYear() === new Date().getFullYear() && mes.getMonth() === new Date().getMonth();

  return (
    <div className="w-full max-w-[380px]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={enMesActual}
          onClick={() => mover(-1)}
          className="w-10 h-10 rounded-full grid place-items-center text-primary hover:bg-primary-light disabled:opacity-30"
        >
          <Icono nombre="izquierda" size={18} strokeWidth={2.2} />
        </button>
        <span className="font-extrabold first-letter:uppercase">{mes.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}</span>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => mover(1)}
          className="w-10 h-10 rounded-full grid place-items-center text-primary hover:bg-primary-light"
        >
          <Icono nombre="derecha" size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-bold text-ink-500 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {celdas.map((dia, i) => {
          if (!dia) return <span key={`v${i}`} />;
          const pasado = dia < hoy;
          const extremo = dia === desde || dia === fin;
          const dentro = desde && dia > desde && dia < fin;
          return (
            <button
              key={dia}
              type="button"
              disabled={pasado}
              onClick={() => tocar(dia)}
              aria-pressed={extremo || !!dentro}
              aria-label={largo(dia)}
              className={`h-11 text-sm font-bold tabular-nums transition-colors ${
                extremo
                  ? "bg-primary-dark text-white rounded-full"
                  : dentro
                    ? "bg-primary-light text-primary-dark"
                    : pasado
                      ? "text-ink-500/40"
                      : `rounded-full hover:bg-primary-light ${dia === hoy ? "ring-1 ring-inset ring-primary text-primary" : "text-ink-900"}`
              }`}
            >
              {Number(dia.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Franjas de una hora: se toca la primera y la ultima hora que no estara.
function ElegirHoras({ desde, hasta, abierto, onCambiar }) {
  const fin = hasta ?? desde;
  function tocar(h) {
    if (abierto && h > desde) onCambiar(desde, h, false);
    else onCambiar(h, null, true);
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {HORAS.map((h) => {
        const marcada = desde !== null && h >= desde && h <= fin;
        return (
          <button
            key={h}
            type="button"
            onClick={() => tocar(h)}
            aria-pressed={marcada}
            className={`min-h-[48px] rounded-xl border-[1.5px] text-sm font-bold tabular-nums transition-colors ${
              marcada ? "border-primary-dark bg-primary-dark text-white" : "border-gray-200 bg-white text-ink-900 hover:border-primary/60"
            }`}
          >
            {horaCorta(h)}
          </button>
        );
      })}
    </div>
  );
}

export function FormularioNoDisponible({ api = "/admin", fechaInicial, alGuardar }) {
  const [motivo, setMotivo] = useState("");
  const [otroMotivo, setOtroMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [dias, setDias] = useState({ desde: fechaInicial && fechaInicial >= hoyISO() ? fechaInicial : hoyISO(), hasta: null, abierto: false });
  const [todoElDia, setTodoElDia] = useState(true);
  const [horas, setHoras] = useState({ desde: 8, hasta: 11, abierto: false });
  const [afectadas, setAfectadas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const motivoFinal = motivo === OTRO ? otroMotivo.trim() : motivo;
  const finHora = (horas.hasta ?? horas.desde) + 1;
  const cuerpo = {
    motivo: motivoFinal || "Revisión",
    detalle,
    fechaInicio: dias.desde,
    fechaFin: dias.hasta || dias.desde,
    todoElDia,
    horaInicio: hh(horas.desde ?? 8),
    horaFin: hh(finHora),
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
    if (!motivo) return setError("Elige el motivo.");
    if (motivo === OTRO && motivoFinal.length < 3) return setError("Escribe el motivo.");
    setEnviando(true);
    try {
      const res = await http.post(`${api}/horarios/bloqueos`, { ...cuerpo, motivo: motivoFinal, confirmar: afectadas.length > 0 });
      await alGuardar(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos guardar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const resumenDias = dias.hasta ? `Del ${largo(dias.desde).toLowerCase()} al ${largo(dias.hasta).toLowerCase()}` : largo(dias.desde);
  const resumenHoras = todoElDia ? "todo el día" : `de ${horaCorta(horas.desde)} a ${horaCorta(finHora)}`;

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <section className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-3">
        <h3 className="m-0 text-lg font-extrabold">¿Por qué no vas a estar disponible?</h3>
        <p className="m-0 text-sm text-ink-500">Los estudiantes no ven el motivo: solo dejan de ver horarios en ese tiempo.</p>
        <div role="radiogroup" aria-label="Motivo" className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          {[...MOTIVOS, ["Otro motivo", "editar", OTRO]].map(([texto, icono, valor = texto]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={motivo === valor}
              onClick={() => setMotivo(valor)}
              className={`flex items-center gap-2.5 min-h-[52px] px-3 rounded-2xl border-[1.5px] text-left text-sm font-bold transition-colors ${
                motivo === valor ? "border-primary bg-primary-light text-primary-dark" : "border-gray-200 bg-white text-ink-900 hover:border-primary/50"
              }`}
            >
              <Icono nombre={icono} size={18} strokeWidth={2} className="shrink-0 text-primary" />
              {texto}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {motivo === OTRO && (
            <Campo etiqueta="Escribe el motivo">
              <input
                autoFocus
                required
                value={otroMotivo}
                onChange={(e) => setOtroMotivo(e.target.value)}
                maxLength={60}
                placeholder="Ej.: Jurado de grado"
                className={claseCampo}
              />
            </Campo>
          )}
          <Campo etiqueta="Detalle (opcional)" className={motivo === OTRO ? "" : "sm:col-span-2"}>
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={300}
              placeholder="Ej.: Comité de Bienestar en rectoría"
              className={claseCampo}
            />
          </Campo>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-3">
          <h3 className="m-0 text-lg font-extrabold">¿Qué días?</h3>
          <p className="m-0 text-sm text-ink-500">Toca el día. Si son varios días seguidos, toca el primero y después el último.</p>
          <ElegirDias desde={dias.desde} hasta={dias.hasta} abierto={dias.abierto} onCambiar={(desde, hasta, abierto) => setDias({ desde, hasta, abierto })} />
          <p className="m-0 font-bold text-primary-dark first-letter:uppercase" aria-live="polite">
            {resumenDias}
          </p>
        </section>

        <section className="bg-white rounded-[18px] p-5 sm:p-6 flex flex-col gap-3">
          <h3 className="m-0 text-lg font-extrabold">¿A qué horas?</h3>
          <div role="radiogroup" aria-label="Horas" className="inline-flex self-start bg-gray-50 border border-gray-200 rounded-full p-1 gap-1">
            {[
              [true, "Todo el día"],
              [false, "Solo unas horas"],
            ].map(([valor, texto]) => (
              <button
                key={texto}
                type="button"
                role="radio"
                aria-checked={todoElDia === valor}
                onClick={() => setTodoElDia(valor)}
                className={`min-h-[40px] px-4 rounded-full text-sm font-bold ${todoElDia === valor ? "bg-primary-dark text-white" : "text-primary hover:bg-primary-light"}`}
              >
                {texto}
              </button>
            ))}
          </div>
          {todoElDia ? (
            <p className="m-0 text-sm text-ink-500">No se ofrecerá ningún horario en {dias.hasta ? "esos días" : "ese día"}.</p>
          ) : (
            <>
              <p className="m-0 text-sm text-ink-500">Toca la primera hora en que no estarás y después la última.</p>
              <ElegirHoras
                desde={horas.desde}
                hasta={horas.hasta}
                abierto={horas.abierto}
                onCambiar={(desde, hasta, abierto) => setHoras({ desde, hasta, abierto })}
              />
            </>
          )}
          <p className="m-0 font-bold text-primary-dark first-letter:uppercase" aria-live="polite">
            {resumenHoras}
          </p>
        </section>
      </div>

      {afectadas.length > 0 && (
        <div className="rounded-[18px] border border-[#F2C46D] bg-[#FFF6E0] p-5 text-[#5C4206]">
          <p className="m-0 font-extrabold">
            {afectadas.length === 1 ? "Hay 1 cita agendada en ese tiempo." : `Hay ${afectadas.length} citas agendadas en ese tiempo.`} Al guardar se cancelan y
            se avisa {afectadas.length === 1 ? "al estudiante" : "a los estudiantes"}:
          </p>
          <ul className="mt-2 mb-0 pl-5 text-sm">
            {afectadas.map((c) => (
              <li key={c.id}>
                {c.estudiante} · {c.servicio} · {largo(c.fecha)} {formatearHora(c.horaInicio)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <Aviso>{error}</Aviso>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="m-0 text-sm text-ink-600">
          <strong className="text-ink-900">{motivoFinal || "Sin motivo"}</strong> · <span className="first-letter:uppercase">{resumenDias}</span>,{" "}
          {resumenHoras}
        </p>
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? "Guardando…" : afectadas.length ? `Guardar y cancelar ${afectadas.length === 1 ? "la cita" : `${afectadas.length} citas`}` : "Guardar"}
        </button>
      </div>
    </form>
  );
}
