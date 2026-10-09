import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";

// HU-04: cada rol ve unicamente las opciones que le corresponden.
const MENU_ESTUDIANTE = [
  { to: "/estudiante", label: "Inicio" },
  { to: "/estudiante/servicios", label: "Servicios" },
  { to: "/estudiante/mis-citas", label: "Mis citas" },
  { to: "/estudiante/eventos", label: "Eventos" },
  { to: "/estudiante/asistente", label: "Asistente" },
];

const MENU_ADMIN = [
  { to: "/admin", label: "Inicio" },
  { to: "/admin/horarios", label: "Horarios" },
  { to: "/admin/citas", label: "Agenda de citas" },
  { to: "/admin/eventos", label: "Eventos" },
  { to: "/admin/usuarios", label: "Usuarios" },
];

export function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const esAdmin = usuario?.rol === "Administrador";
  const menu = esAdmin ? MENU_ADMIN : MENU_ESTUDIANTE;

  const iniciales = (usuario?.nombre || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white font-bold text-sm rounded-[10px] w-10 h-8 flex items-center justify-center shrink-0">
            UA
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-ink-900 text-[15px]">Conecta BU</p>
            <p className="text-gray-500 text-xs">
              {esAdmin ? "Panel administrativo" : "Bienestar · Psicología"}
            </p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-gray-500 hover:text-ink-900"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <p className="text-sm font-semibold text-ink-900">{usuario?.nombre}</p>
            <p className="text-xs text-gray-500">{usuario?.rol}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-accent-light flex items-center justify-center text-accent font-semibold text-sm shrink-0">
            {iniciales || "?"}
          </div>
          <button
            onClick={cerrarSesion}
            className="ml-1 text-sm border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
