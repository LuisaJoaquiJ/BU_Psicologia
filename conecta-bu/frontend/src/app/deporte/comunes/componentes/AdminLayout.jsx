import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { Icono } from "./Iconos";
import { iniciales } from "./Navbar";
import { inicioDirecto } from "../../../../lib/modulos";

// Identidad del panel: asi siempre se sabe en que modulo se esta.
const PANELES = {
  deporte: { nombre: "Deporte y Recreación", icono: "balon", color: "bg-orange-50 text-orange-700" },
  "deporte-docente": { nombre: "Deporte y Recreación", subtitulo: "Panel del docente", icono: "balon", color: "bg-orange-50 text-orange-700" },
};

const ROL_TEXTO = { Administrador: "Personal del módulo", SuperAdministrador: "Superadministrador", Estudiante: "Estudiante" };

// Preferencia de menu plegado (solo en pantallas grandes), guardada en el navegador.
const CLAVE_PLEGADO = "conectabu_menu_plegado";
function leerPlegado() {
  try {
    return localStorage.getItem(CLAVE_PLEGADO) === "1";
  } catch {
    return false;
  }
}

// Enlace del menu lateral: el activo lleva fondo azul claro, texto azul y
// una marca a la izquierda (no depende solo del color). Plegado, solo el icono.
const claseEnlace = (plegado) => ({ isActive }) =>
  `relative flex items-center gap-3 rounded-2xl px-3 min-h-[44px] text-sm font-medium transition-colors ${plegado ? "lg:justify-center lg:px-0" : ""} ${
    isActive
      ? "boton-liquido font-semibold"
      : "text-ink-600 hover:bg-white/80 hover:text-ink-900"
  }`;

