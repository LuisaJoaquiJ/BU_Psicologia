import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { formatearHora } from "../../lib/format";
import { IMAGENES } from "../../lib/imagenes";
import { Logo } from "../../components/Logo";
import { Icono } from "../../components/Iconos";

// Pagina de inicio publica (rediseño): presenta Conecta BU antes de iniciar
// sesion. Carrusel de destacados, cinta de servicios, servicios, proximos
// eventos (GET /eventos/publicos) y pasos para agendar.

const DESTACADOS = [
  {
    kicker: "Bienestar Universitario",
    tituloA: "Tu bienestar,",
    tituloB: "en un solo lugar.",
    texto:
      "Agenda tu cita de orientación, inscríbete a talleres y resuelve tus dudas con el asistente, todo con tu cuenta institucional.",
    cta: "Agendar una cita",
    fondo: "bg-primary",
    imagen: IMAGENES.integracion,
    posicion: "50% 40%",
    pie: "Jornada de integración",
    pieSub: "Bienestar Uniautónomo",
    selloA: "24/7",
    selloB: "agenda en línea",
  },
  {
    kicker: "Eventos y talleres",
    tituloA: "Talleres que te ayudan a",
    tituloB: "respirar.",
    texto:
      "Mindfulness, hábitos de estudio, ferias de bienestar y más. Los cupos son limitados: inscríbete desde la plataforma.",
    cta: "Ver eventos",
    fondo: "bg-[#132F63]",
    imagen: IMAGENES.permanencia,
    posicion: "50% 50%",
    pie: "Actividad de permanencia estudiantil",
    pieSub: "Talleres y actividades al aire libre",
    selloA: "¡Cupos!",
    selloB: "inscríbete ya",
  },
  {
    kicker: "Nuevo",
    tituloA: "Un asistente que",
    tituloB: "te orienta.",
    texto:
      "Pregunta cómo agendar, qué servicios hay o qué eventos se vienen. Te responde al instante y te lleva al lugar correcto.",
    cta: "Probar el asistente",
    fondo: "bg-[#0E254F]",
    imagen: IMAGENES.auditorio,
    posicion: "50% 45%",
    pie: "Charlas en el auditorio",
    pieSub: "Resuelve tus dudas antes de llegar",
    selloA: "Nuevo",
    selloB: "asistente IA",
  },
];

