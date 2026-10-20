import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Aviso, Insignia, Tarjeta, Vacio, hoyLargo } from "../../comunes/componentes/ui";
import { Icono } from "../../comunes/componentes/Iconos";
import { BandaAurora, CifraVidrio, ENTRA, IndicadoresAurora, KpiAurora, PanelVidrio, botonAuroraPrincipal, botonAuroraSecundario, botonVidrio, retraso } from "../../comunes/componentes/Aurora";
import { http } from "../../../../lib/api/http";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { horas } from "../../comunes/lib/deporte";
import { descargar } from "../../comunes/lib/salud";
import { OcupacionCupos } from "../../comunes/OcupacionCupos";
import { IconoDisciplina } from "../../comunes/Progreso";

// Inicio de la coordinación: clases de hoy, cifras del periodo y ocupación.

export function descargarReporte(periodo) {
  return descargar("/deporte/admin/reporte", periodo ? { periodo } : {}, "deporte-horas.xlsx");
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export function InicioPersonal() {
  const { usuario } = useAuth();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const cargar = useCallback(() => {
    setCargando(true);
    return http
      .get("/deporte/admin/resumen")
      .then((x) => {
        setR(x.data);
        setError("");
      })
      .catch(() => setError("No fue posible cargar el resumen."))
      .finally(() => setCargando(false));
  }, []);
  useEffect(() => {
    cargar();
    // La ocupacion se refresca sola cada 30 segundos mientras la pagina esta abierta.
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 30000);
    return () => clearInterval(t);
  }, [cargar]);
  return (
    <>
      <BandaAurora
        tono="deporte"
        titulo={`${saludo()}, ${usuario?.nombre?.split(" ")[0] || ""}`}
        fecha={`${hoyLargo()}${r?.periodo ? ` · Periodo ${r.periodo}` : ""}`}
        texto={`Toma asistencia de las clases de hoy: cada estudiante presente suma las horas de la sesión para completar sus ${r?.requeridas || 40} horas.`}
        acciones={
          <>
            <Link to="/deporte/grupos" className={botonAuroraPrincipal("deporte")}>
              <Icono nombre="calendario" size={18} /> Ver grupos
            </Link>
            <Link to="/deporte/estadisticas" className={botonAuroraSecundario}>
              <Icono nombre="grafica" size={17} /> Ver estadísticas
            </Link>
            <button type="button" onClick={() => descargarReporte(r?.periodo)} className={botonAuroraSecundario}>
              <Icono nombre="descarga" size={17} /> Reporte en Excel
            </button>
          </>
        }
        lado={
          <PanelVidrio titulo="Clases de hoy">
            {!r && <p className="m-0 text-white/75">Cargando…</p>}
            {r && r.clasesHoy.length === 0 && <p className="m-0 text-white/85">Hoy no hay clases en el horario de los grupos.</p>}
            {r && r.clasesHoy.length > 0 && (
              <CifraVidrio
                valor={r.clasesHoy.length}
                texto={r.clasesHoy.length === 1 ? "Clase hoy" : "Clases hoy"}
                detalle={(() => {
                  const pendientes = r.clasesHoy.filter((c) => !c.asistenciaTomada).length;
                  return pendientes ? `${pendientes} sin asistencia tomada` : "Asistencia tomada en todas";
                })()}
              />
            )}
            <Link to="/deporte/grupos" className={botonVidrio}>
              Tomar asistencia
            </Link>
          </PanelVidrio>
        }
      />
    <main className="relative max-w-[1440px] mx-auto -mt-[72px] px-4 sm:px-6 lg:px-10 pb-16 flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}
      <IndicadoresAurora>
        <KpiAurora titulo="Estudiantes inscritos" valor={r ? r.inscritos : "…"} detalle={r ? `en ${r.gruposActivos} grupos activos` : null} />
        <KpiAurora titulo="Sesiones del periodo" valor={r ? r.sesiones : "…"} detalle={r?.asistenciaPromedio !== null && r ? `${r.asistenciaPromedio} % de asistencia` : null} />
        <KpiAurora titulo="Horas otorgadas" valor={r ? horas(r.horasOtorgadas) : "…"} detalle="en el periodo" />
        <KpiAurora titulo="Completaron sus horas" valor={r ? r.cumplieron : "…"} detalle={r ? `${r.requeridas} horas requeridas` : null} />
      </IndicadoresAurora>
      <div style={retraso(300)} className={`grid gap-5 lg:grid-cols-[1.3fr_1fr] ${ENTRA}`}>
        <Tarjeta titulo="Clases de hoy" subtitulo={new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}>
          {r && r.clasesHoy.length === 0 && <Vacio>Hoy no hay clases en el horario de los grupos.</Vacio>}
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {r?.clasesHoy.map((c) => (
              <li key={c.id}>
                <Link to={`/deporte/grupos/${c.id}`} className="flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 hover:bg-gray-50">
                  <IconoDisciplina nombre={c.disciplina} tamano={40} />
                  <span className="flex-1 min-w-0 leading-tight">
                    <span className="block font-bold text-ink-900 truncate">{c.nombre}</span>
                    <span className="block text-sm text-ink-500 truncate">
                      {c.franja.inicio}–{c.franja.fin}
                      {c.lugar ? ` · ${c.lugar}` : ""} · {c.inscritos} inscritos
                      {c.docente ? ` · ${c.docente}` : ""}
                    </span>
                  </span>
                  {c.asistenciaTomada ? (
                    <Insignia tono="verde">Asistencia tomada</Insignia>
                  ) : new Date(c.disponibleDesde).getTime() > Date.now() ? (
                    <Insignia tono="gris">Desde las {c.franja.inicio}</Insignia>
                  ) : (
                    <Insignia tono="dorado">Tomar asistencia</Insignia>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <div className="flex flex-col gap-5">
          {r?.ocupacion && <OcupacionCupos ocupacion={r.ocupacion} actualizado={r.actualizado} onActualizar={cargar} cargando={cargando} />}
          <Tarjeta titulo="Cerca de completar" subtitulo="Con el 75 % o más de las horas">
            {r && r.cercaDeCumplir.length === 0 && <Vacio>Nadie por ahora.</Vacio>}
            <ul className="list-none m-0 p-0">
              {r?.cercaDeCumplir.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-2 border-t border-gray-100 first:border-t-0 text-sm">
                  <Link to={`/deporte/estudiantes/${e.id}`} className="font-semibold text-ink-900 truncate">
                    {e.nombre}
                  </Link>
                  <span className="font-bold tabular-nums">{horas(e.total)}</span>
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
