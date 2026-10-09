import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { Icono } from "../../components/Iconos";
import { COLOR_POBLACION, POBLACION_TEXTO, fechaCorta, nombreCompleto } from "../../lib/salud";
import { Aviso, BarrasHorizontales, Kpi, Tarjeta, Vacio, botonDorado, claseCampo } from "./ui";

function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Atenciones de los ultimos 30 dias en columnas (con valor al pasar el mouse).
function Ultimos30({ datos }) {
  const maximo = Math.max(1, ...datos.map((d) => d.total));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-[120px]" role="img" aria-label="Atenciones por día en los últimos 30 días">
        {datos.map((d) => (
          <div key={d.fecha} className="flex-1 h-full flex items-end group relative">
            <div
              className={`w-full rounded-t-[4px] ${d.total ? "bg-primary-soft group-hover:bg-primary" : "bg-gray-100"}`}
              style={{ height: `${d.total ? Math.max(6, (d.total / maximo) * 100) : 3}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-ink-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap z-10">
              {fechaCorta(d.fecha)}: {d.total}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ink-500 mt-2">
        <span>{fechaCorta(datos[0]?.fecha)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

// Inicio del personal de salud: busqueda rapida, indicadores del periodo y
// pendientes (evidencias por subir, autorizaciones de datos).
export function InicioSalud() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [documento, setDocumento] = useState("");
  const [salidas, setSalidas] = useState(null);

  useEffect(() => {
    http
      .get("/salud/resumen")
      .then((res) => setResumen(res.data))
      .catch(() => setError("No fue posible cargar el resumen."));
    http
      .get("/salud/reportes-sst/resumen")
      .then((res) => setSalidas(res.data))
      .catch(() => setSalidas(null));
  }, []);

  function irARegistrar(e) {
    e.preventDefault();
    navigate(`/salud/registrar${documento.trim() ? `?doc=${encodeURIComponent(documento.trim())}` : ""}`);
  }

  const total = resumen?.totalPeriodo || 0;

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      <section className="relative overflow-hidden bg-primary rounded-[28px] px-6 py-8 sm:px-10 sm:py-10 text-white">
        <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -right-24 -top-28 w-[360px] h-[360px]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(232,178,58,0.35)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        </svg>
        <p className="relative m-0 mb-1.5 text-[13px] font-bold tracking-[0.14em] uppercase text-gold">
          Salud integral · {resumen?.periodo || "…"}
        </p>
        <h1 className="relative m-0 text-white text-[32px] sm:text-[40px] font-extrabold">
          {saludo()}, {usuario?.nombre?.split(" ")[0]}
        </h1>
        <p className="relative mt-2 mb-6 text-[#D6DDEC] max-w-[560px]">
          Escribe la cédula o el código estudiantil para registrar una atención o una asistencia.
        </p>
        <form onSubmit={irARegistrar} className="relative flex gap-2.5 flex-wrap max-w-[620px]">
          <label className="sr-only" htmlFor="doc-inicio">Cédula o código estudiantil</label>
          <div className="relative flex-[1_1_280px]">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500">
              <Icono nombre="buscar" size={20} />
            </span>
            <input
              id="doc-inicio"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              inputMode="numeric"
              placeholder="Cédula o código estudiantil"
              className={`${claseCampo} pl-12 min-h-[52px] text-base`}
            />
          </div>
          <button type="submit" className={`${botonDorado} min-h-[52px]`}>
            Registrar
            <Icono nombre="flecha" size={18} strokeWidth={2.2} />
          </button>
        </form>
      </section>

      {error && <Aviso>{error}</Aviso>}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Kpi destacado titulo="Atenciones hoy" valor={resumen ? resumen.hoy : "…"} detalle={resumen ? `${resumen.semana} en los últimos 7 días` : null} />
        <Kpi titulo="Atenciones del periodo" valor={resumen ? total.toLocaleString("es-CO") : "…"} detalle={resumen ? `${resumen.remisiones} remisiones` : null} />
        <Kpi titulo="Personas atendidas" valor={resumen ? resumen.personasPeriodo.toLocaleString("es-CO") : "…"} detalle="distintas en el periodo" />
        <Kpi titulo="Personas registradas" valor={resumen ? resumen.personasRegistradas.toLocaleString("es-CO") : "…"} detalle="se buscan solo con el documento" />
      </div>

      {salidas && (salidas.pendientes > 0 || salidas.riesgosAbiertos > 0) && (
        <Aviso tono="azul">
          <strong>
            {salidas.pendientes} reporte(s) de salidas o condiciones inseguras por revisar
            {salidas.riesgosAbiertos > 0 ? ` · ${salidas.riesgosAbiertos} condición(es) insegura(s) abiertas` : ""}.
          </strong>{" "}
          <Link to="/salud/salidas" className="underline font-semibold">
            Ir a la bandeja
          </Link>
        </Aviso>
      )}

      {resumen && (resumen.actividadesSinEvidencia.length > 0 || resumen.sinConsentimiento > 0) && (
        <div className="flex flex-col gap-2.5">
          {resumen.actividadesSinEvidencia.length > 0 && (
            <Aviso tono="dorado">
              <strong>{resumen.actividadesSinEvidencia.length} jornada(s) sin evidencias:</strong>{" "}
              {resumen.actividadesSinEvidencia.slice(0, 4).map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <Link to={`/salud/actividades/${a.id}`} className="underline font-semibold text-[#5C4206]">
                    {a.nombre}
                  </Link>
                </span>
              ))}
              {resumen.actividadesSinEvidencia.length > 4 && " y otras"}. Sube las fotos o planillas para el informe de gestión.
            </Aviso>
          )}
          {resumen.sinConsentimiento > 0 && (
            <Aviso tono="azul">
              {resumen.sinConsentimiento.toLocaleString("es-CO")} persona(s) importadas de los Excel aún no tienen registrada la autorización de
              datos (Ley 1581). Se les pedirá en su próxima atención.
            </Aviso>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Tarjeta titulo="Atenciones de los últimos 30 días" subtitulo="Todas las actividades">
          {resumen ? <Ultimos30 datos={resumen.porDia} /> : <div className="h-[140px] bg-gray-50 rounded-xl animate-pulse" />}
        </Tarjeta>
        <Tarjeta titulo="Población atendida" subtitulo={`Periodo ${resumen?.periodo || ""}`}>
          {resumen && (
            <BarrasHorizontales
              datos={resumen.porPoblacion
                .filter((p) => p.total > 0)
                .map((p) => ({ nombre: POBLACION_TEXTO[p.nombre], total: p.total, color: COLOR_POBLACION[p.nombre] }))}
              formato={(v) => `${v} · ${total ? Math.round((v / total) * 100) : 0} %`}
            />
          )}
        </Tarjeta>
      </div>

      {salidas?.proximas?.length > 0 && (
        <Tarjeta
          titulo="Próximas salidas institucionales"
          subtitulo="Los siguientes 15 días"
          acciones={
            <Link to="/salud/salidas" className="text-sm font-bold text-primary-soft">
              Ver todas →
            </Link>
          }
        >
          <ul className="list-none m-0 p-0 grid gap-2.5 sm:grid-cols-2">
            {salidas.proximas.map((r) => (
              <li key={r.id}>
                <Link to={`/salud/salidas/${r.id}`} className="flex items-center gap-3 border border-gray-200 rounded-xl px-3.5 py-3 hover:bg-gray-50">
                  <span className="w-12 shrink-0 text-center leading-none">
                    <span className="block font-display text-2xl font-semibold text-primary">{String(r.fechaSalida).slice(8, 10)}</span>
                    <span className="block text-[11px] font-bold uppercase text-ink-500 mt-1">
                      {new Date(`${String(r.fechaSalida).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" })}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block font-semibold text-ink-900 truncate">{r.evento || r.motivo}</span>
                    <span className="block text-xs text-ink-500 truncate">
                      {r.destino} · {r.responsableNombre}
                    </span>
                  </span>
                  {r.estado === "Verificado" ? (
                    <span className="text-[#0B6B61]" title="Verificada">
                      <Icono nombre="check" size={18} strokeWidth={2.6} />
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[#B45309] whitespace-nowrap">Por revisar</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Tarjeta titulo="Actividades con más atenciones">
          {resumen && <BarrasHorizontales datos={resumen.topActividades} color="#0d9488" />}
        </Tarjeta>
        <Tarjeta titulo="Estudiantes por programa">
          {resumen && <BarrasHorizontales datos={resumen.porPrograma} />}
        </Tarjeta>
        <Tarjeta
          titulo="Últimos registros"
          acciones={
            <Link to="/salud/registrar" className="text-sm font-bold text-primary-soft">
              Registrar →
            </Link>
          }
        >
          {resumen && resumen.ultimas.length === 0 && <Vacio>Aún no hay atenciones registradas.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col">
            {resumen?.ultimas.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="w-9 h-9 rounded-full bg-primary-light text-primary-soft text-xs font-bold flex items-center justify-center shrink-0">
                  {a.persona?.nombres?.[0]}
                  {a.persona?.apellidos?.[0]}
                </span>
                <span className="flex-1 min-w-0 text-sm leading-tight">
                  <Link to={`/salud/personas/${a.personaId}`} className="block font-semibold text-ink-900 truncate">
                    {nombreCompleto(a.persona)}
                  </Link>
                  <span className="text-ink-500 truncate block">{a.actividad?.nombre}</span>
                </span>
                <span className="text-xs text-ink-500 shrink-0">
                  {new Date(`${String(a.fecha).slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </main>
  );
}
