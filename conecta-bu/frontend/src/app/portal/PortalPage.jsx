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

// Portal de Conecta BU ("/"), propuesta C "Campus enmarcado": el texto y los
// tramites a la izquierda y la foto del campus en un marco con tarjetas de
// vidrio; luego las cinco dimensiones del Bienestar, la agenda y la ayuda.

const ROL_TEXTO = { Administrador: "Personal de Bienestar", SuperAdministrador: "Superadministrador", Estudiante: "Estudiante" };

// Color de cada dimension (el mismo de sus paneles).
const COLOR = {
  "desarrollo-humano": "#1D4E9E",
  salud: "#1BAF7A",
  deporte: "#EB6834",
  permanencia: "#C9A23F",
  cultura: "#7C5CD6",
};

// Entrada al cargar: los bloques aparecen en cascada (solo fundido si se pidio reducir movimiento).
const ENTRA = "animate-aparecer motion-reduce:animate-aparecer-suave";
const retraso = (ms) => ({ animationDelay: `${ms}ms` });

const fechaDeEvento = (fecha) => {
  const f = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return { dia: f.getDate(), mes: f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "") };
};

function Encabezado() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth();
  return (
    <header className="relative z-20">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
        <span className="hidden sm:block">
          <Logo alto={56} />
        </span>
        <span className="sm:hidden">
          <Logo alto={44} subtitulo="" />
        </span>
        <nav aria-label="Portal" className="hidden md:flex items-center gap-1 text-[15px] font-semibold">
          {[
            ["#tramites", "Trámites"],
            ["#dimensiones", "Dimensiones"],
            ["#agenda", "Agenda"],
            ["#ayuda", "Ayuda"],
          ].map(([href, texto]) => (
            <a key={href} href={href} className="text-primary-dark hover:bg-white px-4 min-h-[44px] inline-flex items-center rounded-full">
              {texto}
            </a>
          ))}
        </nav>
        {estaAutenticado ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-bold text-ink-900 truncate max-w-[220px]">{usuario?.nombre}</span>
              <span className="block text-xs text-ink-500">{ROL_TEXTO[usuario?.rol] || usuario?.rol}</span>
            </span>
            <span className="w-10 h-10 rounded-full bg-primary-dark text-white font-extrabold text-sm flex items-center justify-center shrink-0">
              {iniciales(usuario?.nombre)}
            </span>
            <button onClick={cerrarSesion} className="text-sm font-bold rounded-full px-4 min-h-[44px] text-primary hover:bg-white">
              Salir
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-primary-dark text-white font-extrabold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center shrink-0 whitespace-nowrap hover:bg-primary"
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
      { to: "/estudiante/agendar", texto: "Pedir una cita de orientación psicológica", color: COLOR["desarrollo-humano"] },
      { to: "/estudiante/eventos", texto: "Inscribirme a un taller o evento", color: COLOR.permanencia },
      { to: "/mi-deporte/horas", texto: "Ver mis horas de deporte", color: COLOR.deporte },
      { to: "/mi-salud", texto: "Pedir una cita en Salud Integral", color: COLOR.salud },
    ];
  }
  const lista = [];
  if (usuario.rol === "SuperAdministrador") lista.push({ to: "/super", texto: "Abrir el panel de superadministrador", color: COLOR.permanencia });
  if (puedeAdministrar(usuario, "desarrollo-humano")) {
    lista.push(
      { to: "/admin/citas", texto: "Ver la agenda de citas de hoy", color: COLOR["desarrollo-humano"] },
      { to: "/admin/horarios?agregar=1", texto: "Publicar mis horarios de atención", color: COLOR["desarrollo-humano"] },
      { to: "/admin/eventos", texto: "Crear un taller o evento", color: COLOR["desarrollo-humano"] }
    );
  }
  if (puedeAdministrar(usuario, "salud")) lista.push({ to: "/salud/registrar", texto: "Registrar una atención en Salud", color: COLOR.salud });
  if (puedeAdministrar(usuario, "deporte")) lista.push({ to: "/deporte/grupos", texto: "Tomar asistencia de un grupo de deporte", color: COLOR.deporte });
  lista.push({ to: "/reportes-sst/nuevo", texto: "Reportar una salida institucional", color: COLOR.salud });
  return lista.slice(0, 6);
}

