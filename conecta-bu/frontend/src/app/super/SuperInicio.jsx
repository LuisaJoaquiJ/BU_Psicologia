import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { Icono } from "../../components/Iconos";
import { MODULOS } from "../../lib/modulos";
import { Aviso, Kpi } from "../salud/ui";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../../components/ui";

const ESTILO = {
  "desarrollo-humano": { color: "bg-cyan text-primary-dark" },
  salud: { color: "bg-[#14B8A6] text-primary-dark" },
  deporte: { color: "bg-[#F97316] text-white" },
};

// Vista general de Conecta BU: cada modulo con su personal asignado y sus
// cifras, y accesos directos a sus paneles.
export function SuperInicio() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    http
      .get("/super/resumen")
      .then((res) => setResumen(res.data))
      .catch(() => setError("No fue posible cargar el resumen."));
  }, []);

  const porRol = resumen?.usuarios.porRol || {};

  return (
    <>
      <BandaInicio
        titulo={
          <>
            Hola, <span className="text-cyan">{usuario?.nombre?.split(" ")[0]}.</span>
          </>
        }
        fecha={hoyLargo()}
        texto="Cada módulo de Conecta BU es independiente. Desde aquí decides qué correos del personal entran a cada uno; los estudiantes entran con su cuenta institucional."
        acciones={
          <>
            <Link to="/super/estadisticas" className={botonBandaPrincipal}>Ver estadísticas</Link>
            <Link to="/super/accesos" className={botonBandaSecundario}>Accesos por módulo</Link>
          </>
        }
        aside={
          <>
            <h2 className="m-0 font-sans text-lg font-bold text-primary">Informes de gestión</h2>
            <div className="flex gap-4 items-center">
              <span className="shrink-0 w-[76px] h-[68px] rounded-2xl bg-primary-light text-primary font-extrabold flex items-center justify-center tabular-nums text-[28px]">
                {resumen ? resumen.informesPorRevisar || 0 : "…"}
              </span>
              <span className="min-w-0 text-ink-600">
                <strong className="block text-[17px] text-primary">Por revisar</strong>
                {resumen?.informesPorRevisar ? "Los módulos enviaron informes nuevos." : "No hay informes pendientes."}
              </span>
            </div>
            <Link to="/super/informes" className="self-start font-bold text-sm px-4 min-h-[44px] inline-flex items-center rounded-full bg-primary-light text-primary hover:bg-[#E2E9F6]">
              Abrir informes
            </Link>
          </>
        }
      />
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-9 pb-16 flex flex-col gap-6">
      {error && <Aviso>{error}</Aviso>}

      <section aria-labelledby="titulo-modulos">
        <div className="flex justify-between items-end gap-4 flex-wrap mb-4">
          <div>
            <h2 id="titulo-modulos" className="m-0 text-[28px] font-extrabold">Módulos de Bienestar</h2>
            <p className="mt-1 mb-0 text-ink-500">Elige un módulo para entrar a su panel con todos los permisos.</p>
          </div>
        </div>
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {MODULOS.filter((info) => info.estado === "disponible" && info.panel?.personal).map((info) => {
            const m = (resumen?.modulos || []).find((x) => x.id === info.id);
            const estilo = ESTILO[info.id] || { color: "bg-white/15 text-white" };
            const cifras = m ? [{ nombre: m.personal === 1 ? "persona del equipo" : "personas del equipo", valor: m.personal }, ...m.indicadores.slice(0, 2)] : [];
            return (
              <article key={info.id} className="bg-white border border-gray-200 rounded-[24px] overflow-hidden flex flex-col">
                <div className="relative h-[112px] bg-primary-dark">
                  {info.imagen && <img src={info.imagen.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,35,71,0.95),rgba(11,35,71,0.45))]" />
                  <div className="relative h-full flex items-center gap-3 px-6">
                    <span className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${estilo.color}`}>
                      <Icono nombre={info.icono || "tablero"} size={24} strokeWidth={2} />
                    </span>
                    <h3 className="m-0 text-[24px] leading-tight font-extrabold text-white">{info.nombre}</h3>
                  </div>
                </div>
                <div className="p-6 flex flex-col gap-4 flex-1">
                  <p className="m-0 text-sm text-ink-600 leading-relaxed">{info.descripcion}</p>
                  {cifras.length > 0 && (
                    <dl className="m-0 grid grid-cols-3 gap-2">
                      {cifras.map((i) => (
                        <div key={i.nombre} className="bg-gray-50 rounded-2xl px-3 py-2.5 min-w-0">
                          <dd className="m-0 text-[22px] leading-tight font-extrabold text-primary-dark">{Number(i.valor).toLocaleString("es-CO")}</dd>
                          <dt className="mt-0.5 text-xs leading-snug text-ink-500 first-letter:uppercase">{i.nombre.toLowerCase()}</dt>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="mt-auto flex flex-col gap-1.5">
                    <Link to={info.panel.personal} className="w-full inline-flex items-center justify-between gap-2 bg-primary text-white font-extrabold text-[15px] px-5 min-h-[50px] rounded-full hover:bg-primary-dark">
                      Entrar a {info.nombre}
                      <Icono nombre="flecha" size={18} strokeWidth={2.2} />
                    </Link>
                    <Link to={`/super/accesos?modulo=${info.id}`} className="self-center inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-primary-soft hover:underline">
                      Gestionar el personal del módulo
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {MODULOS.some((info) => info.estado !== "disponible") && (
          <p className="mt-5 mb-0 flex items-center gap-2 flex-wrap text-sm text-ink-500">
            Próximamente:
            {MODULOS.filter((info) => info.estado !== "disponible").map((info) => (
              <span key={info.id} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 font-semibold text-ink-600">
                <Icono nombre={info.icono} size={15} strokeWidth={2} />
                {info.nombre}
              </span>
            ))}
          </p>
        )}
      </section>

      <section aria-labelledby="titulo-usuarios">
        <h2 id="titulo-usuarios" className="m-0 mb-4 text-[22px] font-extrabold">Usuarios</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          <Kpi destacado titulo="Usuarios registrados" valor={resumen ? resumen.usuarios.total : "…"} />
          <Kpi titulo="Estudiantes" valor={resumen ? porRol.Estudiante || 0 : "…"} />
          <Kpi titulo="Personal de módulos" valor={resumen ? porRol.Administrador || 0 : "…"} />
          <Kpi titulo="Superadministradores" valor={resumen ? porRol.SuperAdministrador || 0 : "…"} />
        </div>
      </section>
    </main>
    </>
  );
}
