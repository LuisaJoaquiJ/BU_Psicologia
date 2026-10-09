import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { http } from "../../lib/api/http";
import { IMAGENES, imagenDeEvento, respaldoDeFoto } from "../../lib/imagenes";
import { MODULOS, puedeAdministrar, rutaModulo } from "../../lib/modulos";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Logo } from "../../components/Logo";
import { Icono } from "../../components/Iconos";
import { iniciales } from "../../components/Navbar";

// Portal de Conecta BU ("/"), propuesta B "Campus": portada fotográfica con
// los trámites más frecuentes según quién entra, las cinco dimensiones del
// Bienestar Institucional (nombres oficiales) y la agenda de la semana.

const ROL_TEXTO = { Administrador: "Personal de Bienestar", SuperAdministrador: "Superadministrador", Estudiante: "Estudiante" };

function Encabezado() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth();
  return (
    <header className="bg-white border-b border-gray-200 relative z-20">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-2.5 flex items-center justify-between gap-4">
        <span className="hidden sm:block">
          <Logo alto={60} />
        </span>
        <span className="sm:hidden">
          <Logo alto={44} subtitulo="" />
        </span>
        <nav aria-label="Portal" className="hidden md:flex items-center gap-1 text-[15px] font-bold">
          <a href="#tramites" className="text-ink-900 hover:text-primary px-3.5 py-3 rounded-full">Trámites</a>
          <a href="#dimensiones" className="text-ink-900 hover:text-primary px-3.5 py-3 rounded-full">Dimensiones</a>
          <a href="#agenda" className="text-ink-900 hover:text-primary px-3.5 py-3 rounded-full">Agenda</a>
          <a href="#ayuda" className="text-ink-900 hover:text-primary px-3.5 py-3 rounded-full">Ayuda</a>
        </nav>
        {estaAutenticado ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-bold text-ink-900 truncate max-w-[220px]">{usuario?.nombre}</span>
              <span className="block text-xs text-ink-500">{ROL_TEXTO[usuario?.rol] || usuario?.rol}</span>
            </span>
            <span className="w-10 h-10 rounded-full bg-primary text-white font-extrabold text-sm flex items-center justify-center shrink-0">
              {iniciales(usuario?.nombre)}
            </span>
            <button onClick={cerrarSesion} className="text-sm font-bold rounded-full px-4 min-h-[44px] text-primary hover:bg-primary-light">
              Salir
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-primary text-white font-extrabold text-[15px] px-5 min-h-[46px] rounded-full inline-flex items-center shrink-0 whitespace-nowrap hover:bg-primary-dark"
          >
            Ingresar
          </Link>
        )}
      </div>
    </header>
  );
}

// Trámites frecuentes según el rol y los módulos de la persona.
function tramitesDe(usuario) {
  if (!usuario || usuario.rol === "Estudiante") {
    return [
      { to: "/estudiante/agendar", texto: "Pedir una cita de orientación psicológica" },
      { to: "/estudiante/eventos", texto: "Inscribirme a un taller o evento" },
      { to: "/mi-deporte/horas", texto: "Ver mis horas de deporte" },
      { to: "/mi-salud", texto: "Pedir una cita en Salud Integral" },
    ];
  }
  const lista = [];
  if (usuario.rol === "SuperAdministrador") lista.push({ to: "/super", texto: "Abrir el panel de superadministrador" });
  if (puedeAdministrar(usuario, "desarrollo-humano")) {
    lista.push(
      { to: "/admin/citas", texto: "Ver la agenda de citas de hoy" },
      { to: "/admin/horarios?agregar=1", texto: "Publicar mis horarios de atención" },
      { to: "/admin/eventos", texto: "Crear un taller o evento" }
    );
  }
  if (puedeAdministrar(usuario, "salud")) lista.push({ to: "/salud/registrar", texto: "Registrar una atención en Salud" });
  if (puedeAdministrar(usuario, "deporte")) lista.push({ to: "/deporte/grupos", texto: "Tomar asistencia de un grupo de deporte" });
  lista.push({ to: "/reportes-sst/nuevo", texto: "Reportar una salida institucional" });
  return lista.slice(0, 6);
}