const CINTA = [
  "Orientación psicológica",
  "Mindfulness",
  "Talleres grupales",
  "Hábitos de estudio",
  "Feria de bienestar",
  "Asistente de orientación",
];

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function Carrusel() {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = DESTACADOS.length;
  const ir = useCallback((n) => setIndice((n + total) % total), [total]);

  // Avanza solo cada 7 s; se detiene al pasar el mouse o enfocar un control.
  useEffect(() => {
    if (pausado) return undefined;
    const id = setInterval(() => setIndice((i) => (i + 1) % total), 7000);
    return () => clearInterval(id);
  }, [pausado, total]);

  const s = DESTACADOS[indice];

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={`${s.fondo} rounded-[28px] overflow-hidden transition-colors duration-500`}
    >
      <div className="flex flex-wrap items-stretch min-h-[480px]">
        <div className="flex-[1_1_460px] px-8 py-12 sm:px-14 sm:py-16 flex flex-col justify-center gap-5" aria-live="polite">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-gold">
            <span className="w-7 h-0.5 bg-gold" />
            {s.kicker}
          </span>
          <h1 className="m-0 text-white text-[42px] sm:text-[60px] leading-[1.04] font-semibold">
            {s.tituloA}{" "}
            <span className="inline-block bg-gold-soft text-primary px-3.5 pb-1 rounded-2xl -rotate-2">{s.tituloB}</span>
          </h1>
          <p className="m-0 text-lg leading-relaxed text-[#D6DDEC] max-w-[480px]">{s.texto}</p>
          <div className="flex gap-3 flex-wrap mt-2">
            <Link
              to="/login"
              className="bg-gold text-primary font-bold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center hover:brightness-95"
            >
              {s.cta}
            </Link>
            <a
              href="#servicios"
              className="border-[1.5px] border-white/45 text-white font-semibold text-[15px] px-6 min-h-[48px] rounded-full inline-flex items-center hover:bg-white/10"
            >
              Conocer servicios
            </a>
          </div>
        </div>

        <div className="flex-[1_1_420px] relative flex items-center justify-center px-10 pt-12 pb-6">
          <div aria-hidden="true" className="absolute w-[78%] max-w-[420px] aspect-[4/3] rounded-[22px] bg-gold-soft rotate-6 translate-x-4 translate-y-1.5" />
          <div className="animate-flota absolute top-7 right-9 z-10 w-28 h-28 rounded-full bg-white text-primary flex flex-col items-center justify-center text-center shadow-[0_12px_28px_rgba(0,0,0,0.25)] font-extrabold text-[13px] leading-tight">
            <span className="font-display text-2xl text-accent">{s.selloA}</span>
            {s.selloB}
          </div>
          <figure className="relative m-0 w-full max-w-[440px] aspect-[4/3] rounded-[22px] overflow-hidden flex items-end -rotate-3 shadow-[0_24px_50px_rgba(0,0,0,0.3)] bg-primary-soft">
            <img
              key={s.imagen.src}
              src={s.imagen.src}
              alt={s.imagen.alt}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: s.posicion }}
            />
            <figcaption className="relative m-4 bg-primary/85 text-white rounded-[14px] px-4 py-3 text-[13px] leading-snug">
              <strong className="block text-[15px]">{s.pie}</strong>
              {s.pieSub}
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap px-8 sm:px-14 pb-8">
        <div className="flex gap-2.5" role="group" aria-label="Elegir destacado">
          {DESTACADOS.map((d, n) => (
            <button
              key={d.pie}
              type="button"
              onClick={() => ir(n)}
              aria-label={`Destacado ${n + 1}: ${d.pie}`}
              aria-current={n === indice}
              className={`h-2.5 rounded-full transition-all ${n === indice ? "w-8 bg-gold" : "w-2.5 bg-white/40"}`}
            />
          ))}
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => ir(indice - 1)}
            aria-label="Anterior"
            className="w-12 h-12 rounded-full border-[1.5px] border-white/40 text-white flex items-center justify-center hover:bg-white/10"
          >
            <Icono nombre="izquierda" size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => ir(indice + 1)}
            aria-label="Siguiente"
            className="w-12 h-12 rounded-full bg-gold text-primary flex items-center justify-center hover:brightness-95"
          >
            <Icono nombre="derecha" size={20} strokeWidth={2} />
          </button>
        </div>
      </div>
    </section>
  );
}

