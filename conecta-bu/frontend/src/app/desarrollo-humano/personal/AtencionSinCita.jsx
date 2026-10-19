import { useEffect, useRef, useState } from "react";
import { http } from "../../../lib/api/http";
import { Icono } from "../comunes/componentes/Iconos";
import { iniciales } from "../comunes/componentes/Navbar";
import { Aviso, Campo, botonPrimario, claseCampo } from "../comunes/componentes/ui";

// Atencion sin cita: el estudiante llega sin haber pedido cita y el
// profesional, si esta disponible, lo atiende. Aqui se registra quien fue,
// que servicio recibio y a que hora, y queda como una cita "Asistió".

const DURACIONES = [15, 20, 30, 45, 60, 90];

function fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function horaAhora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Paso({ n, titulo, children }) {
  return (
    <section className="bg-white rounded-xl p-5 sm:p-6 flex flex-col gap-4">
      <h3 className="m-0 flex items-center gap-3 text-lg font-extrabold">
        <span className="w-8 h-8 rounded-full bg-primary-dark text-white text-sm grid place-items-center shrink-0">{n}</span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function ElegirEstudiante({ api, elegido, setElegido, nuevo, setNuevo }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState(null);
  const [cargando, setCargando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) {
      setResultados(null);
      return undefined;
    }
    const id = ++ultima.current;
    setCargando(true);
    const t = setTimeout(() => {
      http
        .get(`${api}/citas/estudiantes`, { params: { q: termino } })
        .then((res) => id === ultima.current && setResultados(res.data.estudiantes))
        .catch(() => id === ultima.current && setResultados([]))
        .finally(() => id === ultima.current && setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, api]);

  if (elegido) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border-[1.5px] border-primary bg-primary-light px-4 py-3">
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-full bg-primary text-white font-extrabold text-sm grid place-items-center shrink-0">
            {iniciales(elegido.nombre)}
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-ink-900 truncate">{elegido.nombre}</span>
            <span className="block text-sm text-ink-500 truncate">{elegido.email}</span>
          </span>
        </span>
        <button type="button" onClick={() => setElegido(null)} className="min-h-[44px] px-4 rounded-full text-sm font-bold text-primary hover:bg-white">
          Cambiar
        </button>
      </div>
    );
  }

  if (nuevo) {
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-ink-500">
          Si nunca ha entrado a Conecta BU, lo registramos con su correo institucional. Cuando entre con Google verá esta atención en sus citas.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre completo">
            <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Correo institucional">
            <input
              required
              type="email"
              value={nuevo.correo}
              onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })}
              placeholder="nombre.apellido@uniautonoma.edu.co"
              className={claseCampo}
            />
          </Campo>
        </div>
        <button type="button" onClick={() => setNuevo(null)} className="self-start min-h-[44px] px-1 text-sm font-bold text-primary-soft hover:underline">
          Volver a buscar en la lista
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">
          <Icono nombre="buscar" size={18} />
        </span>
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Escribe el nombre o el correo del estudiante"
          aria-label="Buscar estudiante"
          className={`${claseCampo} pl-10`}
        />
      </span>
      {q.trim().length >= 2 && (
        <div aria-live="polite">
          {cargando && !resultados && <p className="m-0 text-sm text-ink-500">Buscando…</p>}
          {resultados && resultados.length === 0 && <p className="m-0 text-sm text-ink-500">No encontramos a nadie con «{q.trim()}».</p>}
          {resultados && resultados.length > 0 && (
            <ul className="list-none m-0 p-0 border border-gray-200 rounded-2xl divide-y divide-[#EEF2F7] overflow-hidden">
              {resultados.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setElegido(u)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-light min-h-[56px]"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary-light text-primary font-extrabold text-xs grid place-items-center shrink-0">
                      {iniciales(u.nombre)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-ink-900 truncate">{u.nombre}</span>
                      <span className="block text-sm text-ink-500 truncate">{u.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setNuevo({ nombre: "", correo: q.includes("@") ? q.trim() : "" })}
        className="self-start min-h-[44px] px-1 text-sm font-bold text-primary-soft hover:underline"
      >
        ¿No aparece? Registrarlo con su correo institucional
      </button>
    </div>
  );
}

export function FormularioSinCita({ api = "/admin", alGuardar }) {
  const [elegido, setElegido] = useState(null);
  const [nuevo, setNuevo] = useState(null);
  const [servicios, setServicios] = useState(null);
  const [servicioId, setServicioId] = useState("");
  const [fecha, setFecha] = useState(fechaHoy());
  const [hora, setHora] = useState(horaAhora());
  const [duracion, setDuracion] = useState(30);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    http
      .get("/servicios")
      .then((res) => {
        setServicios(res.data.servicios);
        if (res.data.servicios.length === 1) setServicioId(res.data.servicios[0].id);
      })
      .catch(() => setServicios([]));
  }, []);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (!elegido && !nuevo) {
      setError("Elige al estudiante que atendiste.");
      return;
    }
    setEnviando(true);
    try {
      const quien = elegido ? { usuarioId: elegido.id } : { correo: nuevo.correo, nombre: nuevo.nombre };
      const res = await http.post(`${api}/citas/sin-cita`, { ...quien, servicioId, fecha, hora, duracion, observaciones });
      await alGuardar(res.data.cita);
    } catch (err) {
      setError(err.response?.data?.message || "No pudimos registrar la atención. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <Paso n="1" titulo="¿A quién atendiste?">
        <ElegirEstudiante api={api} elegido={elegido} setElegido={setElegido} nuevo={nuevo} setNuevo={setNuevo} />
      </Paso>

      <Paso n="2" titulo="¿Qué servicio y cuándo?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Servicio" className="sm:col-span-2 lg:col-span-1">
            <select required value={servicioId} onChange={(e) => setServicioId(e.target.value)} className={claseCampo}>
              <option value="">{servicios ? "Elige el servicio" : "Cargando…"}</option>
              {(servicios || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Día">
            <input required type="date" value={fecha} max={fechaHoy()} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Hora de inicio">
            <input required type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Duración">
            <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className={claseCampo}>
              {DURACIONES.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} minutos` : d === 60 ? "1 hora" : "1 hora y media"}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Nota (opcional)" ayuda="Solo la ve el personal del módulo. Evita escribir detalles clínicos o confidenciales.">
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej.: llegó por orientación vocacional"
            className={`${claseCampo} py-3`}
          />
        </Campo>
      </Paso>

      {error && <Aviso>{error}</Aviso>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="m-0 text-sm text-ink-500">Quedará en Citas como «Asistió» y contará en las estadísticas.</p>
        <button type="submit" disabled={enviando} className={botonPrimario}>
          {enviando ? "Registrando…" : "Registrar atención"}
        </button>
      </div>
    </form>
  );
}
