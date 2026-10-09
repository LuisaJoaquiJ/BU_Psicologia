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

function listaNatural(nombres) {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

function Encabezado() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth();
  return (
    <header className="px-4 sm:px-6 pt-5 relative z-20">
      <div className="max-w-[1200px] mx-auto bg-white rounded-[28px] sm:rounded-full shadow-[0_10px_30px_rgba(11,42,91,0.08)] pl-5 pr-3 py-3 flex items-center justify-between gap-4 flex-wrap">
        <Logo subtitulo="Bienestar Universitario · Uniautónoma del Cauca" />
        <nav aria-label="Portal" className="hidden md:flex items-center gap-7 text-[15px] font-semibold">
          <a href="#modulos" className="text-primary hover:text-primary-soft">Módulos</a>
          <a href="#agenda" className="text-ink-600 hover:text-primary">Agenda</a>
          <a href="#ayuda" className="text-ink-600 hover:text-primary">Ayuda</a>
        </nav>
        {estaAutenticado ? (
          <div className="flex items-center gap-3 min-w-0">
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
            className="bg-primary text-white font-bold text-[15px] px-5 min-h-[44px] rounded-full inline-flex items-center hover:bg-primary-dark"
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
          <span className="inline-flex items-center gap-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-gold">
            <span className="w-7 h-0.5 bg-gold" />
            Bienestar Universitario
          </span>
          <h1 className="m-0 text-white text-[44px] sm:text-[64px] leading-[1.02] font-semibold">
            Conecta{" "}
            <span className="inline-block bg-gold-soft text-primary px-3.5 pb-1 rounded-2xl -rotate-2">BU</span>
          </h1>
          <p className="m-0 text-[13px] font-bold tracking-[0.18em] uppercase text-white/70">
            Corporación Universitaria Autónoma del Cauca
          </p>
          <p className="m-0 text-lg leading-relaxed text-[#D6DDEC] max-w-[540px]">
            {usuario && habilitados.length > 0 ? (
              <>
                Hola, <strong className="text-white">{nombre}</strong>.{" "}
                {usuario.rol === "Estudiante" ? "Puedes entrar a " : "Tienes acceso al panel de "}
                <strong className="text-white">{listaNatural(habilitados)}</strong>. Cada módulo es independiente: elige a cuál
                quieres entrar.
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
            {usuario && principal ? (
              <Link
                to={rutaModulo(principal, usuario)}
                className="bg-gold text-primary font-bold text-[15px] px-6 min-h-[50px] rounded-full inline-flex items-center gap-2 hover:brightness-95"
              >
                Entrar a {principal.corto}
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

        {/* Resumen de los modulos: estado de cada uno de un vistazo */}
        <div className="flex-[1_1_340px] min-w-0 max-w-[440px] bg-white/10 backdrop-blur-md border border-white/15 rounded-[26px] p-5 sm:p-6">
          <p className="m-0 mb-4 text-xs font-bold tracking-[0.14em] uppercase text-white/70">Módulos de Bienestar</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {MODULOS.map((m) => {
              const ruta = rutaModulo(m, usuario);
              const activo = m.estado === "disponible";
              const contenido = (
                <>
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      ruta ? "bg-gold text-primary" : activo ? "bg-white/20 text-white" : "bg-white/10 text-white/80"
                    }`}
                  >
                    <Icono nombre={m.icono} size={20} strokeWidth={2} />
                  </span>
                  <span className="flex-1 min-w-0 text-[15px] leading-snug font-semibold text-white">{m.nombre}</span>
                  {activo ? (
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 shrink-0 ${ruta ? "text-primary bg-gold-soft" : "text-white bg-white/15"}`}>
                      Disponible
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-white/70 border border-white/25 rounded-full px-2.5 py-1 shrink-0">
                      Pronto
                    </span>
                  )}
                </>
              );
              return (
                <li key={m.id}>
                  {ruta ? (
                    <Link to={ruta} className="flex items-center gap-3 rounded-2xl p-2 -m-0 hover:bg-white/10 transition-colors">
                      {contenido}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl p-2">{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
        disponible ? "hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(11,42,91,0.14)]" : ""
      } ${ancho || (destacada ? "sm:col-span-2 md:col-span-3" : "md:col-span-2")}`}
    >
      <div className={`relative overflow-hidden bg-primary ${destacada ? "h-[240px]" : "h-[150px]"}`}>
        <img
          src={modulo.imagen.src}
          alt={modulo.imagen.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
            disponible ? "group-hover:scale-105" : "grayscale opacity-70"
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
        <span
          className={`absolute top-4 right-4 text-xs font-bold rounded-full px-3 py-1.5 ${
            disponible ? "bg-white text-primary" : "bg-primary/80 text-white border border-white/30"
          }`}
        >
          {disponible ? "● Disponible" : "Próximamente"}
        </span>
        {destacada && (
          <h3 className="absolute left-6 right-6 bottom-5 m-0 font-display text-[26px] lg:text-[30px] leading-tight font-semibold text-white">
            {modulo.nombre}
          </h3>
        )}
      </div>

      <div className={`flex flex-col gap-3 ${destacada ? "p-6 sm:p-7" : "p-5 flex-1"}`}>
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
        <div className="mt-auto pt-1">
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
            <Link to={modulo.extra.to} className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-soft hover:underline w-fit">
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
        <div className="max-w-[620px]">
          <p className="m-0 mb-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">Cinco módulos, una sola cuenta</p>
          <h2 className="m-0 text-[34px] sm:text-[42px] leading-tight font-semibold">¿A dónde quieres ir hoy?</h2>
        </div>
        <p className="m-0 text-[15px] text-ink-500 max-w-[360px]">
          {MODULOS_DISPONIBLES.length} de {MODULOS.length} módulos disponibles. Los demás se habilitarán durante el semestre.
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
            <div className="max-w-[580px]">
              <p className="m-0 mb-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">Agenda de Bienestar</p>
              <h2 className="m-0 text-[34px] sm:text-[40px] leading-tight font-semibold">Lo que se viene en el campus</h2>
            </div>
            <Link to="/desarrollo-humano#eventos" className="font-bold text-[15px] text-primary-soft">
              Ver todos los eventos →
            </Link>
          </div>
          <ProximosEventos />
        </section>

        <section id="ayuda" className="py-24 scroll-mt-6">
          <div className="relative overflow-hidden bg-primary rounded-[28px] p-8 sm:p-14 flex justify-between items-center gap-8 flex-wrap">
            <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute -left-24 -top-32 w-[380px] h-[380px]">
              <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(232,178,58,0.3)" strokeWidth="1.5" />
              <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            </svg>
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
                to="/desarrollo-humano"
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
          <span className="flex gap-4 flex-wrap">
            {MODULOS.map((m) => (
              <span key={m.id}>{m.corto}</span>
            ))}
          </span>
        </div>
      </footer>
    </div>
  );
}
