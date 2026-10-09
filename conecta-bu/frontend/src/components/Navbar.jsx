import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";
import { Icono } from "./Iconos";

// HU-04: barra del estudiante dentro de cada modulo de Conecta BU. Cada
// modulo tiene su propio menu e identidad (nombre y color), para que quede
// claro en cual se esta; "Módulos" vuelve al portal.
const MODULOS_ESTUDIANTE = {
  "desarrollo-humano": {
    nombre: "Desarrollo humano y orientación",
    icono: "persona",
    color: "bg-gold text-primary",
    inicio: "/estudiante",
    menu: [
      { to: "/estudiante", label: "Inicio", end: true },
      { to: "/estudiante/servicios", label: "Servicios" },
      { to: "/estudiante/mis-citas", label: "Mis citas" },
      { to: "/estudiante/eventos", label: "Eventos" },
      { to: "/estudiante/asistente", label: "Asistente" },
    ],
  },
  salud: {
    nombre: "Salud integral",
    icono: "pulso",
    color: "bg-[#0d9488] text-white",
    inicio: "/mi-salud",
    menu: [
      { to: "/mi-salud", label: "Agendar cita", end: true },
      { to: "/mi-salud/mis-citas", label: "Mis citas" },
      { to: "/mi-salud/participaciones", label: "Mis participaciones" },
    ],
  },
};

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

export function Navbar({ modulo = "desarrollo-humano" }) {
  const { usuario, cerrarSesion } = useAuth();
  const datos = MODULOS_ESTUDIANTE[modulo];

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-5">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={datos.inicio} className="flex items-center gap-3 min-w-0 no-underline">
            <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${datos.color}`}>
              <Icono nombre={datos.icono} size={22} strokeWidth={2} />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-ink-500">Conecta BU</span>
              <span className="font-bold text-primary truncate">{datos.nombre}</span>
            </span>
          </Link>
        </div>

        <nav aria-label={datos.nombre} className="hidden lg:flex gap-1.5 text-sm font-semibold">
          {datos.menu.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/"
            title="Cambiar de módulo"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 border border-gray-200 rounded-full px-3.5 min-h-[40px] hover:bg-gray-50"
          >
            <Icono nombre="cuadricula" size={16} strokeWidth={2} />
            Módulos
          </Link>
          <span className="w-10 h-10 rounded-full bg-gold-light text-accent font-bold text-sm flex items-center justify-center shrink-0" title={usuario?.nombre}>
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
      <nav aria-label={`${datos.nombre} (móvil)`} className="lg:hidden border-t border-gray-100 px-3 py-2 flex gap-1 overflow-x-auto text-sm font-semibold">
        {datos.menu.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/" end className={clasePildora}>
          Módulos
        </NavLink>
      </nav>
    </header>
  );
}
