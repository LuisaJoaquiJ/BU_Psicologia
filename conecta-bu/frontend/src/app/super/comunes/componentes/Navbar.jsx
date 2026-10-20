import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { Icono } from "./Iconos";

// HU-04: barra del estudiante dentro de cada modulo de Conecta BU. Cada
// modulo tiene su propio menu e identidad (nombre y color), para que quede
// claro en cual se esta; "Módulos" vuelve al portal.
const MODULOS_ESTUDIANTE = {
  "desarrollo-humano": {
    nombre: "Desarrollo Humano",
    icono: "persona",
    color: "bg-gold text-primary-dark",
    inicio: "/estudiante",
    menu: [
      { to: "/estudiante", label: "Inicio", end: true },
      { to: "/estudiante/agendar", label: "Pedir una cita" },
      { to: "/estudiante/mis-citas", label: "Mis citas" },
      { to: "/estudiante/eventos", label: "Talleres y eventos" },
      { to: "/estudiante/servicios", label: "Servicios" },
      { to: "/estudiante/asistente", label: "Asistente" },
    ],
  },
  salud: {
    nombre: "Salud Integral",
    icono: "pulso",
    color: "bg-[#0d9488] text-white",
    inicio: "/mi-salud",
    menu: [
      { to: "/mi-salud", label: "Agendar cita", end: true },
      { to: "/mi-salud/mis-citas", label: "Mis citas" },
      { to: "/mi-salud/participaciones", label: "Mis participaciones" },
      { to: "/mi-salud/salidas", label: "Salidas" },
    ],
  },
  deporte: {
    nombre: "Deporte y Recreación",
    icono: "balon",
    color: "bg-[#F97316] text-white",
    inicio: "/mi-deporte",
    menu: [
      { to: "/mi-deporte", label: "Mi avance", end: true },
      { to: "/mi-deporte/oferta", label: "Disciplinas e inscripción" },
      { to: "/mi-deporte/eventos", label: "Eventos" },
      { to: "/mi-deporte/horas", label: "Mis horas" },
    ],
  },
  // Salidas institucionales y reportes SST (cualquier persona de la Institucion).
  sst: {
    nombre: "Salud Integral · Salidas institucionales",
    icono: "pulso",
    color: "bg-[#0d9488] text-white",
    inicio: "/reportes-sst",
    menu: [
      { to: "/reportes-sst", label: "Mis reportes", end: true },
      { to: "/reportes-sst/nuevo", label: "Nuevo reporte" },
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
    isActive ? "boton-liquido" : "text-ink-600 hover:bg-white/80 hover:text-primary"
  }`;

export function Navbar({ modulo = "desarrollo-humano" }) {
  const { usuario, cerrarSesion } = useAuth();
  const datos = MODULOS_ESTUDIANTE[modulo];

  return (
    <header className="sticky top-0 z-30 vidrio-panel !border-x-0 !border-t-0">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 xl:shrink-0">
          <Link to={datos.inicio} className="flex items-center gap-3 min-w-0 no-underline">
            <img src="/img/logo-uniautonoma-marca.png" alt="Uniautónoma del Cauca" className="h-11 sm:h-[52px] w-auto shrink-0" />
            <span className="flex flex-col leading-tight min-w-0">
              <span className="font-extrabold tracking-tight text-primary-dark text-[15px] sm:text-[19px] leading-tight line-clamp-2">{datos.nombre}</span>
              <span className="text-xs sm:text-[13px] text-ink-500">Conecta BU</span>
            </span>
          </Link>
        </div>

        <nav aria-label={datos.nombre} className="hidden xl:flex gap-1 text-[15px] font-bold">
          {datos.menu.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
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
          <button
            onClick={cerrarSesion}
            className="text-sm font-bold rounded-full px-3 min-h-[44px] text-primary hover:bg-primary-light"
          >
            Salir
          </button>
        </div>
      </div>

      {/* RNF-005: en pantallas pequeñas el menú pasa a una fila desplazable. */}
      <nav aria-label={`${datos.nombre} (móvil)`} className="xl:hidden border-t border-white/80 px-3 py-2 flex gap-1 overflow-x-auto text-sm font-bold [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_88%,transparent)]">
        {datos.menu.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={clasePildora}>
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/" end className={clasePildora}>
          Otras dimensiones
        </NavLink>
      </nav>
    </header>
  );
}