function Portada({ proximo, destinoEventos }) {
  const { usuario } = useAuth();
  const nombre = usuario?.nombre?.split(" ")[0];
  const tramites = tramitesDe(usuario);
  const esEstudianteOAnonimo = !usuario || usuario.rol === "Estudiante";
  const fecha = proximo ? fechaDeEvento(proximo.fecha) : null;

  return (
    <section className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 pb-6 grid gap-7 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-stretch">
      <div className="min-w-0 flex flex-col gap-5 justify-center">
        <h1 className={`m-0 font-sans text-[40px] sm:text-[52px] xl:text-[56px] leading-[1] tracking-[-0.045em] font-extrabold text-primary-dark max-w-[13em] ${ENTRA}`}>
          {nombre ? `Hola, ${nombre}` : "Tu bienestar también hace parte de tu formación"}
        </h1>
        <p style={retraso(60)} className={`m-0 text-lg sm:text-xl leading-normal text-ink-600 max-w-[32em] [text-wrap:pretty] ${ENTRA}`}>
          {nombre
            ? "Estos son los trámites que más usas. Las cinco dimensiones del Bienestar están más abajo."
            : "Orientación, salud, deporte, cultura y permanencia: los servicios de Bienestar Institucional de la Uniautónoma, con tu correo institucional."}
        </p>
        <div id="tramites" style={retraso(120)} className={`scroll-mt-6 flex flex-col gap-2 ${ENTRA}`}>
          <h2 className="m-0 mb-1 font-sans text-lg font-extrabold tracking-normal">¿Qué necesitas hacer hoy?</h2>
          <ul className="list-none m-0 p-0 grid gap-2.5 sm:grid-cols-2">
            {tramites.map((t) => (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className="group h-full flex items-center gap-3 min-h-[64px] px-4 rounded-[18px] bg-white border border-[#E3E8F0] font-bold text-[15px] leading-snug text-ink-900 no-underline transition-[background-color,transform] duration-200 ease-salida hover:bg-[#EAF0FA] motion-safe:hover:-translate-y-0.5"
                >
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1">{t.texto}</span>
                  <Icono nombre="flecha" size={18} strokeWidth={2.2} className="shrink-0 text-primary" />
                </Link>
              </li>
            ))}
          </ul>
          {esEstudianteOAnonimo && (
            <p className="mt-1.5 mb-0 text-sm text-ink-500">
              Docentes y administrativos: el reporte de salidas institucionales está en{" "}
              <Link to="/reportes-sst" className="font-bold text-primary underline-offset-4 hover:underline">
                Salud Integral
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div style={retraso(180)} className={`min-w-0 relative min-h-[420px] sm:min-h-[560px] lg:min-h-[600px] rounded-[36px] overflow-hidden shadow-[0_30px_70px_rgba(11,35,71,0.25)] ${ENTRA}`}>
        <img src={IMAGENES.integracion.src} alt={IMAGENES.integracion.alt} className="absolute inset-0 w-full h-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,35,71,0)_40%,rgba(11,35,71,0.6)_100%)]" />
        <div className="vidrio-claro absolute top-5 left-5 rounded-full py-2 pl-2 pr-4 flex items-center gap-2.5 text-white">
          <span className="flex">
            <img src={IMAGENES.deportes.src} alt="" className="w-[34px] h-[34px] rounded-full object-cover border-2 border-white" />
            <img src={IMAGENES.salud.src} alt="" className="w-[34px] h-[34px] rounded-full object-cover border-2 border-white -ml-2.5" />
          </span>
          <strong className="text-sm">Deporte, salud y más en el campus</strong>
        </div>
        <div className="vidrio-claro absolute left-4 right-4 bottom-4 sm:left-5 sm:right-5 sm:bottom-5 rounded-[28px] p-4 sm:p-5 text-white flex flex-wrap items-center gap-4">
          {proximo ? (
            <>
              <span className="w-[58px] h-[58px] rounded-[18px] bg-white/95 text-primary-dark flex flex-col items-center justify-center leading-none shrink-0">
                <strong className="text-[22px] tabular-nums">{fecha.dia}</strong>
                <span className="text-xs font-bold text-accent">{fecha.mes}</span>
              </span>
              <span className="flex-[1_1_180px] min-w-0 leading-snug">
                <span className="block text-[13px] text-white/85">Próximo en el campus · {formatearHora(proximo.horaInicio)}</span>
                <strong className="block text-lg line-clamp-2" title={proximo.nombre}>
                  {proximo.nombre}
                </strong>
              </span>
              <Link to={destinoEventos} className="min-h-[46px] inline-flex items-center px-5 rounded-full bg-white text-primary-dark font-extrabold text-sm no-underline hover:bg-white/90">
                Inscribirme
              </Link>
            </>
          ) : (
            <>
              <span className="flex-[1_1_220px] min-w-0 leading-snug">
                <span className="block text-[13px] text-white/85">Una sola cuenta para todo Bienestar</span>
                <strong className="block text-lg">Entra con tu correo @uniautonoma.edu.co</strong>
              </span>
              {!usuario && (
                <Link to="/login" className="min-h-[46px] inline-flex items-center px-5 rounded-full bg-white text-primary-dark font-extrabold text-sm no-underline hover:bg-white/90">
                  Ingresar
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
// Resumen corto de cada dimension para la fila bajo la portada.
const RESUMEN = {
  "desarrollo-humano": "Psicología y talleres",
  salud: "Enfermería y prevención",
  deporte: "Grupos y horas de deporte",
};

// Las cinco dimensiones a la vista desde la primera pantalla: las disponibles
// llevan a su modulo; las que vienen, a su detalle mas abajo.
function FilaDimensiones() {
  const { usuario } = useAuth();
  return (
    <section aria-label="Dimensiones de Bienestar" style={retraso(240)} className={`max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 pb-12 ${ENTRA}`}>
      <ul className="list-none m-0 p-0 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {MODULOS.map((m) => {
          const lista = m.estado === "disponible";
          const ruta = lista ? rutaModulo(m, usuario) : null;
          const contenido = (
            <>
              <span
                aria-hidden="true"
                className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 text-white"
                style={{ background: lista ? `linear-gradient(140deg, ${COLOR[m.id]}99, ${COLOR[m.id]})` : "#E8ECF3", color: lista ? "#FFFFFF" : "#6B6B76" }}
              >
                <Icono nombre={m.icono} size={20} strokeWidth={2} />
              </span>
              <span className="min-w-0 leading-tight">
                <strong className={`block text-base ${lista ? "text-primary-dark" : "text-ink-600"}`}>{m.nombre}</strong>
                <span className="text-[13px] text-ink-500">{lista ? RESUMEN[m.id] || m.corto : "Pronto"}</span>
              </span>
            </>
          );
          return (
            <li key={m.id}>
              {lista ? (
                <Link
                  to={ruta || "#dimensiones"}
                  className="h-full flex items-center gap-3 rounded-[22px] px-[18px] py-4 bg-white border border-[#E3E8F0] no-underline transition-[background-color,transform] duration-200 ease-salida hover:bg-[#EAF0FA] motion-safe:hover:-translate-y-0.5"
                >
                  {contenido}
                </Link>
              ) : (
                <a href="#dimensiones" className="h-full flex items-center gap-3 rounded-[22px] px-[18px] py-4 border-[1.5px] border-dashed border-[#C9D2E2] no-underline hover:bg-white">
                  {contenido}
                </a>
              )}
            </li>
          );
        })}
      </ul>
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
    <section id="dimensiones" className="scroll-mt-6 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
      <h2 className="m-0 mb-2 font-sans text-[34px] sm:text-[48px] leading-tight font-extrabold tracking-[-0.04em]">Cinco dimensiones, una sola cuenta</h2>
      <p className="m-0 mb-8 text-ink-500 text-[17px] max-w-[40em]">
        Así organiza la Uniautónoma su Bienestar Institucional. Elige una dimensión para ver qué puedes hacer en ella.
      </p>
      <div role="tablist" aria-label="Dimensiones" className="flex flex-wrap gap-2 mb-6">
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
              className={`inline-flex items-center gap-2.5 min-h-[48px] px-[18px] rounded-full text-[15px] font-bold transition-colors ${
                activa
                  ? "bg-primary-dark text-white"
                  : lista
                    ? "bg-white border border-[#E3E8F0] text-primary-dark hover:bg-[#EAF0FA]"
                    : "border-[1.5px] border-dashed border-[#C9D2E2] text-ink-500 hover:bg-white"
              }`}
            >
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: lista ? COLOR[m.id] : "#C9D2E2" }} />
              {m.nombre}
              {!lista && <span className="text-[13px] font-semibold">· pronto</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id="panel-dimension" aria-labelledby={`tab-${modulo.id}`} className="flex gap-8 flex-wrap bg-white rounded-[32px] p-4 sm:p-5 border border-[#E3E8F0] shadow-[0_18px_50px_rgba(11,35,71,0.08)]">
        <div className="flex-[1_1_320px] min-w-0 relative h-[300px] sm:h-[360px] rounded-[26px] overflow-hidden">
          <img src={modulo.imagen.src} alt={modulo.imagen.alt} className={`absolute inset-0 w-full h-full object-cover ${disponible ? "" : "grayscale"}`} />
          <span className="vidrio-claro absolute top-4 left-4 rounded-full px-4 min-h-[38px] inline-flex items-center gap-2 text-white text-sm font-bold">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: disponible ? COLOR[modulo.id] : "#C9D2E2" }} />
            {disponible ? "Disponible" : "Próximamente"}
          </span>
        </div>
        <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-3.5 py-2 sm:py-4 pr-2 sm:pr-4">
          <h3 className="m-0 font-sans text-[32px] font-extrabold tracking-[-0.03em] text-primary-dark">{modulo.nombre}</h3>
          <p className="m-0 text-ink-600 text-[16px] leading-relaxed">{modulo.descripcion}</p>
          {disponible && (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {modulo.servicios.map((s) => (
                <li key={s} className="flex items-center gap-2.5 text-ink-600">
                  <span className="shrink-0 flex" style={{ color: COLOR[modulo.id] }}>
                    <Icono nombre="check" size={18} strokeWidth={2.4} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto pt-2">
            {!disponible ? (
              <p className="m-0 font-bold text-ink-500">Esta dimensión estará en Conecta BU próximamente.</p>
            ) : ruta ? (
              <Link to={ruta} className="inline-flex items-center gap-2.5 min-h-[50px] px-6 rounded-full bg-primary-dark text-white font-extrabold no-underline hover:bg-primary">
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
    </section>
  );
}

function Agenda({ eventos, error, destino }) {
  const { usuario } = useAuth();
  return (
    <section id="agenda" className="scroll-mt-6 bg-white">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
        <div className="flex justify-between items-end gap-5 flex-wrap mb-8">
          <h2 className="m-0 font-sans text-[32px] sm:text-[44px] leading-tight font-extrabold tracking-[-0.04em]">Próximamente en el campus</h2>
          <Link to="/desarrollo-humano#eventos" className="inline-flex items-center gap-1.5 min-h-[44px] font-extrabold text-primary">
            Ver toda la agenda
            <Icono nombre="flecha" size={17} strokeWidth={2.2} />
          </Link>
        </div>
        {eventos && eventos.length === 0 && (
          <p className="m-0 p-6 bg-[#F6F8FB] rounded-3xl text-ink-500">
            {error ? "No pudimos cargar la agenda en este momento. Intenta de nuevo en unos minutos." : "Pronto publicaremos nuevos talleres y eventos."}
          </p>
        )}
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {(eventos || [null, null, null]).map((e, i) => {
            if (!e) return <div key={i} className="h-[360px] rounded-[28px] bg-[#F1F4F9] animate-pulse" />;
            const fecha = fechaDeEvento(e.fecha);
            return (
              <article key={e.id} className="rounded-[28px] bg-[#F6F8FB] p-3 flex flex-col">
                <div className="relative h-[210px] rounded-[22px] overflow-hidden">
                  <img src={imagenDeEvento(e).src} alt="" onError={respaldoDeFoto(e)} className="absolute inset-0 w-full h-full object-cover" />
                  {/* Las fotos de eventos pueden ser claras: la fecha va en blanco solido para leerse siempre. */}
                  <span className="absolute top-3 left-3 w-[58px] h-[58px] rounded-[18px] bg-white/95 text-primary-dark shadow-[0_8px_24px_rgba(11,35,71,0.25)] flex flex-col items-center justify-center leading-none">
                    <strong className="text-[22px] tabular-nums">{fecha.dia}</strong>
                    <span className="text-xs font-bold text-accent">{fecha.mes}</span>
                  </span>
                </div>
                <div className="px-3 pt-4 pb-3 flex flex-col gap-2 flex-1">
                  <p className="m-0 text-sm font-bold text-primary tabular-nums">
                    {fechaLarga(e.fecha)} · {formatearHora(e.horaInicio)}
                  </p>
                  <h3 className="m-0 font-sans text-xl font-extrabold tracking-[-0.02em] text-ink-900">{e.nombre}</h3>
                  <p className="m-0 text-ink-500">
                    {e.lugar ? `${e.lugar} · ` : ""}
                    <span className="tabular-nums">{e.cuposDisponibles}</span> {e.cuposDisponibles === 1 ? "cupo libre" : "cupos libres"}
                  </p>
                  <Link
                    to={destino}
                    className="mt-auto self-start inline-flex items-center min-h-[44px] px-5 rounded-full bg-primary-dark text-white font-extrabold text-sm no-underline hover:bg-primary"
                  >
                    {usuario ? "Inscribirme" : "Ingresar para inscribirme"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PortalPage() {
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

  const orientacion = MODULOS.find((m) => m.id === "desarrollo-humano");
  const rutaOrientacion =
    usuario?.rol === "Estudiante" ? "/estudiante/agendar" : (orientacion && rutaModulo(orientacion, usuario)) || "/desarrollo-humano";
  const destinoEventos = usuario?.rol === "Estudiante" ? "/estudiante/eventos" : usuario ? "/desarrollo-humano#eventos" : "/login";

  return (
    <div className="min-h-screen bg-[#F6F8FB] overflow-x-hidden">
      <Encabezado />
      <FilaDimensiones />
      <Portada proximo={eventos?.[0]} destinoEventos={destinoEventos} />
      <Dimensiones />
      <Agenda eventos={eventos} error={error} destino={destinoEventos} />

      <section id="ayuda" className="scroll-mt-6 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16">
        <div className="relative overflow-hidden flex gap-8 flex-wrap items-center justify-between p-7 sm:p-10 rounded-[32px] bg-primary-dark text-white">
          <div aria-hidden="true" className="absolute w-[420px] h-[420px] -right-24 -top-40 rounded-full bg-[radial-gradient(circle,rgba(127,232,255,0.45)_0%,rgba(127,232,255,0)_70%)]" />
          <div aria-hidden="true" className="absolute w-[380px] h-[380px] left-[30%] -bottom-56 rounded-full bg-[radial-gradient(circle,rgba(201,162,63,0.35)_0%,rgba(201,162,63,0)_70%)]" />
          <div className="relative flex-[1_1_460px] min-w-0">
            <h2 className="m-0 mb-2 font-sans text-[28px] sm:text-[34px] font-extrabold tracking-[-0.03em] text-white">¿Necesitas hablar con alguien ahora?</h2>
            <p className="m-0 text-white/80 max-w-[40em]">
              En una emergencia llama a la línea 123. Para acompañamiento, pide una cita de orientación o acércate a la oficina de
              Bienestar Institucional.
            </p>
          </div>
          <div className="relative flex gap-2.5 flex-wrap">
            <a href="tel:123" className="inline-flex items-center gap-2 min-h-[50px] px-6 rounded-full bg-white text-primary-dark font-extrabold no-underline hover:bg-white/90">
              <Icono nombre="telefono" size={18} strokeWidth={2} />
              Llamar a la línea 123
            </a>
            <Link to={rutaOrientacion} className="vidrio-claro inline-flex items-center min-h-[50px] px-6 rounded-full text-white font-extrabold no-underline">
              Pedir una cita
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 pb-6">
        <div className="relative overflow-hidden rounded-[32px] bg-primary-dark text-[#D9E2F2] px-6 sm:px-10 pt-10 pb-6">
          <div aria-hidden="true" className="absolute w-[480px] h-[480px] -left-40 -bottom-64 rounded-full bg-[radial-gradient(circle,rgba(29,78,158,0.9)_0%,rgba(29,78,158,0)_70%)]" />
          <div aria-hidden="true" className="absolute w-[420px] h-[420px] right-[10%] -top-56 rounded-full bg-[radial-gradient(circle,rgba(30,158,154,0.4)_0%,rgba(30,158,154,0)_70%)]" />

          <div className="relative flex flex-wrap gap-10 justify-between">
            <div className="flex-[1_1_300px] min-w-0 max-w-[420px] flex flex-col gap-5">
              <span className="self-start rounded-2xl bg-white px-3 py-2">
                <Logo alto={48} />
              </span>
              <p className="m-0 font-sans text-[30px] sm:text-[36px] font-extrabold tracking-[-0.035em] leading-[1.05] text-white">Somos el motor de la innovación.</p>
            </div>

            <div className="flex-[1_1_420px] min-w-0 max-w-[560px] grid gap-8 grid-cols-1 sm:grid-cols-[1.6fr_1fr]">
              <nav aria-labelledby="pie-dimensiones" className="flex flex-col gap-1">
                <h2 id="pie-dimensiones" className="m-0 mb-2 font-sans text-sm font-bold tracking-normal text-white/60">
                  Dimensiones
                </h2>
                {MODULOS.map((m) => {
                  const ruta = rutaModulo(m, usuario);
                  const lista = m.estado === "disponible";
                  const contenido = (
                    <>
                      <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: lista ? COLOR[m.id] : "rgba(255,255,255,0.3)" }} />
                      <span className="whitespace-nowrap">{m.nombre}</span>
                      {!lista && <span className="text-xs text-white/50">pronto</span>}
                    </>
                  );
                  return ruta && lista ? (
                    <Link key={m.id} to={ruta} className="inline-flex items-center gap-2.5 min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">
                      {contenido}
                    </Link>
                  ) : (
                    <span key={m.id} className="inline-flex items-center gap-2.5 min-h-[36px] text-[15px] text-white/70">
                      {contenido}
                    </span>
                  );
                })}
              </nav>
              <nav aria-labelledby="pie-portal" className="flex flex-col gap-1">
                <h2 id="pie-portal" className="m-0 mb-2 font-sans text-sm font-bold tracking-normal text-white/60">
                  Portal
                </h2>
                {[
                  ["#tramites", "Trámites"],
                  ["#dimensiones", "Dimensiones"],
                  ["#agenda", "Agenda"],
                  ["#ayuda", "Ayuda"],
                ].map(([href, texto]) => (
                  <a key={href} href={href} className="inline-flex items-center min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">
                    {texto}
                  </a>
                ))}
                {!usuario && (
                  <Link to="/login" className="inline-flex items-center min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">
                    Ingresar
                  </Link>
                )}
              </nav>
            </div>
          </div>

          <p className="relative mt-10 mb-0 pt-5 border-t border-white/15 text-[13px] text-white/70">
            © {new Date().getFullYear()} Bienestar Institucional · Corporación Universitaria Autónoma del Cauca · Popayán
          </p>
        </div>
      </footer>
    </div>
  );
}
