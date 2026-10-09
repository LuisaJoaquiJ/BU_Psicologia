import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { IMAGENES } from "../../lib/imagenes";
import { MODULOS, MODULOS_DISPONIBLES, modulosDe, rutaModulo } from "../../lib/modulos";
import { Logo } from "../../components/Logo";
import { Icono } from "../../components/Iconos";
import { iniciales } from "../../components/Navbar";
import { ProximosEventos } from "../inicio/LandingPage";

// Portal de Conecta BU ("/"): punto de entrada a los cinco modulos de
// Bienestar Universitario. Los modulos disponibles se configuran en
// lib/modulos.js; los demas aparecen como "Próximamente".

function Encabezado() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth();
  return (
    <header className="px-4 sm:px-6 pt-5 relative z-20">
      <div className="max-w-[1200px] mx-auto bg-white rounded-full shadow-[0_10px_30px_rgba(11,42,91,0.08)] pl-3 sm:pl-5 pr-3 py-3 flex items-center justify-between gap-3 sm:gap-4">
        <span className="hidden sm:block">
          <Logo subtitulo="Bienestar Universitario · Uniautónoma del Cauca" />
        </span>
        <span className="sm:hidden">
          <Logo subtitulo="" />
        </span>
        <nav aria-label="Portal" className="hidden md:flex items-center gap-1 text-[15px] font-semibold">
          <a href="#modulos" className="text-primary hover:text-primary-soft px-3 py-2.5 rounded-full">Módulos</a>
          <a href="#agenda" className="text-ink-600 hover:text-primary px-3 py-2.5 rounded-full">Agenda</a>
          <a href="#ayuda" className="text-ink-600 hover:text-primary px-3 py-2.5 rounded-full">Ayuda</a>
        </nav>
        {estaAutenticado ? (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <span className="hidden sm:block text-right leading-tight min-w-0">
              <span className="block text-sm font-semibold text-ink-900 truncate max-w-[220px]">{usuario?.nombre}</span>
              <span className="block text-xs text-accent font-semibold">
                {{ Administrador: "Personal", SuperAdministrador: "Superadministrador" }[usuario?.rol] || usuario?.rol}
              </span>
            </span>
            <span className="w-10 h-10 rounded-full bg-gold text-primary font-bold text-sm flex items-center justify-center shrink-0">
              {iniciales(usuario?.nombre)}
            </span>
            <button
              onClick={cerrarSesion}
              className="text-sm font-semibold border border-gray-200 rounded-full px-4 min-h-[40px] text-ink-600 hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-primary text-white font-bold text-[15px] px-5 min-h-[44px] rounded-full inline-flex items-center shrink-0 whitespace-nowrap hover:bg-primary-dark"
          >
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}

function Hero() {
  const { usuario } = useAuth();
  const nombre = usuario?.nombre?.split(" ")[0];
  const accesibles = modulosDe(usuario);
  const habilitados = accesibles.map((m) => m.nombre.charAt(0).toLowerCase() + m.nombre.slice(1));
  const principal = accesibles[0];

  return (
    <section className="relative rounded-[32px] overflow-hidden bg-primary isolate">
      <img
        src={IMAGENES.sede.src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover -z-10 opacity-60"
        style={{ objectPosition: "50% 35%" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(7,29,64,0.97)_0%,rgba(11,42,91,0.9)_45%,rgba(11,42,91,0.55)_100%)]"
      />
      <svg aria-hidden="true" viewBox="0 0 600 600" className="absolute -right-40 -bottom-48 w-[560px] h-[560px] -z-10">
        <circle cx="300" cy="300" r="280" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
        <circle cx="300" cy="300" r="200" fill="none" stroke="rgba(232,178,58,0.35)" strokeWidth="1.5" />
        <circle cx="300" cy="300" r="120" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
      </svg>

      <div className="flex flex-wrap items-center gap-10 px-7 py-12 sm:px-14 sm:py-16">
        <div className="flex-[1_1_440px] min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-white text-[44px] sm:text-[64px] leading-[1.02] font-semibold">
              Conecta{" "}
              <span className="inline-block bg-gold-soft text-primary px-3.5 pb-1 rounded-2xl -rotate-2">BU</span>
            </h1>
            <p className="m-0 text-base font-medium text-[#C9D3E6]">
              Bienestar Universitario · Corporación Universitaria Autónoma del Cauca
            </p>
          </div>
          <p className="m-0 text-lg leading-relaxed text-[#D6DDEC] max-w-[540px] [text-wrap:pretty]">
            {usuario && habilitados.length > 0 ? (
              <>
                Hola, <strong className="text-white">{nombre}</strong>.{" "}
                {accesibles.length === 1 ? (
                  <>
                    {usuario.rol === "Estudiante" ? "Puedes entrar a " : "Tienes acceso al panel de "}
                    <strong className="text-white">{habilitados[0]}</strong>.
                  </>
                ) : (
                  "Cada módulo es independiente: elige a cuál quieres entrar."
                )}
              </>
            ) : usuario ? (
              <>
                Hola, <strong className="text-white">{nombre}</strong>. Todavía no tienes módulos asignados. Pide al superadministrador de
                Conecta BU que asigne tu correo.
              </>
            ) : (
              <>
                Todos los servicios de Bienestar en un solo lugar: orientación, deporte, salud, cultura y acompañamiento para
                tu permanencia. Ingresa con tu cuenta institucional.
              </>
            )}
          </p>
          <div className="flex gap-3 flex-wrap mt-1">
            {usuario?.rol === "SuperAdministrador" && (
              <Link
                to="/super"
                className="bg-white text-primary font-bold text-[15px] px-6 min-h-[50px] rounded-full inline-flex items-center gap-2 hover:bg-gold-soft"
              >
                <Icono nombre="escudo" size={18} strokeWidth={2.2} />
                Panel de superadministrador
              </Link>
            )}
            {usuario && principal && accesibles.length === 1 ? (
              <Link
                to={rutaModulo(principal, usuario)}
                className="bg-gold text-primary font-bold text-[15px] px-6 min-h-[50px] rounded-full inline-flex items-center gap-2 whitespace-nowrap hover:brightness-95"
              >
                Ir a {principal.corto}
                <Icono nombre="flecha" size={18} strokeWidth={2.2} />
              </Link>
            ) : usuario ? null : (
              <Link
                to="/login"
                className="bg-gold text-primary font-bold text-[15px] px-6 min-h-[50px] rounded-full inline-flex items-center hover:brightness-95"
              >
                Ingresar con Google
              </Link>
            )}
            <a
              href="#modulos"
              className="border-[1.5px] border-white/45 text-white font-semibold text-[15px] px-6 min-h-[50px] rounded-full inline-flex items-center hover:bg-white/10"
            >
              Ver módulos
            </a>
          </div>
        </div>

        {/* Con sesion: accesos directos solo a los modulos de la persona. Sin sesion
            la foto de la sede queda visible y los modulos se ven en la seccion siguiente. */}
        {usuario && accesibles.length > 1 && (
          <nav
            aria-labelledby="tus-modulos"
            className="flex-[1_1_320px] min-w-0 max-w-[420px] bg-primary-dark/90 border border-white/10 rounded-[26px] p-5 sm:p-6 shadow-[0_24px_48px_rgba(4,16,38,0.35)]"
          >
            <h2 id="tus-modulos" className="m-0 mb-3 text-white text-xl font-semibold">
              Tus módulos
            </h2>
            <ul className="list-none m-0 p-0 flex flex-col">
              {accesibles.map((m) => (
                <li key={m.id} className="border-t border-white/10 first:border-t-0">
                  <Link
                    to={rutaModulo(m, usuario)}
                    className="group flex items-center gap-3 rounded-2xl px-2 py-3 -mx-2 hover:bg-white/[0.07] transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold text-primary">
                      <Icono nombre={m.icono} size={20} strokeWidth={2} />
                    </span>
                    <span className="flex-1 min-w-0 text-[15px] leading-snug font-semibold text-white">{m.nombre}</span>
                    <Icono
                      nombre="flecha"
                      size={18}
                      strokeWidth={2.2}
                      className="text-gold shrink-0 transition-transform motion-safe:group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}

function TarjetaModulo({ modulo, destacada, ancho }) {
  const { usuario } = useAuth();
  const ruta = rutaModulo(modulo, usuario);
  const disponible = modulo.estado === "disponible";

  return (
    <article
      className={`group relative rounded-[26px] overflow-hidden flex flex-col bg-white border border-gray-200 transition-all ${
        disponible ? "motion-safe:hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(11,42,91,0.14)]" : ""
      } ${ancho || (destacada ? "sm:col-span-2 md:col-span-3" : "md:col-span-2")}`}
    >
      <div className={`relative overflow-hidden bg-primary ${destacada ? "h-[240px]" : "h-[150px]"}`}>
        <img
          src={modulo.imagen.src}
          alt={modulo.imagen.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
            disponible ? "motion-safe:group-hover:scale-105" : "grayscale opacity-70"
          }`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            disponible
              ? "bg-[linear-gradient(180deg,rgba(11,42,91,0)_35%,rgba(11,42,91,0.85)_100%)]"
              : "bg-primary/45"
          }`}
        />
        <span
          className={`absolute top-4 left-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
            disponible ? "bg-gold text-primary" : "bg-white/90 text-primary"
          }`}
        >
          <Icono nombre={modulo.icono} size={24} strokeWidth={2} />
        </span>
        {!disponible && (
          <span className="absolute top-4 right-4 text-xs font-bold rounded-full px-3 py-1.5 bg-primary/80 text-white border border-white/30">
            Próximamente
          </span>
        )}
        {destacada && (
          <h3 className="absolute left-6 right-6 bottom-5 m-0 font-display text-[26px] lg:text-[30px] leading-tight font-semibold text-white">
            {modulo.nombre}
          </h3>
        )}
      </div>

      <div className={`flex flex-col gap-3 flex-1 ${destacada ? "p-6 sm:p-7" : "p-5"}`}>
        {!destacada && <h3 className="m-0 text-lg font-bold text-primary">{modulo.nombre}</h3>}
        <p className={`m-0 leading-relaxed text-ink-600 ${destacada ? "text-base" : "text-sm"}`}>{modulo.descripcion}</p>
        {destacada && (
          <ul className="list-none m-0 p-0 flex gap-2 flex-wrap">
            {modulo.servicios.map((s) => (
              <li key={s} className="text-[13px] font-semibold text-primary bg-primary-light rounded-full px-3 py-1.5">
                {s}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-2">
          {disponible && !ruta ? (
            <span className="text-[13px] font-semibold text-ink-500">Solo para el personal asignado a este módulo</span>
          ) : disponible ? (
            <Link
              to={ruta}
              className={`inline-flex items-center gap-2 font-bold rounded-full ${
                destacada
                  ? "bg-primary text-white text-[15px] px-6 min-h-[48px] hover:bg-primary-dark"
                  : "text-primary-soft text-[15px]"
              }`}
            >
              {usuario ? "Entrar" : "Conocer el módulo"}
              <Icono nombre="flecha" size={18} strokeWidth={2.2} />
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-ink-500">En construcción por el equipo del módulo</span>
          )}
          {disponible && modulo.extra && (
            <Link
              to={modulo.extra.to}
              className="mt-2 -mb-2 flex items-center gap-1.5 py-2.5 text-sm font-bold text-primary-soft hover:underline underline-offset-4 w-fit"
            >
              <Icono nombre="bus" size={17} strokeWidth={2} />
              {modulo.extra.label}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

// Ancho de cada tarjeta en la cuadricula de 6 columnas: filas completas
// tanto para los modulos disponibles como para los que vienen.
function anchoTarjeta(cantidad) {
  if (cantidad % 3 === 0) return "sm:col-span-1 md:col-span-2";
  return "sm:col-span-2 md:col-span-3";
}

function Modulos() {
  // Los modulos disponibles van primero, en tarjetas grandes; el resto, en orden.
  const proximos = MODULOS.filter((m) => m.estado !== "disponible");
  const ordenados = [...MODULOS_DISPONIBLES, ...proximos];
  const anchoDe = (m) => anchoTarjeta(m.estado === "disponible" ? MODULOS_DISPONIBLES.length : proximos.length);
  return (
    <section id="modulos" className="pt-20 scroll-mt-6">
      <div className="flex justify-between items-end gap-6 flex-wrap mb-8">
        <h2 className="m-0 text-[34px] sm:text-[42px] leading-tight font-semibold">¿A dónde quieres ir hoy?</h2>
        <p className="m-0 text-[15px] text-ink-500 max-w-[380px] [text-wrap:pretty]">
          Cinco módulos con una sola cuenta: {MODULOS_DISPONIBLES.length} ya están disponibles y los demás se habilitarán
          durante el semestre.
        </p>
      </div>
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-6">
        {ordenados.map((m) => (
          <TarjetaModulo key={m.id} modulo={m} destacada={m.estado === "disponible"} ancho={anchoDe(m)} />
        ))}
      </div>
    </section>
  );
}

export function PortalPage() {
  const { usuario } = useAuth();
  const orientacion = MODULOS.find((m) => m.id === "desarrollo-humano");
  const rutaOrientacion = (orientacion && rutaModulo(orientacion, usuario)) || "/desarrollo-humano";
  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      <Encabezado />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        <Hero />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <Modulos />

        <section id="agenda" className="pt-24 scroll-mt-6">
          <div className="flex justify-between items-end gap-6 flex-wrap mb-8">
            <h2 className="m-0 text-[34px] sm:text-[40px] leading-tight font-semibold">Lo que se viene en el campus</h2>
            <Link
              to="/desarrollo-humano#eventos"
              className="inline-flex items-center gap-2 py-2.5 font-bold text-[15px] text-primary-soft hover:underline underline-offset-4"
            >
              Ver todos los eventos
              <Icono nombre="flecha" size={17} strokeWidth={2.2} />
            </Link>
          </div>
          <ProximosEventos />
        </section>

        <section id="ayuda" className="py-24 scroll-mt-6">
          <div className="relative overflow-hidden bg-primary rounded-[28px] p-8 sm:p-14 flex justify-between items-center gap-8 flex-wrap">
            <div className="relative max-w-[620px]">
              <h2 className="m-0 mb-3 text-[32px] sm:text-[40px] leading-tight font-semibold text-white">
                ¿Necesitas hablar con alguien?
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC]">
                Bienestar Universitario te acompaña. Agenda una cita de orientación o acércate a la oficina de Bienestar. En una
                emergencia llama a la línea 123.
              </p>
            </div>
            <div className="relative flex gap-3 flex-wrap">
              <a
                href="tel:123"
                className="border-[1.5px] border-white/45 text-white font-semibold text-base px-6 min-h-[52px] rounded-full inline-flex items-center gap-2 hover:bg-white/10"
              >
                <Icono nombre="telefono" size={18} strokeWidth={2} />
                Línea 123
              </a>
              <Link
                to={rutaOrientacion}
                className="bg-gold text-primary font-bold text-base px-7 min-h-[52px] rounded-full inline-flex items-center"
              >
                Agendar orientación
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex justify-between gap-6 flex-wrap text-sm text-ink-500">
          <span>© {new Date().getFullYear()} Corporación Universitaria Autónoma del Cauca · Bienestar Universitario</span>
          <nav aria-label="Módulos" className="flex gap-x-4 gap-y-1 flex-wrap">
            {MODULOS.map((m) => {
              const ruta = rutaModulo(m, usuario);
              return ruta ? (
                <Link key={m.id} to={ruta} className="py-2 hover:text-primary hover:underline underline-offset-4">
                  {m.corto}
                </Link>
              ) : (
                <span key={m.id} className="py-2">{m.corto}</span>
              );
            })}
          </nav>
        </div>
      </footer>
    </div>
  );
}
