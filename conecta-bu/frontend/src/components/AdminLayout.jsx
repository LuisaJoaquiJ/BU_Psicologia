import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";
import { Logo } from "./Logo";
import { Icono } from "./Iconos";
import { iniciales } from "./Navbar";

// Layout del rol Administrador (rediseño): menú lateral azul y contenido a
// la derecha. En pantallas pequeñas el menú se apila arriba (RNF-005).
const MENU_ADMIN = [
  { to: "/admin", label: "Inicio", icono: "tablero", end: true },
  { to: "/admin/horarios", label: "Horarios", icono: "reloj" },
  { to: "/admin/citas", label: "Agenda de citas", icono: "calendario" },
  { to: "/admin/eventos", label: "Eventos", icono: "estrella" },
  { to: "/admin/usuarios", label: "Usuarios", icono: "usuarios" },
  { to: "/admin/estadisticas", label: "Estadísticas", icono: "grafica" },
];

const claseEnlace = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-3 whitespace-nowrap transition-colors ${
    isActive ? "bg-gold/15 text-[#F3CF7A]" : "text-[#D6DDEC] hover:bg-white/5 hover:text-white"
  }`;

export function AdminLayout({ children }) {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <div className="min-h-screen bg-cream lg:flex overflow-x-hidden">
      <aside className="bg-primary text-white lg:w-[260px] lg:shrink-0 lg:min-h-screen px-4 py-5 lg:py-7 flex flex-col gap-5 lg:gap-7">
        <div className="px-2">
          <Logo to="/" subtitulo="Panel administrativo" invertido />
        </div>
        <nav aria-label="Administración" className="min-w-0 flex lg:flex-col gap-1 text-[15px] font-semibold overflow-x-auto">
          {MENU_ADMIN.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={claseEnlace}>
              <Icono nombre={item.icono} size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/" end className={({ isActive }) => `${claseEnlace({ isActive })} lg:mt-3 lg:border-t lg:border-white/10 lg:rounded-none lg:pt-4`}>
            <Icono nombre="cuadricula" size={18} strokeWidth={2} />
            Módulos BU
          </NavLink>
        </nav>
        <div className="lg:mt-auto flex items-center gap-3 p-3.5 rounded-2xl bg-white/5">
          <span className="w-10 h-10 rounded-full bg-gold text-primary font-bold flex items-center justify-center shrink-0">
            {iniciales(usuario?.nombre)}
          </span>
          <span className="flex-1 min-w-0 leading-tight text-sm">
            <strong className="block truncate">{usuario?.nombre}</strong>
            <span className="text-xs text-white/70">{usuario?.rol}</span>
          </span>
          <button onClick={cerrarSesion} className="text-[13px] font-semibold text-[#D6DDEC] hover:text-white px-2 min-h-[40px]">
            Salir
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
