import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";
import { Logo } from "./Logo";

// HU-04: barra del rol Estudiante (rediseño: menú en "píldoras"). El rol
// Administrador usa AdminLayout, con menú lateral.
const MENU_ESTUDIANTE = [
  { to: "/", label: "Módulos", end: true },
  { to: "/estudiante", label: "Inicio", end: true },
  { to: "/estudiante/servicios", label: "Servicios" },
  { to: "/estudiante/mis-citas", label: "Mis citas" },
  { to: "/estudiante/eventos", label: "Eventos" },
  { to: "/estudiante/asistente", label: "Asistente" },
];

export function iniciales(nombre = "") {
  return (
    nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

const clasePildora = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-2.5 transition-colors ${
    isActive ? "bg-primary text-white" : "text-ink-600 hover:bg-primary-light hover:text-primary"
  }`;

export function Navbar() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-5">
        <Logo to="/" subtitulo={null} />

        <nav aria-label="Estudiante" className="hidden md:flex gap-1.5 text-sm font-semibold">
          {MENU_ESTUDIANTE.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-right leading-tight">
            <span className="block text-sm font-semibold text-ink-900">{usuario?.nombre}</span>
            <span className="block text-xs text-ink-500">{usuario?.rol}</span>
          </span>
          <span className="w-10 h-10 rounded-full bg-gold-light text-accent font-bold text-sm flex items-center justify-center shrink-0">
            {iniciales(usuario?.nombre)}
          </span>
          <button
            onClick={cerrarSesion}
            className="text-sm font-semibold border border-gray-200 rounded-full px-4 min-h-[40px] text-ink-600 hover:bg-gray-50"
          >
            Salir
          </button>
        </div>
      </div>

      {/* RNF-005: en pantallas pequeñas el menú pasa a una fila desplazable. */}
      <nav aria-label="Estudiante (móvil)" className="md:hidden border-t border-gray-100 px-3 py-2 flex gap-1 overflow-x-auto text-sm font-semibold">
        {MENU_ESTUDIANTE.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
