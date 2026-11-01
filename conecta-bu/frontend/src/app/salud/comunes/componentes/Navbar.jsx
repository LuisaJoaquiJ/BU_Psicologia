import { useEffect, useState } from "react";
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
      { to: "/estudiante", label: "Inicio", icono: "tablero", corto: "Inicio", end: true },
      { to: "/estudiante/agendar", label: "Pedir una cita", icono: "calendario", corto: "Pedir cita" },
      { to: "/estudiante/mis-citas", label: "Mis citas", icono: "lista", corto: "Mis citas" },
      { to: "/estudiante/eventos", label: "Talleres y eventos", icono: "estrella", corto: "Eventos" },
      { to: "/estudiante/servicios", label: "Servicios", icono: "cuadricula", corto: "Servicios" },
      { to: "/estudiante/asistente", label: "Asistente", icono: "chat", corto: "Asistente" },
    ],
  },
  salud: {
    nombre: "Salud Integral",
    icono: "pulso",
    color: "bg-[#0d9488] text-white",
    inicio: "/mi-salud",
    menu: [
      { to: "/mi-salud", label: "Agendar cita", icono: "calendario", corto: "Agendar", end: true },
      { to: "/mi-salud/mis-citas", label: "Mis citas", icono: "lista", corto: "Mis citas" },
      { to: "/mi-salud/jornadas", label: "Jornadas y campañas", icono: "pulso", corto: "Jornadas" },
      { to: "/mi-salud/participaciones", label: "Mis participaciones", icono: "check", corto: "Historial" },
      { to: "/mi-salud/salidas", label: "Salidas", icono: "bus", corto: "Salidas" },
    ],
  },
  deporte: {
    nombre: "Deporte y Recreación",
    icono: "balon",
    color: "bg-[#F97316] text-white",
    inicio: "/mi-deporte",
    menu: [
      { to: "/mi-deporte", label: "Mi avance", icono: "tablero", corto: "Mi avance", end: true },
      { to: "/mi-deporte/oferta", label: "Disciplinas e inscripción", icono: "balon", corto: "Disciplinas" },
      { to: "/mi-deporte/eventos", label: "Eventos", icono: "trofeo", corto: "Eventos" },
      { to: "/mi-deporte/horas", label: "Mis horas", icono: "reloj", corto: "Mis horas" },
    ],
  },
  // Salidas institucionales y reportes SST (cualquier persona de la Institucion).
  sst: {
    nombre: "Salud Integral · Salidas institucionales",
    icono: "pulso",
    color: "bg-[#0d9488] text-white",
    inicio: "/reportes-sst",
    menu: [
      { to: "/reportes-sst", label: "Mis reportes", icono: "lista", corto: "Mis reportes", end: true },
      { to: "/reportes-sst/nuevo", label: "Nuevo reporte", icono: "mas", corto: "Nuevo" },
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

// Celular: barra inferior fija con iconos, al alcance del pulgar. Hasta cinco
// espacios; con mas opciones, las ultimas van en "Más".
const claseTab = ({ isActive }) =>
  `flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-2xl text-[11px] font-bold no-underline transition-colors ${
    isActive ? "text-primary" : "text-ink-600 hover:text-primary"
  }`;

function IconoTab({ nombre, activo }) {
  return (
    <span className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${activo ? "bg-primary-light" : ""}`}>
      <Icono nombre={nombre} size={20} strokeWidth={2} />
    </span>
  );
}

function BarraInferior({ menu, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const visibles = menu.length > 5 ? menu.slice(0, 4) : menu;
  const resto = menu.length > 5 ? menu.slice(4) : [];

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  return (
    <nav aria-label={`${nombre} (celular)`} className="md:hidden fixed bottom-0 inset-x-0 z-40 vidrio-panel !border-x-0 !border-b-0 rounded-t-[22px] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))]">
      {abierto && (
        <div className="absolute right-2 bottom-full mb-2 w-56 vidrio-panel rounded-2xl p-1.5 flex flex-col">
          {resto.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setAbierto(false)}
              className={({ isActive }) => `flex items-center gap-3 min-h-[48px] px-3 rounded-xl font-bold text-sm no-underline ${isActive ? "bg-primary-light text-primary" : "text-ink-900 hover:bg-white"}`}
            >
              <Icono nombre={item.icono} size={19} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
      <ul className="list-none m-0 p-0 grid gap-1" style={{ gridTemplateColumns: `repeat(${visibles.length + (resto.length ? 1 : 0)}, minmax(0, 1fr))` }}>
        {visibles.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={claseTab} onClick={() => setAbierto(false)}>
              {({ isActive }) => (
                <>
                  <IconoTab nombre={item.icono} activo={isActive} />
                  <span className="truncate max-w-full">{item.corto}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        {resto.length > 0 && (
          <li>
            <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className={claseTab({ isActive: abierto }) + " w-full"}>
              <IconoTab nombre="menu" activo={abierto} />
              Más
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

export function Navbar({ modulo = "desarrollo-humano" }) {
  const { usuario, cerrarSesion } = useAuth();
  const datos = MODULOS_ESTUDIANTE[modulo];

  // La barra inferior va fuera del encabezado: su vidrio (backdrop-filter)
  // haria que "fixed" se mida desde el encabezado y no desde la pantalla.
  return (
    <>
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
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-primary burbuja rounded-full min-w-[44px] px-3 min-h-[44px] hover:bg-white"
          >
            <Icono nombre="cuadricula" size={16} strokeWidth={2} />
            <span className="hidden sm:inline xl:hidden 2xl:inline">Cambiar de dimensión</span>
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

      {/* RNF-005: en tableta el menú pasa a una fila desplazable; en el celular, a la barra inferior. */}
      <nav aria-label={`${datos.nombre} (tableta)`} className="hidden md:flex xl:hidden border-t border-white/80 px-3 py-2 flex gap-1 overflow-x-auto text-sm font-bold [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_88%,transparent)]">
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
    <BarraInferior menu={datos.menu} nombre={datos.nombre} />
    </>
  );
}