function Cinta() {
  const items = [...CINTA, ...CINTA];
  return (
    <div className="mt-10 bg-primary -rotate-[1.5deg] overflow-hidden py-4 shadow-[0_10px_30px_rgba(11,42,91,0.18)]">
      <p className="sr-only">Servicios: {CINTA.join(", ")}.</p>
      <div aria-hidden="true" className="animate-cinta flex gap-10 w-max items-center whitespace-nowrap font-display text-[28px] font-semibold text-white">
        {items.map((texto, i) => (
          <span key={i} className="flex items-center gap-10">
            {texto}
            <span className="text-gold-soft">✺</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ProximosEventos() {
  const [eventos, setEventos] = useState(null);

  useEffect(() => {
    http
      .get("/eventos/publicos")
      .then((res) => setEventos(res.data.eventos.slice(0, 3)))
      .catch(() => setEventos([]));
  }, []);

  if (eventos && eventos.length === 0) {
    return (
      <p className="text-ink-500 bg-white border border-gray-200 rounded-2xl p-6">
        Pronto publicaremos nuevos eventos. Inicia sesión para recibir la agenda del campus.
      </p>
    );
  }

  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
      {(eventos || [null, null, null]).map((evento, i) =>
        evento ? (
          <article key={evento.id} className="bg-white border border-gray-200 rounded-[22px] p-6 flex gap-5">
            <div
              className={`shrink-0 w-[72px] h-[84px] rounded-2xl flex flex-col items-center justify-center ${
                i % 2 ? "bg-gold text-primary" : "bg-primary text-white"
              }`}
            >
              <span className="font-display text-3xl font-semibold leading-none">
                {new Date(evento.fecha).getUTCDate().toString().padStart(2, "0")}
              </span>
              <span className={`text-xs font-bold tracking-widest ${i % 2 ? "" : "text-gold"}`}>
                {MESES[new Date(evento.fecha).getUTCMonth()]}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <h3 className="m-0 text-lg font-bold text-primary">{evento.nombre}</h3>
              <p className="m-0 text-sm text-ink-500">
                {formatearHora(evento.horaInicio)} – {formatearHora(evento.horaFin)}
                {evento.lugar ? ` · ${evento.lugar}` : ""}
              </p>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="flex-1 h-1.5 rounded-full bg-primary-light overflow-hidden">
                  <div
                    className="h-full bg-primary-soft"
                    style={{ width: `${Math.round(((evento.cupos - evento.cuposDisponibles) / evento.cupos) * 100)}%` }}
                  />
                </div>
                <span className="text-[13px] font-bold text-primary">{evento.cuposDisponibles} cupos</span>
              </div>
            </div>
          </article>
        ) : (
          <div key={i} className="bg-white/60 border border-gray-200 rounded-[22px] h-[132px] animate-pulse" />
        )
      )}
    </div>
  );
}

function Encabezado({ kicker, titulo, enlace }) {
  return (
    <div className="flex justify-between items-end gap-6 flex-wrap mb-8">
      <div className="max-w-[580px]">
        <p className="m-0 mb-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">{kicker}</p>
        <h2 className="m-0 text-[34px] sm:text-[40px] leading-tight font-semibold">{titulo}</h2>
      </div>
      {enlace}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">
      <header className="px-4 sm:px-6 pt-5">
        <div className="max-w-[1152px] mx-auto bg-white rounded-[28px] sm:rounded-full shadow-[0_10px_30px_rgba(11,42,91,0.08)] pl-5 pr-3 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Logo subtitulo="Bienestar Universitario · Uniautónoma del Cauca" />
          <nav aria-label="Principal" className="flex items-center gap-6 text-[15px] font-semibold flex-wrap">
            <a href="#servicios" className="text-primary hover:text-primary-soft">Servicios</a>
            <a href="#eventos" className="text-ink-600 hover:text-primary">Eventos</a>
            <a href="#como" className="text-ink-600 hover:text-primary">Cómo funciona</a>
          </nav>
          <Link
            to="/login"
            className="bg-primary text-white font-bold text-[15px] px-5 min-h-[44px] rounded-full inline-flex items-center hover:bg-primary-dark"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        <Carrusel />
      </div>

      <Cinta />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid gap-4 mt-12 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {[
            { icono: "calendario", titulo: "Citas en línea", texto: "Agenda sin filas ni llamadas", tono: "bg-primary-light text-primary-soft" },
            { icono: "estrella", titulo: "Eventos y talleres", texto: "Inscríbete mientras haya cupos", tono: "bg-gold-light text-accent" },
            { icono: "escudo", titulo: "Confidencial", texto: "Solo con tu cuenta institucional", tono: "bg-primary-light text-primary-soft" },
          ].map((d) => (
            <div key={d.titulo} className="bg-white border border-gray-200 rounded-[18px] px-5 py-5 flex gap-3.5 items-center">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${d.tono}`}>
                <Icono nombre={d.icono} />
              </span>
              <span>
                <strong className="block text-[15px]">{d.titulo}</strong>
                <span className="text-[13px] text-ink-500">{d.texto}</span>
              </span>
            </div>
          ))}
        </div>

        <section id="servicios" className="pt-24">
          <Encabezado
            kicker="Desarrollo Humano · Orientación"
            titulo="Acompañamiento para cada etapa de tu vida universitaria"
            enlace={<Link to="/login" className="font-bold text-[15px] text-primary-soft">Ver todos los servicios →</Link>}
          />
          <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {[
              { img: IMAGENES.salud, etiqueta: "Individual", titulo: "Orientación psicológica individual", texto: "Acompañamiento personalizado para situaciones académicas, emocionales o personales." },
              { img: IMAGENES.permanencia, etiqueta: "Grupal", titulo: "Talleres de Desarrollo Humano", texto: "Herramientas prácticas para el estrés académico, los hábitos de estudio y la convivencia." },
            ].map((s) => (
              <article key={s.titulo} className="bg-white border border-gray-200 rounded-[22px] overflow-hidden flex flex-col">
                <div className="relative h-[190px] flex items-end p-4 bg-primary-soft">
                  <img src={s.img.src} alt={s.img.alt} className="absolute inset-0 w-full h-full object-cover" />
                  <span className="relative bg-white/95 text-primary text-xs font-bold rounded-full px-3 py-1.5">{s.etiqueta}</span>
                </div>
                <div className="p-6 flex flex-col gap-2.5 flex-1">
                  <h3 className="m-0 text-xl font-bold text-primary">{s.titulo}</h3>
                  <p className="m-0 text-[15px] leading-relaxed text-ink-600">{s.texto}</p>
                  <Link to="/login" className="mt-auto pt-2 font-bold text-[15px] text-primary-soft">Agendar cita →</Link>
                </div>
              </article>
            ))}
            <article className="bg-primary rounded-[22px] text-white p-7 flex flex-col gap-3.5">
              <span className="w-12 h-12 rounded-[14px] bg-gold/20 text-gold flex items-center justify-center">
                <Icono nombre="chat" size={24} />
              </span>
              <h3 className="m-0 text-xl font-bold">¿No sabes por dónde empezar?</h3>
              <p className="m-0 text-[15px] leading-relaxed text-[#D6DDEC]">
                Pregúntale al asistente de orientación: te explica los servicios y cómo agendar en segundos.
              </p>
              <Link to="/login" className="mt-auto self-start bg-gold text-primary font-bold text-[15px] px-5 min-h-[44px] rounded-full inline-flex items-center">
                Hablar con el asistente
              </Link>
            </article>
          </div>
        </section>

        <section id="eventos" className="pt-24">
          <Encabezado
            kicker="Agenda del campus"
            titulo="Próximos eventos"
            enlace={<Link to="/login" className="font-bold text-[15px] text-primary-soft">Inscribirme →</Link>}
          />
          <ProximosEventos />
        </section>

        <section id="como" className="pt-24">
          <div className="bg-white border border-gray-200 rounded-[28px] p-8 sm:p-14">
            <p className="m-0 mb-2.5 text-[13px] font-bold tracking-[0.14em] uppercase text-accent">Cómo funciona</p>
            <h2 className="m-0 mb-10 text-[34px] sm:text-[40px] leading-tight font-semibold">Tu cita en tres pasos</h2>
            <ol className="list-none m-0 p-0 grid gap-8 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {[
                ["Ingresa con tu cuenta", "Usa tu correo @uniautonoma.edu.co; no necesitas crear otra contraseña."],
                ["Elige servicio y horario", "Ves solo los horarios libres y confirmas en un clic."],
                ["Recibe la confirmación", "Tu cita queda en «Mis citas» y puedes cancelarla si lo necesitas."],
              ].map(([titulo, texto], i) => (
                <li key={titulo} className="flex flex-col gap-3">
                  <span className="font-display text-[44px] font-semibold text-gold leading-none">0{i + 1}</span>
                  <strong className="text-lg text-primary">{titulo}</strong>
                  <span className="text-[15px] leading-relaxed text-ink-600">{texto}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-24">
          <div className="bg-primary rounded-[28px] p-8 sm:p-14 flex justify-between items-center gap-8 flex-wrap">
            <div className="max-w-[620px]">
              <h2 className="m-0 mb-3 text-[34px] sm:text-[40px] leading-tight font-semibold text-white">
                Tu bienestar también es parte de tu carrera
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-[#D6DDEC]">
                Si estás pasando por un momento difícil, no esperes: agenda una cita. En una emergencia llama a la línea 123.
              </p>
            </div>
            <Link to="/login" className="bg-gold text-primary font-bold text-base px-7 min-h-[52px] rounded-full inline-flex items-center">
              Ingresar con Google
            </Link>
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-7 flex justify-between gap-4 flex-wrap text-sm text-ink-500">
          <span>© {new Date().getFullYear()} Corporación Universitaria Autónoma del Cauca · Bienestar Universitario</span>
          <span>Conecta BU</span>
        </div>
      </footer>
    </div>
  );
}