// Panel del personal con menu lateral fijo que se puede plegar (queda solo la
// columna de iconos). En el celular se abre con el boton de menu. Arriba el
// logo y el modulo; abajo la persona y "Salir".
export function PanelLayout({ menu, panel, children }) {
  const { usuario, cerrarSesion } = useAuth();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [plegado, setPlegado] = useState(leerPlegado);
  // Textos que se ocultan con el menu plegado (en el celular siempre se ven).
  const oculto = plegado ? "lg:hidden" : "";
  const alternar = () =>
    setPlegado((v) => {
      try {
        localStorage.setItem(CLAVE_PLEGADO, v ? "0" : "1");
      } catch {
        /* sin almacenamiento: solo dura esta visita */
      }
      return !v;
    });
  const datos = PANELES[panel];
  // Personal con un solo modulo (o superadministrador): entra directo a su
  // panel, asi que no se ofrece "Cambiar de dimensión".
  const directo = inicioDirecto(usuario);

  useEffect(() => setAbierto(false), [pathname]);
  // Con el menu desplegado, su ancho va en la variable CSS --menu y las
  // ventanas emergentes se abren a su derecha; plegado (o en el celular)
  // vale 0 y las ventanas ocupan toda la pantalla, por encima del menu.
  useEffect(() => {
    const raiz = document.documentElement.style;
    raiz.setProperty("--menu", plegado ? "0px" : "17rem");
    return () => raiz.removeProperty("--menu");
  }, [plegado]);
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = (e) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [abierto]);

  return (
    <div className={`min-h-screen fondo-panel panel-moderno overflow-x-hidden transition-[padding] duration-200 ${plegado ? "lg:pl-[96px]" : "lg:pl-[284px]"}`}>
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between gap-3 vidrio-panel !border-x-0 !border-t-0">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el menú"
          aria-expanded={abierto}
          className="w-10 h-10 -ml-2 rounded-md flex items-center justify-center text-ink-900 hover:bg-gray-100"
        >
          <Icono nombre="menu" size={22} />
        </button>
        <span className="font-display font-semibold text-[15px] tracking-tight text-ink-900 truncate">{datos.nombre}</span>
        <span className="w-9 h-9 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center shrink-0">{iniciales(usuario?.nombre)}</span>
      </header>

      {abierto && <div className="lg:hidden fixed inset-0 z-40 bg-ink-900/30" onClick={() => setAbierto(false)} aria-hidden="true" />}

      <aside
        aria-label="Menú del panel"
        className={`fixed inset-y-0 left-0 lg:inset-y-3 lg:left-3 z-50 w-64 flex flex-col vidrio-panel lg:rounded-[28px] transition-[transform,width] duration-200 lg:translate-x-0 ${plegado ? "lg:w-[72px]" : ""} ${
          abierto ? "translate-x-0 shadow-lg" : "-translate-x-full"
        }`}
      >

        <div className={`px-5 pt-5 pb-4 flex items-start justify-between gap-2 ${plegado ? "lg:px-0 lg:justify-center" : ""}`}>
          {/* En pantallas grandes el logo pliega y despliega el menu; en el celular lleva al inicio. */}
          <button
            type="button"
            onClick={alternar}
            aria-label={plegado ? "Desplegar el menú" : "Plegar el menú"}
            aria-expanded={!plegado}
            title={plegado ? "Desplegar el menú" : "Plegar el menú"}
            className="hidden lg:flex items-center gap-2.5 min-w-0 -m-1.5 p-1.5 rounded-2xl text-left transition-colors hover:bg-white/70"
          >
            <img src="/img/logo-uniautonoma-marca.png" alt="" className={`w-auto shrink-0 ${plegado ? "lg:h-8" : ""} h-10`} />
            <span className={`flex flex-col leading-tight min-w-0 ${oculto}`}>
              <span className="font-display font-semibold text-[15px] tracking-tight text-ink-900">Conecta BU</span>
              <span className="text-xs text-ink-500">Bienestar Universitario</span>
            </span>
          </button>
          <Link to={directo || "/"} className="lg:hidden flex items-center gap-2.5 min-w-0 no-underline">
            <img src="/img/logo-uniautonoma-marca.png" alt="Uniautónoma del Cauca" className={`w-auto shrink-0 ${plegado ? "lg:h-8" : ""} h-10`} />
            <span className={`flex flex-col leading-tight min-w-0 ${oculto}`}>
              <span className="font-display font-semibold text-[15px] tracking-tight text-ink-900">Conecta BU</span>
              <span className="text-xs text-ink-500">Bienestar Universitario</span>
            </span>
          </Link>
          <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar el menú" className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center text-ink-500 hover:bg-gray-100">
            <Icono nombre="cerrar" size={18} />
          </button>
        </div>

        <div title={plegado ? datos.nombre : undefined} className={`mx-4 mb-4 rounded-2xl burbuja px-3 py-2.5 flex items-center gap-2.5 ${plegado ? "lg:mx-auto lg:border-0 lg:p-0" : ""}`}>
          <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${datos.color}`}>
            <Icono nombre={datos.icono} size={16} strokeWidth={2} />
          </span>
          <span className={`flex flex-col leading-tight min-w-0 ${oculto}`}>
            <span className="text-sm font-semibold text-ink-900 truncate">{datos.nombre}</span>
            <span className="text-xs text-ink-500 truncate">{datos.subtitulo || (panel === "super" ? "Conecta BU" : "Panel del personal")}</span>
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-0.5">
          <p className={`m-0 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 ${oculto}`}>Menú</p>
          {menu.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={claseEnlace(plegado)} title={plegado ? item.label : undefined} aria-label={plegado ? item.label : undefined}>
              <Icono nombre={item.icono} size={18} strokeWidth={1.8} />
              <span className={`truncate ${oculto}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/80 p-3 flex flex-col gap-1">
          {!directo && (
            <Link
              to="/"
              title={plegado ? "Cambiar de dimensión" : undefined}
              aria-label={plegado ? "Cambiar de dimensión" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 min-h-[40px] text-sm font-medium text-ink-600 hover:bg-gray-100 hover:text-ink-900 no-underline ${plegado ? "lg:justify-center lg:px-0" : ""}`}
            >
              <Icono nombre="cuadricula" size={18} strokeWidth={1.8} />
              <span className={oculto}>Cambiar de dimensión</span>
            </Link>
          )}
          <div className={`flex items-center gap-2.5 px-2 pt-2 ${plegado ? "lg:flex-col lg:px-0" : ""}`}>
            <span title={plegado ? usuario?.nombre : undefined} className="w-9 h-9 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center shrink-0">
              {iniciales(usuario?.nombre)}
            </span>
            <span className={`flex flex-col leading-tight min-w-0 flex-1 ${oculto}`}>
              <span className="text-sm font-medium text-ink-900 truncate">{usuario?.nombre}</span>
              <span className="text-xs text-ink-500 truncate">{ROL_TEXTO[usuario?.rol] || usuario?.rol}</span>
            </span>
            <button type="button" onClick={cerrarSesion} className="text-sm font-medium text-ink-600 hover:text-red-600 px-2 min-h-[36px] rounded-md hover:bg-gray-100">
              Salir
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
