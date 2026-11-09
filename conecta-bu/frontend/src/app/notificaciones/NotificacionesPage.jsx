import { AvisoFlotante } from "../../components/avisos/Avisos";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../lib/api/http";
import { Icono } from "../../components/Iconos";
import { MODULO_AVISO, haceCuanto, useNotificaciones } from "../../lib/notificaciones/NotificacionesContext";

const POR_PAGINA = 20;

// Historial completo de notificaciones (/notificaciones): de cualquier dimension y rol.
export function NotificacionesPage() {
  const navigate = useNavigate();
  const { noLeidas: pendientes, cargar: recargarCampana, marcarTodas: marcarTodasCampana } = useNotificaciones();
  const [filtro, setFiltro] = useState("todas");
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(
    async (nueva = 1, reemplazar = true) => {
      setCargando(true);
      setError("");
      try {
        const { data } = await http.get("/notificaciones", { params: { limite: POR_PAGINA, pagina: nueva, soloNoLeidas: filtro === "sin-leer" ? 1 : 0 } });
        setLista((l) => (reemplazar ? data.items : [...l, ...data.items]));
        setTotal(data.total);
        setPagina(nueva);
      } catch {
        setError("No fue posible cargar tus notificaciones. Revisa tu conexión e inténtalo de nuevo.");
      } finally {
        setCargando(false);
      }
    },
    [filtro]
  );
  useEffect(() => {
    cargar(1, true);
  }, [cargar]);

  async function abrir(n) {
    if (!n.leida) await http.patch(`/notificaciones/${n.id}/leida`).catch(() => {});
    recargarCampana();
    if (n.ruta) navigate(n.ruta);
    else setLista((l) => l.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
  }
  async function eliminar(n) {
    await http.delete(`/notificaciones/${n.id}`).catch(() => {});
    setLista((l) => l.filter((x) => x.id !== n.id));
    setTotal((t) => Math.max(0, t - 1));
    recargarCampana();
  }
  async function leerTodas() {
    await marcarTodasCampana();
    cargar(1, true);
  }

  return (
    <main className="min-h-screen bg-[#F3EDE1]">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Link to="/" className="inline-flex items-center gap-2 min-h-[44px] -ml-2 px-2 text-sm font-bold text-primary no-underline hover:underline">
          <span aria-hidden="true" className="inline-block rotate-180">
            <Icono nombre="flecha" size={16} strokeWidth={2.4} />
          </span>
          Volver al portal
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">Notificaciones</h1>
            <p className="mt-2 mb-0 text-ink-500">{pendientes > 0 ? `Tienes ${pendientes} sin leer.` : "Estás al día."}</p>
          </div>
          <button type="button" onClick={leerTodas} disabled={pendientes === 0} className="boton-liquido min-h-[44px] px-5 rounded-full font-bold disabled:opacity-50">
            Marcar todas como leídas
          </button>
        </div>

        <div role="group" aria-label="Mostrar" className="mt-6 mb-4 inline-flex gap-0.5 p-1 rounded-[14px] bg-white/70 ring-1 ring-black/5">
          {[["todas", "Todas"], ["sin-leer", "Sin leer"]].map(([id, texto]) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={`min-h-[36px] px-4 rounded-[10px] text-[13px] font-bold transition-colors ${filtro === id ? "bg-white text-primary-dark shadow-[0_1px_3px_rgba(11,35,71,0.18)]" : "text-ink-600 hover:text-primary-dark"}`}>
              {texto}
            </button>
          ))}
        </div>

        {error && <AvisoFlotante tono="error">{error}</AvisoFlotante>}
        {!cargando && !error && lista.length === 0 && (
          <p role="status" className="m-0 rounded-[22px] bg-white/70 px-6 py-12 text-center text-ink-500">
            {filtro === "sin-leer" ? "No tienes nada sin leer." : "Todavía no tienes notificaciones. Aquí aparecerán tus citas, inscripciones y respuestas."}
          </p>
        )}

        <ul className="list-none m-0 p-0 grid gap-2">
          {lista.map((n) => {
            const modulo = MODULO_AVISO[n.modulo] || MODULO_AVISO.general;
            return (
              <li key={n.id} className={`flex items-stretch gap-1 rounded-[22px] border border-white/80 shadow-[0_6px_20px_-12px_rgba(11,35,71,0.25)] ${n.leida ? "bg-white/70" : "bg-white"}`}>
                <button type="button" onClick={() => abrir(n)} className="flex-1 min-w-0 text-left flex gap-3 rounded-[22px] px-4 py-3 min-h-[72px] hover:bg-primary-light/50 focus-visible:bg-primary-light/50 transition-colors">
                  <span aria-hidden="true" className="mt-2 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.leida ? "transparent" : modulo.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold rounded px-1.5 py-0.5 text-white select-none" style={{ background: modulo.color }}>
                        {modulo.nombre}
                      </span>
                      <span className="text-[12px] text-ink-500">{haceCuanto(n.fecha)}</span>
                    </span>
                    <span className={`block mt-1 text-[15px] leading-snug text-primary-dark ${n.leida ? "font-semibold" : "font-extrabold"}`}>{n.titulo}</span>
                    <span className="block text-sm leading-snug text-ink-600">{n.mensaje}</span>
                    {!n.leida && <span className="sr-only">Sin leer</span>}
                  </span>
                </button>
                <button type="button" onClick={() => eliminar(n)} aria-label={`Borrar la notificación «${n.titulo}»`} title="Borrar" className="w-11 shrink-0 self-center h-11 rounded-full inline-flex items-center justify-center text-ink-500 hover:bg-red-50 hover:text-red-700">
                  <Icono nombre="cerrar" size={16} strokeWidth={2.4} />
                </button>
              </li>
            );
          })}
        </ul>

        {lista.length < total && (
          <div className="mt-4 text-center">
            <button type="button" disabled={cargando} onClick={() => cargar(pagina + 1, false)} className="min-h-[44px] px-6 rounded-full burbuja text-primary-dark font-bold disabled:opacity-60">
              {cargando ? "Cargando…" : "Ver más"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
