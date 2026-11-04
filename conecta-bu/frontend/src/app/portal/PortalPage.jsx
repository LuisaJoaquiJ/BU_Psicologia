import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";
import { http } from "../../lib/api/http";
import { IMAGENES, imagenDeEvento, respaldoDeFoto } from "../../lib/imagenes";
import { MODULOS, puedeAdministrar, rutaModulo } from "../../lib/modulos";
import { fechaLarga, formatearHora } from "../../lib/format";
import { Logo } from "../../components/Logo";
import { Icono } from "../../components/Iconos";
import { iniciales } from "../../components/Navbar";

const ROL_TEXTO = { Administrador: "Personal de Bienestar", SuperAdministrador: "Superadministrador", Estudiante: "Estudiante" };

const COLOR = {
  "desarrollo-humano": "#1E3A5F",
  salud: "#2C3E50",
  deporte: "#E8740E",
  permanencia: "#C89B14",
  cultura: "#FF9800",
};

const ENLACES_PORTAL = [
  ["#tramites", "Trámites"],
  ["#dimensiones", "Dimensiones"],
  ["#agenda", "Agenda"],
  ["#ayuda", "Ayuda"],
];

const ENTRA = "animate-aparecer motion-reduce:animate-aparecer-suave";
const retraso = (ms) => ({ animationDelay: `${ms}ms` });
const escalon = (ms) => ({ transitionDelay: `${ms}ms` });

const fechaDeEvento = (fecha) => {
  const f = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return { dia: f.getDate(), mes: f.toLocaleDateString("es-CO", { month: "short" }).replace(".", "") };
};

// --- HEADER FLOTANTE ---
function Encabezado() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 lg:px-10 pt-4 transition-all duration-300">
      <a href="#tramites" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-30 focus:bg-white focus:text-primary-dark focus:px-4 focus:py-2 focus:rounded-full focus:font-bold">
        Saltar al contenido
      </a>
      <div className="max-w-[1800px] mx-auto rounded-[32px] pl-3 sm:pl-6 pr-2 py-2 flex items-center justify-between gap-4 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_32px_rgba(11,35,71,0.08)] supports-[not(backdrop-filter:blur(1px))]:bg-white">
        <span className="hidden sm:block">
          <Logo alto={48} />
        </span>
        <span className="sm:hidden">
          <Logo alto={40} subtitulo="" />
        </span>
        <nav aria-label="Portal" className="hidden md:flex items-center gap-1 text-[15px] font-bold text-primary-dark">
          {ENLACES_PORTAL.map(([href, texto]) => (
            <a key={href} href={href} className="hover:bg-black/5 px-5 min-h-[44px] inline-flex items-center rounded-full transition-colors">{texto}</a>
          ))}
        </nav>
        {estaAutenticado ? (
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:block text-right leading-tight">
              <span className="block text-sm font-bold text-ink-900 truncate max-w-[220px]">{usuario?.nombre}</span>
              <span className="block text-xs text-ink-500">{ROL_TEXTO[usuario?.rol] || usuario?.rol}</span>
            </span>
            <span className="w-10 h-10 rounded-full boton-liquido font-extrabold text-sm flex items-center justify-center shrink-0">
              {iniciales(usuario?.nombre)}
            </span>
            <button onClick={cerrarSesion} className="text-sm font-bold rounded-full px-4 min-h-[44px] text-primary hover:bg-black/5">Salir</button>
          </div>
        ) : (
          <Link to="/login" className="boton-liquido font-extrabold text-[15px] px-6 min-h-[44px] rounded-full inline-flex items-center shrink-0 hover:-translate-y-px transition-transform">
            Ingresar
          </Link>
        )}
      </div>
      <nav aria-label="Secciones del portal" className="md:hidden mt-1.5 flex flex-wrap justify-center gap-1 rounded-full bg-white/80 backdrop-blur-xl">
        {ENLACES_PORTAL.map(([href, texto]) => (
          <a key={href} href={href} className="text-primary-dark text-sm font-semibold px-3 min-h-[36px] inline-flex items-center rounded-full">
            {texto}
          </a>
        ))}
      </nav>
    </header>
  );
}

