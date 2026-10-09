import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";
import { Icono } from "../../components/Iconos";
import { MODULOS } from "../../lib/modulos";
import { Aviso, Kpi } from "../salud/ui";
import { BandaInicio, botonBandaPrincipal, botonBandaSecundario, hoyLargo } from "../../components/ui";

const ESTILO = {
  "desarrollo-humano": { color: "bg-gold text-primary", panel: "/admin" },
  salud: { color: "bg-[#14B8A6] text-primary", panel: "/salud" },
  deporte: { color: "bg-[#F97316] text-white", panel: "/deporte" },
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
            <Link to="/super/accesos" className={botonBandaPrincipal}>Accesos por módulo</Link>
            <Link to="/super/usuarios" className={botonBandaSecundario}>Usuarios y roles</Link>
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

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Kpi destacado titulo="Usuarios registrados" valor={resumen ? resumen.usuarios.total : "…"} />
        <Kpi titulo="Estudiantes" valor={resumen ? porRol.Estudiante || 0 : "…"} />
        <Kpi titulo="Personal de módulos" valor={resumen ? porRol.Administrador || 0 : "…"} />
        <Kpi titulo="Superadministradores" valor={resumen ? porRol.SuperAdministrador || 0 : "…"} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {(resumen?.modulos || []).map((m) => {
          const info = MODULOS.find((x) => x.id === m.id);
          const estilo = ESTILO[m.id] || { color: "bg-white text-primary", panel: "/super" };
          return (
            <section key={m.id} className="bg-white border border-gray-200 rounded-[24px] overflow-hidden flex flex-col">
              <div className="relative h-[120px] bg-primary">
                {info?.imagen && <img src={info.imagen.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,42,91,0.95),rgba(11,42,91,0.4))]" />
                <div className="relative h-full flex items-center gap-3 px-6">
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${estilo.color}`}>
                    <Icono nombre={info?.icono || "tablero"} size={24} strokeWidth={2} />
                  </span>
                  <h2 className="m-0 font-display text-2xl font-extrabold text-white">{m.nombre}</h2>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="grid gap-3 grid-cols-2">
                  <div className="bg-gray-50 rounded-2xl p-3.5">
                    <p className="m-0 text-xs text-ink-500">Personal asignado</p>
                    <p className="m-0 mt-1 font-display text-3xl font-semibold text-primary">{m.personal}</p>
                  </div>
                  {m.indicadores.map((i) => (
                    <div key={i.nombre} className="bg-gray-50 rounded-2xl p-3.5">
                      <p className="m-0 text-xs text-ink-500">{i.nombre}</p>
                      <p className="m-0 mt-1 font-display text-3xl font-semibold text-primary tabular-nums">{i.valor.toLocaleString("es-CO")}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-auto flex gap-2.5 flex-wrap">
                  <Link to={estilo.panel} className="inline-flex items-center gap-2 bg-primary text-white font-bold text-sm px-5 min-h-[44px] rounded-full hover:bg-primary-dark">
                    Entrar al panel
                    <Icono nombre="flecha" size={16} strokeWidth={2.2} />
                  </Link>
                  <Link
                    to={`/super/accesos?modulo=${m.id}`}
                    className="inline-flex items-center gap-2 border-[1.5px] border-gray-200 text-primary font-bold text-sm px-5 min-h-[44px] rounded-full hover:bg-gray-50"
                  >
                    Gestionar personal
                  </Link>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
    </>
  );
}
