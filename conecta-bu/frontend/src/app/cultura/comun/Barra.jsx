import { Link, NavLink } from "react-router-dom";
import { Icono } from "../../../components/Iconos";
import { useAuth } from "../../../lib/auth/AuthContext";

const MENUS = {
  estudiante: [
    { to: "/mi-cultura", label: "Inicio", end: true },
    { to: "/mi-cultura/grupos", label: "Grupos artísticos" },
    { to: "/mi-cultura/agenda", label: "Agenda cultural" },
    { to: "/mi-cultura/convocatorias", label: "Convocatorias" },
  ],
  personal: [
    { to: "/cultura", label: "Inicio", end: true },
    { to: "/cultura/grupos", label: "Grupos" },
    { to: "/cultura/agenda", label: "Agenda" },
    { to: "/cultura/convocatorias", label: "Convocatorias" },
    { to: "/cultura/redes", label: "Redes" },
    { to: "/cultura/itinerante", label: "Itinerante" },
    { to: "/cultura/apoyo", label: "Apoyo" },
    { to: "/cultura/informes", label: "Informes" },
    { to: "/cultura/historico", label: "Histórico" },
    { to: "/cultura/equipo", label: "Equipo" },
  ],
};

function iniciales(nombre = "") {
  return (
    nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

const pildora = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-bold no-underline transition-colors ${
    isActive ? "boton-liquido" : "text-ink-600 hover:bg-white/80 hover:text-primary"
  }`;

export function Barra({ variante = "estudiante" }) {
  const { usuario, cerrarSesion } = useAuth();
  const inicio = variante === "personal" ? "/cultura" : "/mi-cultura";

  return (
    <header className="sticky top-0 z-30 vidrio-panel !border-x-0 !border-t-0">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
        <Link to={inicio} className="flex items-center gap-3 min-w-0 no-underline shrink-0">
          <img src="/img/logo-uniautonoma-marca.png" alt="Uniautónoma del Cauca" className="h-11 sm:h-[52px] w-auto shrink-0" />
          <span className="flex flex-col leading-tight min-w-0">
            <span className="font-extrabold tracking-tight text-primary-dark text-[15px] sm:text-[19px] leading-tight">Arte y Cultura</span>
            <span className="text-xs sm:text-[13px] text-ink-500">Conecta BU</span>
          </span>
        </Link>

        <nav aria-label="Secciones de Arte y Cultura" className="hidden xl:flex gap-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          {MENUS[variante].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={pildora}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/"
            aria-label="Cambiar de dimensión"
            title="Cambiar de dimensión"
            className="hidden sm:inline-flex items-center justify-center gap-1.5 text-sm font-bold text-primary burbuja rounded-full min-w-[44px] px-3 min-h-[44px] hover:bg-white"
          >
            <Icono nombre="cuadricula" size={16} strokeWidth={2} />
            <span className="xl:hidden 2xl:inline">Cambiar de dimensión</span>
          </Link>
          <span className="w-10 h-10 rounded-full boton-liquido font-extrabold text-sm flex items-center justify-center shrink-0" title={usuario?.nombre}>
            {iniciales(usuario?.nombre)}
          </span>
          <button type="button" onClick={cerrarSesion} className="text-sm font-bold rounded-full px-3 min-h-[44px] text-primary hover:bg-primary-light">
            Salir
          </button>
        </div>
      </div>

      <nav aria-label="Secciones de Arte y Cultura, móvil" className="xl:hidden border-t border-white/80 px-3 py-2 flex gap-1 overflow-x-auto text-sm font-bold [scrollbar-width:none]">
        {MENUS[variante].map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={pildora}>
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/" end className={pildora}>
          Otras dimensiones
        </NavLink>
      </nav>
    </header>
  );
}
