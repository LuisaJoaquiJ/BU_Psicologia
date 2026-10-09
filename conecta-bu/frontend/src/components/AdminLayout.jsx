import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthContext";
import { Icono } from "./Iconos";
import { iniciales } from "./Navbar";
import { MODULOS_DISPONIBLES } from "../lib/modulos";

// Panel del personal de Desarrollo Humano.
const MENU_ADMIN = [
  { to: "/admin", label: "Inicio", icono: "tablero", end: true },
  { to: "/admin/citas", label: "Agenda", icono: "calendario" },
  { to: "/admin/horarios", label: "Horarios", icono: "reloj" },
  { to: "/admin/eventos", label: "Talleres y eventos", icono: "estrella" },
  { to: "/admin/estadisticas", label: "Estadísticas", icono: "grafica" },
];

// Identidad de cada panel: asi siempre se sabe en que modulo se esta.
const PANELES = {
  "desarrollo-humano": { nombre: "Desarrollo Humano", icono: "persona", color: "bg-gold text-primary" },
  salud: { nombre: "Salud Integral", icono: "pulso", color: "bg-[#14B8A6] text-primary" },
  deporte: { nombre: "Deporte y Recreación", icono: "balon", color: "bg-[#F97316] text-white" },
  super: { nombre: "Superadministrador", icono: "escudo", color: "bg-white text-primary" },
};

const ROL_TEXTO = { Administrador: "Personal del módulo", SuperAdministrador: "Superadministrador", Estudiante: "Estudiante" };

// Barra superior azul noche (propuesta B), compartida por los paneles del
// personal de cada dimensión y por el del superadministrador: arriba la
// identidad (logo, dimensión, persona) y debajo el menú en pastillas, que en
// el celular se desplaza de lado.
const clasePildora = ({ isActive }) =>
  `inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 min-h-[44px] transition-colors ${
    isActive ? "bg-cyan text-primary-dark" : "text-[#D9E2F2] hover:bg-white/10 hover:text-white"
  }`;

export function PanelLayout({ menu, panel, children }) {
  const { usuario, cerrarSesion } = useAuth();
  const datos = PANELES[panel];

  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      <header className="bg-primary-dark text-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-3 pb-2 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0 no-underline">
            <span className="shrink-0 flex bg-white rounded-[10px] px-1.5 py-1">
              <img src="/img/logo-uniautonoma-marca.png" alt="Uniautónoma del Cauca" className="h-9 sm:h-11 w-auto" />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-extrabold tracking-tight text-[15px] sm:text-lg line-clamp-2">{datos.nombre}</span>
              <span className="text-xs sm:text-[13px] text-[#B9C7DE]">{panel === "super" ? "Conecta BU" : "Panel del personal"}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {usuario?.rol === "SuperAdministrador" && panel !== "super" && (
              <Link to="/super" title="Volver al panel del superadministrador" className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-bold bg-white/10 text-white hover:bg-white/20">
                <Icono nombre="escudo" size={16} strokeWidth={2} />
                <span className="hidden md:inline">Volver a Superadministrador</span>
              </Link>
            )}
            <Link to="/" className="hidden sm:inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-bold text-[#D9E2F2] hover:bg-white/10">
              <Icono nombre="cuadricula" size={16} strokeWidth={2} />
              Cambiar de dimensión
            </Link>
            <span
              title={`${usuario?.nombre || ""} · ${ROL_TEXTO[usuario?.rol] || usuario?.rol || ""}`}
              className="w-10 h-10 rounded-full bg-cyan text-primary-dark font-extrabold text-sm flex items-center justify-center shrink-0"
            >
              {iniciales(usuario?.nombre)}
            </span>
            <button onClick={cerrarSesion} className="text-sm font-bold text-[#D9E2F2] hover:text-white px-2 min-h-[44px]">
              Salir
            </button>
          </div>
        </div>
        <nav
          aria-label="Menú del panel"
          className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-9 pb-2.5 flex gap-1 overflow-x-auto text-sm sm:text-[15px] font-bold [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_90%,transparent)] xl:[mask-image:none] xl:flex-wrap"
        >
          {panel === "super" ? (
            <>
              {/* El superadministrador entra a cada modulo desde aqui, por su nombre. */}
              <NavLink to={menu[0].to} end className={clasePildora}>
                {menu[0].label}
              </NavLink>
              <span aria-hidden="true" className="self-center mx-1.5 h-6 w-px bg-white/25 shrink-0" />
              {MODULOS_DISPONIBLES.map((m) => (
                <NavLink key={m.id} to={m.panel.personal} className={clasePildora} title={`Entrar al panel de ${m.nombre}`}>
                  <Icono nombre={m.icono} size={16} strokeWidth={2} />
                  {m.corto}
                </NavLink>
              ))}
              <span aria-hidden="true" className="self-center mx-1.5 h-6 w-px bg-white/25 shrink-0" />
              {menu.slice(1).map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
                  {item.label}
                </NavLink>
              ))}
            </>
          ) : (
            <>
              {menu.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
                  {item.label}
                </NavLink>
              ))}
              <NavLink to="/" end className={(e) => `${clasePildora(e)} sm:hidden`}>
                Otras dimensiones
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminLayout({ children }) {
  return (
    <PanelLayout menu={MENU_ADMIN} panel="desarrollo-humano">
      {children}
    </PanelLayout>
  );
}