// --- HERO INMERSIVO (100VH) ---
const DIMENSION = {
  "desarrollo-humano": { velo: "13,40,92", barra: "#7FB0FF", texto: "Citas con psicología, talleres y el asistente de orientación.", accion: "Pedir una cita" },
  deporte: { velo: "122,44,12", barra: "#FFB08A", texto: "Grupos, torneos y tus horas de deporte del semestre.", accion: "Ver la oferta" },
  permanencia: { velo: "92,66,6", barra: "#F3D27A", texto: "Tutorías y acompañamiento para culminar tu carrera.", accion: "Próximamente" },
  salud: { velo: "7,77,70", barra: "#5DE0C6", texto: "Enfermería, medicina general, jornadas y salidas académicas.", accion: "Ver servicios" },
  cultura: { velo: "150,82,0", barra: "#C9B8FF", texto: "Talleres de música y danza, grupos representativos y eventos.", accion: "Ver talleres" },
};

// Las cinco dimensiones pasan en una cinta que se desliza sola de derecha a
// izquierda y vuelve a empezar sin corte (las tarjetas van dos veces). Se
// detiene al pasar el mouse o con el teclado; con movimiento reducido queda
// quieta y se recorre deslizando.
function ColumnasDimensiones({ usuario }) {
  const tarjeta = (m, copia) => {
    const d = DIMENSION[m.id];
    const lista = m.estado === "disponible";
    const ruta = lista ? rutaModulo(m, usuario) || "#dimensiones" : "#dimensiones";
    const contenido = (
      <>
        <span className="absolute inset-0 overflow-hidden rounded-[28px]">
          <img src={m.imagen.src} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none" />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(${d.velo},0.08) 18%, rgba(${d.velo},0.95) 100%)` }} />
        </span>
        <span className="relative p-6 flex flex-col gap-2 text-white h-full justify-end">
          <span aria-hidden="true" className="w-[34px] h-1 rounded mb-1" style={{ background: d.barra }} />
          <strong className="text-2xl lg:text-[26px] leading-tight tracking-[-0.02em] [text-wrap:balance]">{m.nombre}</strong>
          <span className="text-[15px] leading-snug text-white/90 lg:opacity-0 transition-opacity duration-300 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100">{d.texto}</span>
          <span className="text-sm font-bold inline-flex items-center gap-1.5 mt-2">
            {d.accion} {lista && <Icono nombre="flecha" size={16} strokeWidth={2.4} />}
          </span>
        </span>
      </>
    );
    // Sombra teñida del color de la dimension: la tarjeta flota sobre la foto de la sede.
    const sombra = { boxShadow: `0 26px 50px -22px rgba(${d.velo},0.75), 0 8px 18px -10px rgba(0,0,0,0.4)` };
    const clase = "group relative h-full rounded-[28px] flex flex-col justify-end no-underline";
    // La segunda vuelta es solo visual: no la leen los lectores de pantalla ni se enfoca.
    const oculta = copia ? { "aria-hidden": true, tabIndex: -1 } : {};
    return (
      <li key={`${m.id}-${copia}`} className="shrink-0 w-[78vw] sm:w-[320px] lg:w-[300px] h-[380px] lg:h-[440px] lg:transition-[width] lg:duration-500 lg:ease-salida lg:hover:w-[560px] lg:focus-within:w-[560px] motion-reduce:transition-none">
        {lista ? (
          <Link to={ruta} className={clase} style={sombra} {...oculta}>{contenido}</Link>
        ) : (
          <a href="#dimensiones" className={clase} style={sombra} {...oculta}>{contenido}</a>
        )}
      </li>
    );
  };

  return (
    <section aria-label="Dimensiones de Bienestar" style={retraso(160)} className={`${ENTRA} cinta-dimensiones -mx-4 sm:-mx-6 lg:-mx-10`}>
      <ul className="cinta-pista list-none m-0 py-6 px-4 sm:px-6 lg:px-10 flex gap-4 w-max">
        {MODULOS.map((m) => tarjeta(m, false))}
        {MODULOS.map((m) => tarjeta(m, true))}
      </ul>
    </section>
  );
}

