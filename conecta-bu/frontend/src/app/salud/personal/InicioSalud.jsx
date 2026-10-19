import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";
import { Icono } from "../comunes/componentes/Iconos";
import { COLOR_POBLACION, POBLACION_TEXTO, fechaCorta, nombreCompleto } from "../comunes/lib/salud";
import { Aviso, BarrasHorizontales, Kpi, Tarjeta, Vacio, claseCampo } from "../comunes/componentes/ui";
import { AreaTiempo } from "../../../components/graficas/Area";
import { Pastel } from "../../../components/graficas/Circulares";
import { BandaInicio, botonBandaPrincipal, hoyLargo } from "../comunes/componentes/ui";

function saludo() {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Atenciones de los ultimos 30 dias en columnas (con valor al pasar el mouse).
// Atenciones por dia de los ultimos 30 dias (Recharts).
function Ultimos30({ datos }) {
  const filas = datos.map((d) => ({ ...d, etiqueta: fechaCorta(d.fecha) }));
  return <AreaTiempo datos={filas} series={[{ clave: "total", etiqueta: "atenciones", color: "#1F4E94" }]} alto={180} etiqueta="Atenciones por día en los últimos 30 días" />;
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
    <>
      <BandaInicio
        titulo={
          <>
            {saludo()}, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
          </>
        }
        fecha={`${hoyLargo()}${resumen?.periodo ? ` · Periodo ${resumen.periodo}` : ""}`}
        texto="Escribe la cédula o el código estudiantil para registrar una atención o una asistencia."
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary">Tu día</h2>
            <div className="flex gap-4 items-center">
              <span className="shrink-0 w-[76px] h-[68px] rounded-2xl bg-primary-light text-primary font-extrabold flex items-center justify-center tabular-nums text-[28px]">
                {resumen ? resumen.hoy : "…"}
              </span>
              <span className="min-w-0 text-ink-600">
                <strong className="block text-[17px] text-primary">{resumen?.hoy === 1 ? "Atención registrada hoy" : "Atenciones registradas hoy"}</strong>
                {salidas && salidas.pendientes > 0
                  ? `${salidas.pendientes} ${salidas.pendientes === 1 ? "reporte espera" : "reportes esperan"} revisión`
                  : "Sin reportes de salidas pendientes"}
              </span>
            </div>
            <Link to={salidas && salidas.pendientes > 0 ? "/salud/salidas" : "/salud/actividades"} className="self-start font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-primary-light text-primary hover:bg-[#E2E9F6]">
              {salidas && salidas.pendientes > 0 ? "Ir a la bandeja" : "Ver actividades"}
            </Link>
          </>
        }
      >
        <form onSubmit={irARegistrar} className="flex gap-2.5 flex-wrap max-w-[620px] mt-3">
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
              className={`${claseCampo} pl-12 min-h-[52px] text-base text-ink-900`}
            />
          </div>
          <button type="submit" className={`${botonBandaPrincipal} min-h-[52px]`}>
            Registrar
            <Icono nombre="flecha" size={18} strokeWidth={2.2} />
          </button>
        </form>
      </BandaInicio>
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
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
            <Pastel
              titulo="Población atendida"
              tamano={200}
              partes={resumen.porPoblacion.map((p) => ({ clave: p.nombre, etiqueta: POBLACION_TEXTO[p.nombre], valor: p.total, color: COLOR_POBLACION[p.nombre] }))}
              vacio="Todavía no hay atenciones en este periodo."
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
    </>
  );
}
