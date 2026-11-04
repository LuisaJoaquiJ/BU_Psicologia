import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { Aviso, Insignia, Tarjeta, Vacio, hoyLargo } from "../comunes/componentes/ui";
import { Icono } from "../comunes/componentes/Iconos";
import { BandaAurora, CifraVidrio, ENTRA, IndicadoresAurora, KpiAurora, PanelVidrio, botonAuroraPrincipal, botonAuroraSecundario, botonVidrio, retraso } from "../comunes/componentes/Aurora";

// Inicio del personal de Arte y Cultura, con la misma estructura que los
// demas modulos: banda de saludo con lo de esta semana, indicadores y las
// dos listas que piden atencion (proximos eventos y pendientes).

const hoyTexto = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const masDias = (n) => new Date(Date.now() - 5 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

function fechaCorta(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function cuando(iso) {
  const dias = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00Z`) - new Date(`${hoyTexto()}T00:00:00Z`)) / 86400000);
  return dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : `En ${dias} días`;
}

async function descargarSnies() {
  const r = await http.get("/cultura/admin/informe", { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SNIES-cultura.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export function InicioPersonal({ rol = "administrador" }) {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  const cargar = useCallback(() => {
    const seguro = (ruta) => http.get(ruta).then((r) => r.data).catch(() => null);
    Promise.all([seguro("/cultura/admin/grupos"), seguro("/cultura/admin/agenda"), seguro("/cultura/admin/pendientes"), seguro("/cultura/admin/inventario")]).then(([grupos, eventos, pendientes, inventario]) => {
      if (!grupos && !eventos) setError("No fue posible cargar el resumen.");
      setDatos({ grupos: grupos || [], eventos: eventos || [], pendientes: pendientes || [], inventario: inventario || [] });
    });
  }, []);
  useEffect(cargar, [cargar]);

  const hoy = hoyTexto();
  const enSemana = masDias(7);
  const activos = datos?.grupos.filter((g) => g.activo !== false) || [];
  const inscritos = activos.reduce((s, g) => s + (g.inscritos?.length || 0), 0);
  const proximos = (datos?.eventos || []).filter((e) => e.fecha >= hoy).sort((a, b) => (a.fecha + (a.horaInicio || "")).localeCompare(b.fecha + (b.horaInicio || "")));
  const semana = proximos.filter((e) => e.fecha <= enSemana);
  const abiertos = (datos?.pendientes || []).filter((t) => !t.hecha);
  const vencidos = abiertos.filter((t) => t.vencida);
  const porDevolver = (datos?.inventario || []).flatMap((a) => a.prestamos.map((p) => ({ ...p, articulo: a.nombre })));
  const prestamosVencidos = porDevolver.filter((p) => p.vencido);
  const esAdmin = rol === "administrador";

  return (
    <>
      <BandaAurora
        tono="cultura"
        titulo={`${saludo()}, ${usuario?.nombre?.split(" ")[0] || ""}`}
        fecha={hoyLargo()}
        texto="Publica los grupos y la agenda, toma la asistencia con el código de cada sesión y sigue lo pendiente antes de cada presentación."
        acciones={
          <>
            <Link to="/cultura/agenda" className={botonAuroraPrincipal("cultura")}>
              <Icono nombre="calendario" size={18} /> Ver agenda
            </Link>
            <Link to="/cultura/grupos" className={botonAuroraSecundario}>
              <Icono nombre="musica" size={17} /> Grupos y talleres
            </Link>
            {esAdmin && (
              <button
                type="button"
                disabled={descargando}
                onClick={async () => {
                  setDescargando(true);
                  setError("");
                  try {
                    await descargarSnies();
                  } catch {
                    setError("No fue posible descargar el informe SNIES.");
                  } finally {
                    setDescargando(false);
                  }
                }}
                className={`${botonAuroraSecundario} disabled:opacity-60`}
              >
                <Icono nombre="descarga" size={17} /> {descargando ? "Preparando…" : "Informe SNIES"}
              </button>
            )}
          </>
        }
        lado={
          <PanelVidrio titulo="Esta semana">
            {!datos && <p className="m-0 text-white/75">Cargando…</p>}
            {datos && semana.length === 0 && <p className="m-0 text-white/85">No hay eventos en los próximos 7 días.</p>}
            {datos && semana.length > 0 && (
              <CifraVidrio
                valor={semana.length}
                texto={semana.length === 1 ? "Evento en 7 días" : "Eventos en 7 días"}
                detalle={`El próximo: ${semana[0].nombre}, ${cuando(semana[0].fecha).toLowerCase()}`}
              />
            )}
            <Link to="/cultura/agenda" className={botonVidrio}>
              Abrir agenda
            </Link>
          </PanelVidrio>
        }
      />
      <main className="relative max-w-[1440px] mx-auto -mt-[72px] px-4 sm:px-6 lg:px-10 pb-28 flex flex-col gap-6">
        {error && <Aviso>{error}</Aviso>}
        <IndicadoresAurora>
          <KpiAurora titulo="Grupos y talleres" valor={datos ? activos.length : "…"} detalle="activos" />
          <KpiAurora titulo="Personas inscritas" valor={datos ? inscritos : "…"} detalle="en grupos y talleres" />
          <KpiAurora titulo="Próximos eventos" valor={datos ? proximos.length : "…"} detalle={datos ? `${proximos.filter((e) => e.estado === "Borrador").length} en borrador` : null} />
          <KpiAurora titulo="Pendientes" valor={datos ? abiertos.length : "…"} detalle={datos ? (vencidos.length ? `${vencidos.length} vencidos` : "ninguno vencido") : null} />
        </IndicadoresAurora>

        <div style={retraso(300)} className={`grid gap-5 lg:grid-cols-[1.3fr_1fr] ${ENTRA}`}>
          <Tarjeta titulo="Próximos eventos" subtitulo="Lo que viene en la agenda" acciones={<Link to="/cultura/agenda" className="text-sm font-bold text-primary no-underline">Ver todos</Link>}>
            {datos && proximos.length === 0 && <Vacio>No hay eventos próximos. Crea uno desde la Agenda.</Vacio>}
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {proximos.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link to="/cultura/agenda" className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 no-underline hover:bg-gray-50">
                    <span aria-hidden="true" className="shrink-0 w-12 h-12 rounded-xl bg-primary-light text-primary flex flex-col items-center justify-center leading-none">
                      <span className="text-[17px] font-extrabold tabular-nums">{Number(String(e.fecha).slice(8, 10))}</span>
                      <span className="text-[10px] font-bold uppercase">{fechaCorta(e.fecha).split(" ").pop().replace(".", "")}</span>
                    </span>
                    <span className="flex-1 min-w-0 leading-tight">
                      <span className="block font-bold text-ink-900 truncate">{e.nombre}</span>
                      <span className="block text-sm text-ink-500 truncate">
                        {fechaCorta(e.fecha)}
                        {e.horaInicio ? ` · ${e.horaInicio}` : ""}
                        {e.lugar ? ` · ${e.lugar}` : ""} · {e.inscritos} inscritos
                      </span>
                    </span>
                    {e.estado === "Borrador" ? <Insignia tono="gris">Borrador</Insignia> : <Insignia tono={cuando(e.fecha) === "Hoy" ? "dorado" : "azul"}>{cuando(e.fecha)}</Insignia>}
                  </Link>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <div className="flex flex-col gap-5">
            <Tarjeta titulo="Pendientes" subtitulo="Por fecha límite" acciones={<Link to="/cultura/pendientes" className="text-sm font-bold text-primary no-underline">Ver todos</Link>}>
              {datos && abiertos.length === 0 && <Vacio>Nada pendiente por ahora.</Vacio>}
              <ul className="list-none m-0 p-0">
                {abiertos.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900 truncate">{t.titulo}</span>
                      {t.responsable && <span className="block text-ink-500 truncate">{t.responsable}</span>}
                    </span>
                    <Insignia tono={t.vencida ? "rojo" : t.diasRestantes <= 3 ? "dorado" : "gris"}>
                      {t.vencida ? "Vencido" : cuando(t.fechaLimite)}
                    </Insignia>
                  </li>
                ))}
              </ul>
            </Tarjeta>

            <Tarjeta titulo="Préstamos del inventario" subtitulo={porDevolver.length ? `${porDevolver.length} por devolver` : "Todo está en su lugar"} acciones={<Link to="/cultura/inventario" className="text-sm font-bold text-primary no-underline">Inventario</Link>}>
              {datos && porDevolver.length === 0 && <Vacio>No hay nada prestado.</Vacio>}
              <ul className="list-none m-0 p-0">
                {[...prestamosVencidos, ...porDevolver.filter((p) => !p.vencido)].slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-900 truncate">{p.cantidad} × {p.articulo}</span>
                      <span className="block text-ink-500 truncate">{p.responsable}</span>
                    </span>
                    <Insignia tono={p.vencido ? "rojo" : "gris"}>{p.vencido ? "Sin devolver" : `Vuelve ${fechaCorta(p.fechaDevolucionEsperada)}`}</Insignia>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
        </div>
      </main>
    </>
  );
}