function HeroFullScreen() {
  const { usuario } = useAuth();
  const nombre = usuario?.nombre?.split(" ")[0];

  return (
    <div className="relative min-h-[100svh] flex flex-col justify-end pb-12 pt-28 bg-[#1E3A5F] overflow-x-clip">
      <img src={IMAGENES.sede.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1E3A5F] via-[#1E3A5F]/80 to-[#1E3A5F]/45" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute w-[520px] h-[520px] -left-40 top-10 rounded-full blur-3xl bg-[radial-gradient(circle,rgba(255,193,7,0.22)_0%,transparent_70%)]" />
        <div className="absolute w-[480px] h-[480px] -right-32 bottom-10 rounded-full blur-3xl bg-[radial-gradient(circle,rgba(235,104,52,0.18)_0%,transparent_70%)]" />
      </div>

      <div className="relative max-w-[1800px] mx-auto w-full px-4 sm:px-6 lg:px-10 flex flex-col gap-12">
        <section className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <h1 className={`m-0 font-sans text-[clamp(44px,6vw,80px)] leading-[0.95] tracking-[-0.04em] font-extrabold text-white max-w-[12em] ${ENTRA}`}>
            {nombre ? `Hola, ${nombre}` : "Cinco formas de cuidarte mientras estudias"}
          </h1>
          <p style={retraso(60)} className={`m-0 text-lg sm:text-xl leading-snug text-white/90 max-w-[26em] [text-wrap:pretty] ${ENTRA}`}>
            {nombre ? "Elige una dimensión o un trámite de los que más usas. Todo con tu cuenta institucional." : "Elige una dimensión de Bienestar Institucional. Con tu correo de la Uniautónoma pides citas, te inscribes y sigues tus horas."}
          </p>
        </section>

        <ColumnasDimensiones usuario={usuario} />
      </div>
    </div>
  );
}

// --- TRÁMITES (BENTO GRID) ---
function tramitesDe(usuario) {
  if (!usuario || usuario.rol === "Estudiante") {
    return [
      { to: "/estudiante/agendar", texto: "Pedir una cita de orientación psicológica", color: COLOR["desarrollo-humano"], icono: "corazon" },
      { to: "/estudiante/eventos", texto: "Inscribirme a un taller o evento", color: COLOR.permanencia, icono: "calendario" },
      { to: "/mi-deporte/horas", texto: "Ver mis horas de deporte", color: COLOR.deporte, icono: "balon" },
      { to: "/mi-salud", texto: "Pedir una cita en Salud Integral", color: COLOR.salud, icono: "estetoscopio" },
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
  return lista.slice(0, 4); // Limitamos a 4 para el Bento Grid
}

function Tramites() {
  const { usuario } = useAuth();
  const tramites = tramitesDe(usuario);

  return (
    <section id="tramites" className="relative scroll-mt-24 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
      <div className="absolute -z-10 w-[800px] h-[600px] -left-40 top-0 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.3)_0%,rgba(255,193,7,0)_70%)]" />
      
      {/* Bento Grid */}
      <div className="flex flex-col gap-6">
        <h2 className="m-0 font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-primary-dark">¿Qué necesitas hacer hoy?</h2>
        <ul className="list-none m-0 p-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 auto-rows-[minmax(180px,auto)]">
          {tramites.map((t, index) => (
            <li key={t.to} style={escalon(index * 70)} className={`revela ${index === 0 ? "lg:col-span-2 lg:row-span-2" : "lg:col-span-1"}`}>
              <Link
                to={t.to}
                className={`tarjeta-levanta group h-full flex flex-col justify-between p-6 sm:p-8 rounded-[32px] border no-underline
                  ${index === 0 
                    ? 'bg-gradient-to-br from-white to-[#EDE6D8] border-primary/10 shadow-[0_10px_30px_rgba(11,35,71,0.05)]' 
                    : 'bg-white border-[#E6DCC8] hover:bg-[#FBF7EF]'
                  }`}
              >
                <div className="flex items-start gap-4 sm:gap-5">
                  <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: `${t.color}15`, color: t.color }}>
                    <Icono nombre={t.icono || "flecha"} size={24} strokeWidth={2.5} />
                  </span>
                  <span className={`font-bold text-primary-dark leading-snug ${index === 0 ? 'text-2xl sm:text-3xl' : 'text-[17px] sm:text-lg'}`}>
                    {t.texto}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-8">
                  <span className="text-sm font-semibold text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {index === 0 ? "El trámite que más se usa en Bienestar." : "Acceso rápido"}
                  </span>
                  <Icono nombre="flecha" size={24} strokeWidth={2.5} className="text-primary transform group-hover:translate-x-2 transition-transform" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- DETALLE DE DIMENSIONES ---
function Dimensiones() {
  const { usuario } = useAuth();
  const [elegida, setElegida] = useState(MODULOS[0].id);
  const modulo = MODULOS.find((m) => m.id === elegida);
  const disponible = modulo.estado === "disponible";
  const ruta = rutaModulo(modulo, usuario);
  const d = DIMENSION[modulo.id];
  const solido = `rgb(${d.velo})`;

  return (
    <section id="dimensiones" className="relative scroll-mt-24 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
      <div className="absolute -z-10 w-[820px] h-[720px] -right-40 top-24 rounded-full transition-[background] duration-500" style={{ background: `radial-gradient(circle, rgba(${d.velo},0.15) 0%, rgba(${d.velo},0) 70%)` }} />
      
      <div className="revela flex flex-wrap items-end justify-between gap-x-10 gap-y-4 mb-10">
        <h2 className="m-0 font-sans text-[clamp(32px,4vw,52px)] leading-[1.02] font-extrabold tracking-[-0.04em] text-primary-dark max-w-[12em]">Cinco dimensiones, una sola cuenta</h2>
        <p className="m-0 text-ink-500 text-lg max-w-[30em]">Así organiza la Uniautónoma su Bienestar Institucional. Elige una para ver qué puedes hacer en ella.</p>
      </div>

      <div role="tablist" aria-label="Dimensiones" style={escalon(80)} className="revela flex flex-wrap gap-2 mb-8">
        {MODULOS.map((m) => {
          const activa = m.id === elegida;
          const lista = m.estado === "disponible";
          const color = DIMENSION[m.id];
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              id={`tab-${m.id}`}
              aria-selected={activa}
              aria-controls="panel-dimension"
              onClick={() => setElegida(m.id)}
              style={activa ? { background: `linear-gradient(180deg, rgba(${color.velo},0.78) 0%, rgb(${color.velo}) 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 20px rgba(${color.velo},0.3)` } : undefined}
              className={`inline-flex items-center gap-2.5 min-h-[52px] px-[22px] rounded-full text-[16px] font-bold transition-all duration-200 ${
                activa ? "text-white" : lista ? "bg-white/60 backdrop-blur text-primary-dark hover:bg-white shadow-sm border border-white/50" : "border-[1.5px] border-dashed border-[#C9D2E2] text-ink-500 hover:bg-white"
              }`}
            >
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: activa ? color.barra : lista ? `rgb(${color.velo})` : "#C9D2E2" }} />
              {m.nombre}
              {!lista && <span className="text-[13px] font-semibold">· próximamente</span>}
            </button>
          );
        })}
      </div>

      {/* Envoltura fija para la transicion de scroll: el panel de adentro se
          vuelve a montar al cambiar de pestana (key) y perderia la clase. */}
      <div style={escalon(140)} className="revela">
      <div
        key={modulo.id}
        role="tabpanel"
        id="panel-dimension"
        aria-labelledby={`tab-${modulo.id}`}
        className="rounded-[40px] p-4 sm:p-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_20px_60px_-15px_rgba(11,35,71,0.1)]"
      >
        <div className="relative min-h-[300px] sm:min-h-[460px] rounded-[32px] overflow-hidden shadow-[0_24px_50px_-24px_rgba(11,35,71,0.45)]">
          <img src={modulo.imagen.src} alt={modulo.imagen.alt} className={`absolute inset-0 w-full h-full object-cover ${disponible ? "" : "grayscale"}`} />
          <span aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(200deg, rgba(${d.velo},0) 40%, rgba(${d.velo},0.8) 100%)` }} />
          <span className="absolute top-6 left-6 rounded-full px-5 min-h-[42px] inline-flex items-center gap-2 text-white text-sm font-bold bg-black/30 backdrop-blur-md border border-white/20">
            <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ background: disponible ? d.barra : "#C9D2E2" }} />
            {disponible ? "Disponible" : "Próximamente"}
          </span>
        </div>
        <div className="min-w-0 flex flex-col gap-5 p-4 sm:p-8">
          <span aria-hidden="true" className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white shadow-lg" style={{ background: `linear-gradient(140deg, rgba(${d.velo},0.7), ${solido})` }}>
            <Icono nombre={modulo.icono} size={30} strokeWidth={2} />
          </span>
          <h3 className="m-0 font-sans text-[32px] sm:text-[42px] leading-tight font-extrabold tracking-[-0.03em] text-primary-dark">{modulo.nombre}</h3>
          <p className="m-0 text-ink-600 text-[17px] leading-relaxed max-w-[38em]">{modulo.descripcion}</p>
          
          {disponible && (
            <ul className="list-none m-0 p-0 flex flex-col gap-3 mt-2">
              {modulo.servicios.map((s) => (
                <li key={s} className="bg-white/80 rounded-2xl px-4 py-3 flex items-center gap-3 text-ink-900 font-semibold text-[15px] shadow-sm border border-white">
                  <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: solido }}>
                    <Icono nombre="check" size={15} strokeWidth={2.6} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          )}
          
          <div className="mt-auto pt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            {!disponible ? (
              <p className="m-0 font-bold text-ink-500">Esta dimensión estará en Conecta BU próximamente.</p>
            ) : ruta ? (
              <Link
                to={ruta}
                style={{ background: `linear-gradient(180deg, rgba(${d.velo},0.78) 0%, ${solido} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 24px rgba(${d.velo},0.3)` }}
                className="inline-flex items-center gap-2.5 min-h-[56px] px-8 rounded-full text-white font-extrabold text-lg no-underline transition-transform duration-200 ease-salida hover:-translate-y-1"
              >
                {usuario ? `Entrar a ${modulo.corto}` : "Ingresar para empezar"}
                <Icono nombre="flecha" size={20} strokeWidth={2.2} />
              </Link>
            ) : (
              <p className="m-0 font-bold text-ink-500">Solo para el personal asignado a esta dimensión.</p>
            )}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

// --- AGENDA INMERSIVA ---
function Agenda({ eventos, error, destino, onReintentar }) {
  const { usuario } = useAuth();
  const textoBoton = usuario ? "Inscribirme" : "Ingresar para inscribirme";
  const [destacado, ...siguientes] = eventos || [];
  const solo = siguientes.length === 0;
  const cupos = (e) => `${e.cuposDisponibles} ${e.cuposDisponibles === 1 ? "cupo libre" : "cupos libres"}`;

  return (
    <section id="agenda" className="scroll-mt-24 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10">
      <div className="relative overflow-hidden bg-[#1E3A5F] text-white px-5 sm:px-10 lg:px-14 py-14 sm:py-20 rounded-[40px]">
        <div aria-hidden="true" className="absolute w-[800px] h-[800px] -left-60 -top-80 rounded-full bg-[radial-gradient(circle,rgba(30,58,95,0.8)_0%,rgba(30,58,95,0)_70%)]" />
        <div aria-hidden="true" className="absolute w-[600px] h-[600px] right-[-10rem] bottom-[-20rem] rounded-full bg-[radial-gradient(circle,rgba(232,116,14,0.5)_0%,rgba(232,116,14,0)_70%)]" />

        <div className="relative max-w-[1600px] mx-auto">
          <div className="revela flex justify-between items-end gap-5 flex-wrap mb-10">
            <h2 className="m-0 font-sans text-[clamp(32px,4vw,52px)] leading-tight font-extrabold tracking-[-0.04em] text-white">Próximamente en el campus</h2>
            <Link to={destino} className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-extrabold text-lg no-underline transition-colors">
              Ver toda la agenda <Icono nombre="flecha" size={20} strokeWidth={2.2} />
            </Link>
          </div>

          {eventos && eventos.length === 0 && (
            <div role={error ? "alert" : "status"} className="relative p-8 rounded-[32px] bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-lg flex flex-wrap items-center gap-4">
              <p className="m-0 flex-1">{error ? "No pudimos cargar la agenda. Revisa tu conexión y vuelve a intentarlo." : "Aún no hay talleres ni eventos publicados. Vuelve más tarde."}</p>
              {error && (
                <button type="button" onClick={onReintentar} className="min-h-[44px] px-5 rounded-full bg-white text-primary-dark font-extrabold">
                  Reintentar
                </button>
              )}
            </div>
          )}

          {!eventos && (
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="h-[360px] rounded-[32px] bg-white/10 animate-pulse" />
              <div className="flex flex-col gap-6">
                <div className="h-[168px] rounded-[32px] bg-white/10 animate-pulse" />
                <div className="h-[168px] rounded-[32px] bg-white/10 animate-pulse" />
              </div>
            </div>
          )}

          {/* Con un solo evento la tarjeta va horizontal y compacta. */}
          {destacado && solo && (
            <article className="revela group relative bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] max-w-[1100px]">
              <div className="relative h-[200px] md:h-auto md:min-h-[260px] rounded-[24px] overflow-hidden">
                <img src={imagenDeEvento(destacado).src} alt="" onError={respaldoDeFoto(destacado)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <FechaEvento fecha={destacado.fecha} className="absolute top-4 left-4" />
              </div>
              <div className="min-w-0 flex flex-col justify-center gap-2 p-2 sm:p-6">
                <p className="m-0 text-sm sm:text-base font-bold text-[#FFC107] tabular-nums">{fechaLarga(destacado.fecha)} · {formatearHora(destacado.horaInicio)}</p>
                <h3 className="m-0 font-sans text-[26px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.03em] text-white">{destacado.nombre}</h3>
                <p className="m-0 text-white/80 text-lg">{destacado.lugar ? `${destacado.lugar} · ` : ""}<span className="tabular-nums">{cupos(destacado)}</span></p>
                <Link to={destacado.destino || destino} className="mt-3 self-start inline-flex items-center min-h-[52px] px-7 rounded-full bg-white text-primary-dark font-extrabold no-underline transition-transform duration-200 hover:-translate-y-1 shadow-xl">{textoBoton}</Link>
              </div>
            </article>
          )}

          {destacado && !solo && (
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <article className="relative min-h-[400px] sm:min-h-[500px] rounded-[32px] overflow-hidden flex flex-col justify-end group">
                <img src={imagenDeEvento(destacado).src} alt="" onError={respaldoDeFoto(destacado)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,58,95,0.05)_20%,rgba(30,58,95,0.6)_55%,rgba(30,58,95,0.95)_100%)]" />
                <FechaEvento fecha={destacado.fecha} className="absolute top-6 left-6" />
                <div className="relative p-6 sm:p-10 flex flex-col gap-3 z-10">
                  <p className="m-0 text-sm sm:text-base font-bold text-[#FFC107] tabular-nums">{fechaLarga(destacado.fecha)} · {formatearHora(destacado.horaInicio)}</p>
                  <h3 className="m-0 font-sans text-[28px] sm:text-[40px] leading-tight font-extrabold tracking-[-0.03em] text-white">{destacado.nombre}</h3>
                  <p className="m-0 text-white/80 text-lg">{destacado.lugar ? `${destacado.lugar} · ` : ""}<span className="tabular-nums">{cupos(destacado)}</span></p>
                  <Link to={destacado.destino || destino} className="mt-4 self-start inline-flex items-center min-h-[54px] px-8 rounded-full bg-white text-primary-dark font-extrabold text-lg no-underline transition-transform duration-200 hover:-translate-y-1 shadow-xl">{textoBoton}</Link>
                </div>
              </article>

              <div className="flex flex-col gap-6">
                {siguientes.map((e) => (
                  <article key={e.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-4 flex flex-col sm:flex-row gap-5 flex-1 group">
                    <div className="relative shrink-0 w-full sm:w-[220px] h-[180px] sm:h-auto sm:min-h-[200px] rounded-[24px] overflow-hidden">
                      <img src={imagenDeEvento(e).src} alt="" onError={respaldoDeFoto(e)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <FechaEvento fecha={e.fecha} className="absolute top-4 left-4" />
                    </div>
                    <div className="min-w-0 flex flex-col gap-2 py-2 pr-2">
                      <p className="m-0 text-sm font-bold text-[#FFC107] tabular-nums">{fechaLarga(e.fecha)} · {formatearHora(e.horaInicio)}</p>
                      <h3 className="m-0 font-sans text-2xl font-extrabold tracking-[-0.02em] text-white leading-tight">{e.nombre}</h3>
                      <p className="m-0 text-white/70 text-[15px]">{e.lugar ? `${e.lugar} · ` : ""}<span className="tabular-nums">{cupos(e)}</span></p>
                      <Link to={e.destino || destino} className="mt-auto self-start inline-flex items-center min-h-[44px] px-6 rounded-full bg-white/10 hover:bg-white text-white hover:text-primary-dark transition-colors font-extrabold text-sm no-underline">{textoBoton}</Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FechaEvento({ fecha, className = "" }) {
  const f = fechaDeEvento(fecha);
  return (
    <span className={`w-[64px] h-[64px] rounded-[20px] bg-white/95 backdrop-blur-md text-primary-dark shadow-[0_8px_30px_rgba(11,35,71,0.3)] flex flex-col items-center justify-center leading-none ${className}`}>
      <strong className="text-[24px] tabular-nums mb-0.5">{f.dia}</strong>
      <span className="text-xs font-bold text-accent">{f.mes}</span>
    </span>
  );
}

// --- PÁGINA PRINCIPAL ---
export function PortalPage() {
  const { usuario } = useAuth();
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState(false);
  const raiz = useRef(null);

  function cargarAgenda() {
    setError(false);
    setEventos(null);
    const cultura = http.get("/cultura/publico/agenda").then((r) => r.data.map((e) => ({ ...e, id: `cultura-${e.id}`, horaInicio: `1970-01-01T${e.horaInicio}:00.000Z`, destino: rutaCultura }))).catch(() => []);
    Promise.all([http.get("/eventos/publicos"), cultura])
      .then(([res, deCultura]) => setEventos([...res.data.eventos, ...deCultura].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).slice(0, 3)))
      .catch(() => { setError(true); setEventos([]); });
  }

  useEffect(() => {
    cargarAgenda();
  }, []);

  useEffect(() => {
    const nodos = raiz.current.querySelectorAll(".revela");
    if (!("IntersectionObserver" in window)) {
      nodos.forEach((n) => n.classList.add("visible"));
      return undefined;
    }
    // Entra al aparecer y sale al irse, en los dos sentidos del scroll. Se anota
    // por donde salio para que al volver entre desde ese mismo lado.
    const observador = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
        } else {
          e.target.dataset.salida = e.boundingClientRect.top < 0 ? "arriba" : "abajo";
          e.target.classList.remove("visible");
        }
      }),
      { rootMargin: "-6% 0px -10% 0px" }
    );
    nodos.forEach((n) => observador.observe(n));
    return () => observador.disconnect();
  }, [eventos]);

  const orientacion = MODULOS.find((m) => m.id === "desarrollo-humano");
  const rutaOrientacion = !usuario ? "/login" : usuario.rol === "Estudiante" ? "/estudiante/agendar" : (orientacion && rutaModulo(orientacion, usuario)) || "/";
  const rutaCultura = usuario?.rol === "Estudiante" ? "/mi-cultura/agenda" : usuario ? "/" : "/login";
  const destinoEventos = usuario?.rol === "Estudiante" ? "/estudiante/eventos" : usuario ? "/desarrollo-humano#eventos" : "/login";

  return (
    <div ref={raiz} className="portal relative isolate min-h-screen bg-[#F3EDE1] overflow-x-clip selection:bg-accent selection:text-white">
      <Encabezado />
      <HeroFullScreen />
      <Tramites />
      <Dimensiones />
      <Agenda eventos={eventos} error={error} destino={destinoEventos} onReintentar={cargarAgenda} />

      <section id="ayuda" className="scroll-mt-24 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="revela relative overflow-hidden flex gap-8 flex-wrap items-center justify-between p-8 sm:p-12 rounded-[40px] bg-white/70 backdrop-blur-xl border border-white shadow-[0_20px_60px_-15px_rgba(11,35,71,0.1)]">
          <div aria-hidden="true" className="absolute w-[420px] h-[420px] -right-24 -top-40 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.35)_0%,rgba(255,193,7,0)_70%)]" />
          <div className="relative flex-[1_1_460px] min-w-0">
            <h2 className="m-0 mb-3 font-sans text-lg font-extrabold text-primary-dark">Cómo usar Conecta BU</h2>
            <ol className="m-0 mb-6 pl-5 list-decimal flex flex-col gap-1.5 text-ink-600">
              <li>Entra con tu correo institucional @uniautonoma.edu.co.</li>
              <li>Elige una dimensión: orientación, deporte, salud o arte y cultura.</li>
              <li>Pide la cita o inscríbete. Puedes salir cuando quieras desde el botón Salir.</li>
            </ol>
            <h3 className="m-0 mb-3 font-sans text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-primary-dark">¿Necesitas hablar con alguien ahora?</h3>
            <p className="m-0 text-ink-600 text-lg max-w-[40em]">En una emergencia llama a la línea 123. Para acompañamiento, pide una cita de orientación o acércate a la oficina de Bienestar Institucional.</p>
          </div>
          <div className="relative flex gap-3 flex-wrap">
            <a href="tel:123" className="inline-flex items-center gap-2 min-h-[54px] px-8 rounded-full bg-primary-dark text-white font-extrabold text-lg no-underline hover:bg-primary transition-colors shadow-lg">
              <Icono nombre="telefono" size={20} strokeWidth={2} /> Llamar a la línea 123
            </a>
            <Link to={rutaOrientacion} className="boton-liquido inline-flex items-center min-h-[54px] px-8 rounded-full font-extrabold text-lg no-underline transition-transform duration-200 hover:-translate-y-1 shadow-lg">
              Pedir una cita
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 pb-8">
        <div className="revela relative overflow-hidden rounded-[40px] bg-primary-dark text-[#D9E2F2] px-8 sm:px-12 pt-12 pb-8 shadow-2xl">
          <div aria-hidden="true" className="absolute w-[480px] h-[480px] -left-40 -bottom-64 rounded-full bg-[radial-gradient(circle,rgba(30,58,95,0.9)_0%,rgba(30,58,95,0)_70%)]" />
          <div aria-hidden="true" className="absolute w-[420px] h-[420px] right-[12%] -top-60 rounded-full bg-[radial-gradient(circle,rgba(232,116,14,0.35)_0%,rgba(232,116,14,0)_70%)]" />
          {/* Tres columnas: marca, dimensiones y portal. La ayuda ya esta en el bloque de arriba. */}
          <div className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.7fr)] lg:gap-16">
            <div className="min-w-0 flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
              <Logo alto={48} invertido />
              <p className="m-0 mt-2 font-sans text-[26px] sm:text-[30px] font-extrabold tracking-[-0.035em] leading-[1.08] text-white max-w-[14em]">Somos el motor de la innovación.</p>
              <p className="m-0 text-[15px] leading-relaxed text-white/70 max-w-[32em]">Citas, talleres, salud y deporte de Bienestar Institucional, con tu correo de la Uniautónoma.</p>
            </div>
            <nav aria-labelledby="pie-dimensiones" className="flex flex-col gap-1">
              <h2 id="pie-dimensiones" className="m-0 mb-2 font-sans text-sm font-bold tracking-normal text-white/60">Dimensiones</h2>
              {MODULOS.map((m) => {
                const ruta = rutaModulo(m, usuario);
                const lista = m.estado === "disponible";
                return ruta && lista ? (
                  <Link key={m.id} to={ruta} className="inline-flex items-center gap-2.5 min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR[m.id] }} />
                    {m.nombre}
                  </Link>
                ) : (
                  <span key={m.id} className="inline-flex items-center gap-2.5 min-h-[36px] text-[15px] text-white/60">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0 bg-white/30" />
                    {m.nombre}
                    <span className="text-xs text-white/45">próximamente</span>
                  </span>
                );
              })}
            </nav>
            <nav aria-labelledby="pie-portal" className="flex flex-col gap-1">
              <h2 id="pie-portal" className="m-0 mb-2 font-sans text-sm font-bold tracking-normal text-white/60">Portal</h2>
              {ENLACES_PORTAL.map(([href, texto]) => (
                <a key={href} href={href} className="inline-flex items-center min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">{texto}</a>
              ))}
              {!usuario && <Link to="/login" className="inline-flex items-center min-h-[36px] text-[15px] text-white no-underline hover:underline underline-offset-4">Ingresar</Link>}
            </nav>
          </div>
          <div className="relative mt-12 pt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] text-white/60">
            <p className="m-0">© {new Date().getFullYear()} Bienestar Institucional · Corporación Universitaria Autónoma del Cauca · Popayán</p>
            <a href="#" className="inline-flex items-center gap-1.5 min-h-[36px] text-white/80 font-bold no-underline hover:text-white">
              Volver arriba
              <Icono nombre="flecha" size={15} strokeWidth={2.2} className="-rotate-90" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}