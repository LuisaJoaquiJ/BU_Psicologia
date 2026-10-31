import { Link, NavLink } from "react-router-dom";
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

export function Barra({ variante = "estudiante" }) {
  const { usuario, cerrarSesion } = useAuth();
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <Link to="/" className="font-extrabold text-primary-dark no-underline">
          Arte y Cultura
        </Link>
        <nav className="flex flex-wrap gap-1" aria-label="Secciones de Arte y Cultura">
          {MENUS[variante].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-3 min-h-[40px] inline-flex items-center text-sm font-semibold no-underline ${
                  isActive ? "boton-liquido" : "text-ink-600 hover:bg-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-ink-500">{usuario?.nombre}</span>
          <button type="button" onClick={cerrarSesion} className="text-sm font-bold text-primary">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
