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
  const menu = usuario?.rol === "Administrador" ? MENU_ADMIN : MENU_ESTUDIANTE;

  return (
    <header className="bg-primary text-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">Conecta BU</span>

        <nav className="hidden md:flex gap-4 text-sm">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `hover:underline ${isActive ? "font-semibold underline" : "opacity-90"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="opacity-90">
            {usuario?.nombre} <span className="opacity-70">({usuario?.rol})</span>
          </span>
          <button
            onClick={cerrarSesion}
            className="bg-white/10 hover:bg-white/20 rounded-md px-3 py-1"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </header>
  );
}