function Portada() {
  const { usuario } = useAuth();
  const nombre = usuario?.nombre?.split(" ")[0];
  const tramites = tramitesDe(usuario);
  const esEstudianteOAnonimo = !usuario || usuario.rol === "Estudiante";

  return (
    <section className="relative bg-primary-dark text-white overflow-hidden">
      <img src={IMAGENES.integracion.src} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-16 sm:pt-24 pb-14 flex flex-col gap-5">
        <h1 className="m-0 text-white text-[40px] sm:text-[64px] leading-[1.03] font-extrabold max-w-[13em]">
          {nombre ? `Hola, ${nombre}.` : "Tu bienestar también hace parte de tu formación."}
        </h1>
        <p className="m-0 text-lg sm:text-[19px] text-[#D9E2F2] max-w-[36em] [text-wrap:pretty]">
          {nombre
            ? "Estos son los trámites que más usas. Las cinco dimensiones del Bienestar están más abajo."
            : "Orientación, salud, deporte, cultura y permanencia: los servicios de Bienestar Institucional de la Uniautónoma, con tu correo institucional."}
        </p>

        <div id="tramites" className="scroll-mt-6 mt-4 bg-white text-ink-900 rounded-[18px] p-5 sm:p-6 shadow-[0_24px_60px_rgba(4,16,38,0.35)] max-w-[980px]">
          <h2 className="m-0 mb-3.5 text-xl font-extrabold">¿Qué necesitas hacer hoy?</h2>
          <ul className="list-none m-0 p-0 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
            {tramites.map((t) => (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className="flex items-center justify-between gap-3 min-h-[56px] px-4 sm:px-[18px] bg-cream rounded-xl font-bold text-primary-dark hover:bg-primary-light transition-colors"
                >
                  {t.texto}
                  <Icono nombre="flecha" size={18} strokeWidth={2.2} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {esEstudianteOAnonimo && (
            <p className="mt-3.5 mb-0 text-sm text-ink-500">
              Docentes y administrativos: el reporte de salidas institucionales está en{" "}
              <Link to="/reportes-sst" className="font-bold text-primary underline-offset-4 hover:underline">
                Salud Integral
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Dimensiones() {
  const { usuario } = useAuth();
  const [elegida, setElegida] = useState(MODULOS[0].id);
  const modulo = MODULOS.find((m) => m.id === elegida);
  const disponible = modulo.estado === "disponible";
  const ruta = rutaModulo(modulo, usuario);

  return (
    <section id="dimensiones" className="scroll-mt-6 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-20">
      <h2 className="m-0 mb-2 text-[34px] sm:text-[44px] leading-tight font-extrabold">Cinco dimensiones, una sola cuenta</h2>
      <p className="m-0 mb-9 text-ink-500 max-w-[40em]">
        Así organiza la Uniautónoma su Bienestar Institucional. Elige una dimensión para ver qué puedes hacer en ella.
      </p>
      <div className="flex gap-8 flex-wrap items-stretch">
        <div role="tablist" aria-label="Dimensiones" className="flex-[1_1_300px] flex flex-col gap-1.5">
          {MODULOS.map((m) => {
            const activa = m.id === elegida;
            const lista = m.estado === "disponible";
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`tab-${m.id}`}
                aria-selected={activa}
                aria-controls="panel-dimension"
                onClick={() => setElegida(m.id)}
                className={`flex justify-between items-center gap-3 min-h-[60px] px-5 rounded-xl text-left text-[17px] transition-colors ${
                  activa ? "bg-primary-dark text-white font-extrabold" : `bg-cream font-bold hover:bg-primary-light ${lista ? "text-primary-dark" : "text-ink-500"}`
                }`}
              >
                {m.nombre}
                <span className={`text-[13px] font-bold ${activa ? "text-cyan" : lista ? "text-primary" : "text-ink-500"}`}>
                  {lista ? "Disponible" : "Próximamente"}
                </span>
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id="panel-dimension"
          aria-labelledby={`tab-${modulo.id}`}
          className="flex-[999_1_560px] min-w-0 flex gap-7 flex-wrap bg-cream rounded-[18px] p-5 sm:p-7"
        >
          <img
            src={modulo.imagen.src}
            alt={modulo.imagen.alt}
            className={`flex-[1_1_260px] min-w-0 h-[280px] object-cover rounded-xl ${disponible ? "" : "grayscale"}`}
          />
          <div className="flex-[1_1_300px] min-w-0 flex flex-col gap-3.5">
            <h3 className="m-0 text-[30px] font-extrabold tracking-tight text-primary-dark">{modulo.nombre}</h3>
            <p className="m-0 text-ink-600">{modulo.descripcion}</p>
            {disponible && (
              <ul className="m-0 pl-5 text-ink-600 flex flex-col gap-1">
                {modulo.servicios.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-2">
              {!disponible ? (
                <p className="m-0 font-bold text-ink-500">Esta dimensión estará en Conecta BU próximamente.</p>
              ) : ruta ? (
                <Link
                  to={ruta}
                  className="inline-flex items-center gap-2.5 min-h-[50px] px-6 rounded-full bg-primary text-white font-extrabold hover:bg-primary-dark"
                >
                  Entrar a {modulo.corto}
                  <Icono nombre="flecha" size={18} strokeWidth={2.2} />
                </Link>
              ) : (
                <p className="m-0 font-bold text-ink-500">Solo para el personal asignado a esta dimensión.</p>
              )}
              {disponible && modulo.extra && usuario && (
                <Link to={modulo.extra.to} className="mt-3 flex items-center gap-1.5 py-2 text-sm font-bold text-primary hover:underline underline-offset-4 w-fit">
                  {modulo.extra.label}
                  <Icono nombre="flecha" size={16} strokeWidth={2.2} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Agenda() {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    http
      .get("/eventos/publicos")
      .then((res) => setEventos(res.data.eventos.slice(0, 3)))
      .catch(() => {
        setError(true);
        setEventos([]);
      });
  }, []);

  const destino = usuario?.rol === "Estudiante" ? "/estudiante/eventos" : usuario ? "/desarrollo-humano#eventos" : "/login";

  return (
    <section id="agenda" className="scroll-mt-6 bg-cream">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-20">
        <div className="flex justify-between items-end gap-5 flex-wrap mb-7">
          <h2 className="m-0 text-[32px] sm:text-[40px] leading-tight font-extrabold">Próximamente en el campus</h2>
          <Link to="/desarrollo-humano#eventos" className="inline-flex items-center gap-1.5 py-3 font-extrabold text-primary">
            Ver toda la agenda
            <Icono nombre="flecha" size={17} strokeWidth={2.2} />
          </Link>
        </div>
        {eventos && eventos.length === 0 && (
          <p className="m-0 p-6 bg-white rounded-2xl text-ink-500">
            {error ? "No pudimos cargar la agenda en este momento. Intenta de nuevo en unos minutos." : "Pronto publicaremos nuevos talleres y eventos."}
          </p>
        )}
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {(eventos || [null, null, null]).map((e, i) =>
            e ? (
              <article key={e.id} className="flex flex-col gap-3">
                <img src={imagenDeEvento(e).src} alt="" onError={respaldoDeFoto(e)} className="w-full h-[200px] object-cover rounded-[14px]" />
                <p className="m-0 text-sm font-bold text-primary tabular-nums">
                  {fechaLarga(e.fecha)} · {formatearHora(e.horaInicio)}
                </p>
                <h3 className="m-0 text-xl font-extrabold tracking-tight text-ink-900">{e.nombre}</h3>
                <p className="m-0 text-ink-500">
                  {e.lugar ? `${e.lugar} · ` : ""}
                  <span className="tabular-nums">{e.cuposDisponibles}</span> {e.cuposDisponibles === 1 ? "cupo libre" : "cupos libres"}
                </p>
                <Link
                  to={destino}
                  className="self-start inline-flex items-center min-h-[44px] px-[18px] border-[1.5px] border-primary rounded-full font-extrabold text-primary hover:bg-primary-light"
                >
                  {usuario ? "Inscribirme" : "Ingresar para inscribirme"}
                </Link>
              </article>
            ) : (
              <div key={i} className="h-[340px] rounded-[14px] bg-white/70 animate-pulse" />
            )
          )}
        </div>
      </div>
    </section>
  );
}

export function PortalPage() {
  const { usuario } = useAuth();
  const orientacion = MODULOS.find((m) => m.id === "desarrollo-humano");
  const rutaOrientacion =
    usuario?.rol === "Estudiante" ? "/estudiante/agendar" : (orientacion && rutaModulo(orientacion, usuario)) || "/desarrollo-humano";

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Encabezado />
      <Portada />
      <Dimensiones />
      <Agenda />

      <section id="ayuda" className="scroll-mt-6 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16">
        <div className="flex gap-8 flex-wrap items-center justify-between p-7 sm:p-10 border-[1.5px] border-gray-200 rounded-[18px]">
          <div className="flex-[1_1_460px] min-w-0">
            <h2 className="m-0 mb-2 text-[28px] sm:text-[30px] font-extrabold">¿Necesitas hablar con alguien ahora?</h2>
            <p className="m-0 text-ink-600 max-w-[40em]">
              En una emergencia llama a la línea 123. Para acompañamiento, pide una cita de orientación o acércate a la oficina de
              Bienestar Institucional.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <a href="tel:123" className="inline-flex items-center gap-2 min-h-[50px] px-6 rounded-full bg-primary-dark text-white font-extrabold">
              <Icono nombre="telefono" size={18} strokeWidth={2} />
              Llamar a la línea 123
            </a>
            <Link to={rutaOrientacion} className="inline-flex items-center min-h-[50px] px-6 rounded-full border-[1.5px] border-primary text-primary font-extrabold hover:bg-primary-light">
              Pedir una cita
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-primary-dark text-[#D9E2F2]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 flex gap-10 flex-wrap justify-between items-end">
          <div>
            <p className="m-0 text-[32px] sm:text-[40px] font-extrabold tracking-tight leading-[1.05] text-white">
              Somos el motor
              <br />
              <span className="text-cyan">de la innovación.</span>
            </p>
            <p className="mt-3.5 mb-0 text-sm">
              © {new Date().getFullYear()} Bienestar Institucional · Corporación Universitaria Autónoma del Cauca · Popayán
            </p>
          </div>
          <nav aria-label="Dimensiones" className="grid grid-cols-2 gap-x-8 gap-y-1 text-[15px]">
            {MODULOS.map((m) => {
              const ruta = rutaModulo(m, usuario);
              return ruta ? (
                <Link key={m.id} to={ruta} className="py-1.5 text-white hover:underline underline-offset-4">
                  {m.nombre}
                </Link>
              ) : (
                <span key={m.id} className="py-1.5">
                  {m.nombre}
                </span>
              );
            })}
          </nav>
        </div>
      </footer>
    </div>
  );
}
