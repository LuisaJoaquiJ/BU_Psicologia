import { CampanaNotificaciones } from "../../../../components/CampanaNotificaciones";
import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { Icono } from "./Iconos";

// HU-04: barra del estudiante dentro de cada modulo de Conecta BU. Cada
// modulo tiene su propio menu e identidad (nombre y color), para que quede
// claro en cual se esta; "Módulos" vuelve al portal.
const MODULOS_ESTUDIANTE = {
  cultura: {
    nombre: "Arte y Cultura",
    icono: "musica",
    color: "bg-[#6D4CC4] text-white",
    inicio: "/mi-cultura",
    menu: [
      { to: "/mi-cultura", label: "Inicio", icono: "tablero", corto: "Inicio", end: true },
      { to: "/mi-cultura/grupos", label: "Grupos y talleres", icono: "musica", corto: "Grupos" },
      { to: "/mi-cultura/agenda", label: "Agenda cultural", icono: "calendario", corto: "Agenda" },
      { to: "/mi-cultura/convocatorias", label: "Convocatorias", icono: "estrella", corto: "Convocatorias" },
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

// Navegacion: no es un boton. El lugar actual lleva fondo suave, texto oscuro y una
// marca debajo (no depende solo del color); los botones de accion son los que tienen degradado.
const clasePildora = ({ isActive }) =>
  `relative whitespace-nowrap rounded-xl px-4 py-2.5 transition-colors after:absolute after:left-4 after:right-4 after:-bottom-px after:h-[3px] after:rounded-full after:transition-opacity ${
    isActive ? "bg-primary-light/70 text-primary-dark after:bg-primary after:opacity-100" : "text-ink-600 hover:bg-white/80 hover:text-primary after:opacity-0"
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

export function Navbar({ modulo = "cultura" }) {
  const { usuario, cerrarSesion } = useAuth();
  const datos = MODULOS_ESTUDIANTE[modulo];

  // La barra inferior va fuera del encabezado: su vidrio (backdrop-filter)
  // haria que "fixed" se mida desde el encabezado y no desde la pantalla.
  return (
    <>
    {/* Barra flotante de vidrio, la misma del portal: queda arriba al bajar y deja ver la pagina por debajo. */}
    <header className="sticky top-0 z-30 px-3 sm:px-6 lg:px-10 pt-3">
      <div className="max-w-[1440px] mx-auto rounded-[28px] pl-3 sm:pl-5 pr-2 sm:pr-3 py-2 flex items-center justify-between gap-4 bg-[linear-gradient(140deg,rgba(255,255,255,0.72),rgba(255,255,255,0.42))] backdrop-blur-2xl backdrop-saturate-150 border border-white/80 shadow-[inset_0_1px_0_#fff,0_8px_32px_rgba(11,35,71,0.1)] supports-[not(backdrop-filter:blur(1px))]:bg-white">
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
          <CampanaNotificaciones />
          <span className="w-10 h-10 rounded-full bg-primary-light text-primary-dark ring-1 ring-primary/25 font-extrabold text-sm flex items-center justify-center shrink-0 select-none" title={usuario?.nombre}>
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
