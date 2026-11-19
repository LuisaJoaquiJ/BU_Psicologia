import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icono } from "./Iconos";
import { http } from "../lib/api/http";
import { useAuth } from "../lib/auth/AuthContext";
import { AsistenteTexto } from "./AsistenteTexto";
import { AsistenteInicio, NotaPrivacidad, SugerenciasChips } from "./AsistenteInicio";

// El aviso de privacidad lo agrega el backend al final de la primera respuesta.
const CORREO_PSICOLOGIA = "psicologoinstitucional@uniautonoma.edu.co";
const LINEA_POR_DEFECTO = "123";

// Saludo del encabezado: cambia segun la hora (Bogota usa la hora del equipo)
// y tiene varias variantes para que no se sienta estatico.
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
function saludoPorHora() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "Buenos días" : h < 19 && h >= 12 ? "Buenas tardes" : "Buenas noches";
}
function crearSaludo(nombre) {
  const quien = nombre ? `, ${nombre}` : "";
  return {
    titulo: elegir([`${saludoPorHora()}${quien}`, `${saludoPorHora()}${quien}, ¿cómo va tu día?`, `¡Qué bueno verte${quien}!`]),
    detalle: elegir([
      "Te ayudo con Orientación, Deporte, Salud y Cultura, y te agendo una cita en un minuto.",
      "Cuéntame cómo estás o qué necesitas: citas, eventos, horas de deporte y más.",
      "Resolvamos juntos tus trámites de Bienestar: pregúntame lo que quieras.",
    ]),
    mensaje: elegir([
      `¡${saludoPorHora()}${quien}! Soy el asistente virtual de Bienestar Universitario. Cuéntame cómo te sientes o qué necesitas: puedo agendarte una cita, mostrarte eventos y talleres, o contarte de Salud, Deporte y Arte y Cultura.`,
      `¡Hola${quien}! Qué bueno tenerte por aquí. ¿Te ayudo a agendar una cita, encontrar un taller o revisar tus horas de deporte? Escríbeme con tus palabras.`,
      `¡${saludoPorHora()}${quien}! Estoy aquí para hacerte la vida en la U más fácil: citas de Orientación, eventos, Salud, Deporte y Cultura. ¿Por dónde empezamos?`,
    ]),
  };
}
const telDe = (linea) => `tel:${String(linea || LINEA_POR_DEFECTO).replace(/[^\d+]/g, "")}`;

// Acciones principales del estado inicial (chips). Mandan los mismos mensajes
// que las tarjetas anteriores; «chip» es el texto corto y «icono» su dibujo.
const AREAS = {
  deporte: { titulo: "Deporte", chip: "Deporte", icono: "balon", detalle: "Grupos, horarios y cupos", texto: "¿Qué grupos de deporte hay?" },
  cultura: { titulo: "Cultura", chip: "Cultura", icono: "musica", detalle: "Talleres y grupos", texto: "¿Qué grupos de cultura hay?" },
  salud: { titulo: "Salud", chip: "Salud", icono: "estetoscopio", detalle: "Jornadas y campañas", texto: "¿Hay jornadas de salud?" },
};
const AGENDAR = { titulo: "Agendar una cita", chip: "Agendar cita", icono: "calendario", detalle: "Te muestro horarios libres", texto: "Quiero agendar una cita" };

const ACCIONES = [
  AGENDAR,
  { titulo: "Próximos eventos", chip: "Eventos", icono: "estrella", detalle: "Talleres y actividades del campus", texto: "¿Qué eventos hay próximamente?" },
  { titulo: "Servicios de Bienestar", chip: "Servicios", icono: "corazon", detalle: "Qué puedes hacer en Conecta BU", texto: "¿Qué servicios ofrece Bienestar?" },
  AREAS.deporte,
  AREAS.cultura,
  AREAS.salud,
];

const ACCIONES_POR_MODULO = {
  cultura: [
    { titulo: "Grupos y talleres", chip: "Grupos y talleres", icono: "musica", detalle: "Qué hay y cómo entrar", texto: "¿Qué grupos de cultura hay?" },
    { titulo: "Convocatorias", chip: "Convocatorias", icono: "estrella", detalle: "Audiciones abiertas", texto: "¿Qué convocatorias hay abiertas?" },
    { titulo: "Agenda cultural", chip: "Agenda cultural", icono: "calendario", detalle: "Próximos eventos", texto: "¿Qué eventos culturales hay?" },
    { ...AGENDAR, icono: "corazon", chip: "Cita de orientación" },
    AREAS.deporte,
    AREAS.salud,
  ],
  deporte: [
    { titulo: "Grupos de deporte", chip: "Grupos", icono: "balon", detalle: "Horarios y cupos", texto: "¿Qué grupos de deporte hay?" },
    { titulo: "Mis horas", chip: "Mis horas", icono: "reloj", detalle: "Cuántas llevo y cuántas faltan", texto: "¿Cuántas horas de deporte llevo?" },
    { titulo: "Eventos deportivos", chip: "Torneos y eventos", icono: "trofeo", detalle: "Torneos y encuentros", texto: "¿Qué eventos deportivos hay?" },
    { ...AGENDAR, icono: "corazon", chip: "Cita de orientación" },
    AREAS.cultura,
    AREAS.salud,
  ],
  salud: [
    { titulo: "Jornadas de salud", chip: "Jornadas", icono: "estetoscopio", detalle: "Campañas y jornadas", texto: "¿Hay jornadas de salud?" },
    { titulo: "Salidas", chip: "Salidas", icono: "bus", detalle: "Publicadas por la Unidad de Salud", texto: "¿Qué salidas hay publicadas?" },
    { titulo: "Agendar una cita", chip: "Cita de orientación", icono: "calendario", detalle: "Orientación psicológica", texto: "Quiero agendar una cita" },
    { titulo: "Servicios de Bienestar", chip: "Servicios", icono: "corazon", detalle: "Qué puedes hacer en Conecta BU", texto: "¿Qué servicios ofrece Bienestar?" },
    AREAS.deporte,
    AREAS.cultura,
  ],
};

// Preguntas sugeridas: se muestran de a 3 y «Otras sugerencias» rota la tanda.
const PREGUNTAS_POR_MODULO = {
  cultura: ["¿Qué grupos de cultura hay?", "¿Qué convocatorias hay abiertas?", "¿Qué eventos culturales hay?", "¿Cómo entro a un grupo representativo?", "¿En qué talleres estoy inscrito?", "¿Cuántas horas de deporte llevo?"],
  deporte: ["¿Qué grupos de deporte hay?", "¿Cuántas horas de deporte llevo?", "¿Qué eventos deportivos hay?", "¿Cómo me inscribo a un grupo?", "¿Qué grupos de cultura hay?", "¿Hay jornadas de salud?"],
  salud: ["¿Hay jornadas de salud?", "¿Qué salidas hay publicadas?", "¿Cómo me inscribo a una salida?", "¿Cuándo es mi cita?", "¿Qué grupos de deporte hay?", "¿Qué grupos de cultura hay?"],
  orientacion: [
    "¿Qué grupos de cultura hay?",
    "¿Cuántas horas de deporte llevo?",
    "¿Hay jornadas de salud?",
    "¿Cuándo es mi cita?",
    "¿Cómo cancelo una cita?",
    "¿Qué convocatorias hay abiertas?",
    "¿Hay talleres virtuales?",
    "¿Qué salidas hay publicadas?",
    "¿Qué eventos deportivos hay?",
  ],
};

// Ejemplos que rotan en el placeholder del campo de texto.
const PLACEHOLDERS = [
  "Escribe tu pregunta…",
  "Ej.: quiero una cita el jueves a las 9",
  "Ej.: ¿qué talleres hay esta semana?",
  "Ej.: ¿cuántas horas de deporte llevo?",
  "Cuéntame cómo te sientes…",
];

// RF-014: conversacion del asistente de orientacion (la usan la pagina
// completa y el boton flotante). Tambien agenda: el backend ofrece
// horarios libres reales y la cita se crea cuando el estudiante elige uno. El historial vive solo en esta pantalla
// (no se guarda en la base de datos); se envian los ultimos mensajes para que
// el agente recuerde la conversacion. Las respuestas vienen del backend, que aplica los filtros
// de seguridad de RN-011 antes de consultar a n8n / IA.
// Respuestas para elegir uno de los horarios ofrecidos sin hacer clic:
// «la primera», «2», «sí» (cuando solo hay una opción)...
const ORDINALES = [
  /^(la |el )?(1|primer[oa]?|uno)\b/,
  /^(la |el )?(2|segund[oa]|dos)\b/,
  /^(la |el )?(3|tercer[oa]?|tres)\b/,
  /^(la |el )?(4|cuart[oa]|cuatro)\b/,
];
function opcionElegida(texto, opciones) {
  const t = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(quiero |dame |agenda(me)? )/, "").trim();
  const i = ORDINALES.findIndex((re) => re.test(t));
  if (i >= 0 && i < opciones.length) return opciones[i];
  if (opciones.length === 1 && /^(si|sii|dale|ok|okay|listo|confirmo|de una|claro|por favor|agendala|esa)\b/.test(t)) return opciones[0];
  return null;
}

// compacto: version para el panel del boton flotante. alNavegar: se llama al
// seguir una sugerencia (p. ej. para cerrar el panel).
export function AsistenteConversacion({ compacto = false, modulo = "orientacion", alNavegar }) {
  const acciones = ACCIONES_POR_MODULO[modulo] || ACCIONES;
  const preguntasSugeridas = PREGUNTAS_POR_MODULO[modulo] || PREGUNTAS_POR_MODULO.orientacion;
  const { usuario } = useAuth();
  const primerNombre = usuario?.nombre?.split(" ")[0];
  const [saludo] = useState(() => crearSaludo(primerNombre));
  const [mensajes, setMensajes] = useState([
    {
      autor: "asistente",
      texto: saludo.mensaje,
    },
  ]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);
  const [indicePlaceholder, setIndicePlaceholder] = useState(0);

  // Placeholder rotativo mientras el campo está vacío.
  useEffect(() => {
    if (pregunta) return undefined;
    const id = setInterval(() => setIndicePlaceholder((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, [pregunta]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  // Agenda la cita elegida con el mismo servicio que «Agendar cita»
  // (valida que el horario siga libre y que no haya otra cita activa).
  async function agendar(opcion, indiceMensaje) {
    if (enviando) return;
    setEnviando(true);
    setMensajes((m) => m.map((x, i) => (i === indiceMensaje ? { ...x, opcionesUsadas: true, elegida: opcion.horarioId } : x)));
    try {
      await http.post("/citas", { horarioId: opcion.horarioId });
      setMensajes((m) => [
        ...m.map((x, i) => (i === indiceMensaje ? { ...x, agendada: true } : x)),
        {
          autor: "asistente",
          exito: true,
          texto: `¡Listo! Tu cita de ${opcion.servicio} quedó agendada para el ${opcion.fecha} a las ${opcion.hora.replace(/\.$/, "")}. Te enviaremos un correo de confirmación. Puedes verla o cancelarla (hasta 24 horas antes) en «Mis citas».`,
          sugerencias: [{ texto: "Ver mis citas", ruta: "/estudiante/mis-citas" }],
        },
      ]);
    } catch (err) {
      setMensajes((m) => [
        ...m.map((x, i) => (i === indiceMensaje ? { ...x, opcionesUsadas: false, elegida: null } : x)),
        { autor: "asistente", error: true, texto: err.response?.data?.message || "No pude agendar la cita. Intenta de nuevo." },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  async function enviar(texto) {
    const contenido = texto.trim();
    if (!contenido || enviando) return;

    // ¿Está eligiendo uno de los horarios que le acaba de ofrecer el asistente?
    const indiceOfertas = mensajes.length - 1;
    const ultimo = mensajes[indiceOfertas];
    if (ultimo?.opciones?.length && !ultimo.opcionesUsadas) {
      const elegida = opcionElegida(contenido, ultimo.opciones);
      if (elegida) {
        setMensajes((m) => [...m, { autor: "estudiante", texto: contenido }]);
        setPregunta("");
        return agendar(elegida, indiceOfertas);
      }
    }

    setMensajes((m) => [...m, { autor: "estudiante", texto: contenido }]);
    setPregunta("");
    setEnviando(true);
    try {
      // Historial corto para que el agente entienda preguntas de seguimiento
      // ("¿y a qué hora?"). Sin el saludo inicial ni los mensajes de error.
      const historial = mensajes
        .slice(1)
        .filter((m) => !m.error)
        .slice(-12)
        .map((m) => ({ autor: m.autor, texto: m.texto }));
      // «primera»: todavia no hay respuestas reales del asistente (el backend
      // pone el aviso de privacidad solo en la primera).
      const primera = !historial.some((m) => m.autor === "asistente");
      const res = await http.post("/asistente/consultas", { pregunta: contenido, historial, modulo, primera });
      setMensajes((m) => [
        ...m,
        {
          autor: "asistente",
          texto: res.data.respuesta,
          sugerencias: res.data.sugerencias,
          opciones: res.data.opciones,
          seguridad: res.data.origen === "seguridad",
          crisis: Boolean(res.data.crisis),
          lineaApoyo: res.data.lineaApoyo || LINEA_POR_DEFECTO,
        },
      ]);
    } catch (err) {
      setMensajes((m) => [
        ...m,
        {
          autor: "asistente",
          texto: err.response?.data?.message || "No pude responder en este momento. Intenta de nuevo en un rato.",
          error: true,
        },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  const inicio = mensajes.length <= 1;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className={`flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto ${compacto ? "" : "bg-white rounded-2xl border border-gray-200 p-4 sm:p-6"}`}>
        {compacto && inicio && (
          <AsistenteInicio saludo={saludo} acciones={acciones} preguntas={preguntasSugeridas} onElegir={enviar} deshabilitado={enviando} />
        )}
        {(!compacto || !inicio) && mensajes.map((mensaje, i) => (
          <div key={i} className={`flex ${mensaje.autor === "estudiante" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                mensaje.autor === "estudiante"
                  ? "boton-liquido rounded-br-md whitespace-pre-line"
                  : mensaje.crisis
                    ? "bg-rose-50 text-[#4A1D2B] border border-rose-200 rounded-bl-md shadow-sm"
                  : mensaje.seguridad
                    ? "bg-amber-50 text-ink-900 border border-amber-200 rounded-bl-md"
                    : mensaje.exito
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-bl-md"
                    : mensaje.error
                      ? "bg-red-50 text-red-700 rounded-bl-md"
                      : "bg-white text-[#2C3E50] border border-[#1E3A5F]/10 rounded-bl-md"
              }`}
            >
              {mensaje.autor === "estudiante" ? (
                mensaje.texto
              ) : (
                <>
                  {mensaje.crisis && (
                    <p className="m-0 mb-2 flex items-center gap-2 font-black text-rose-800">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.4C.6 8.4 2.4 4.5 6.2 4.1c2.1-.2 3.9.9 5.8 3 1.9-2.1 3.7-3.2 5.8-3 3.8.4 5.6 4.3 4.2 7.5C19.5 16.4 12 21 12 21z" /></svg>
                      Estamos contigo
                    </p>
                  )}
                  <AsistenteTexto texto={mensaje.texto} crisis={mensaje.crisis} linea={mensaje.lineaApoyo} />
                  {mensaje.crisis && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <a href={telDe(mensaje.lineaApoyo)} className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full bg-rose-700 text-white text-[13px] font-bold no-underline hover:bg-rose-800">
                        <Icono nombre="telefono" size={15} strokeWidth={2.2} />
                        Llamar a la línea {mensaje.lineaApoyo}
                      </a>
                      <a href={`mailto:${CORREO_PSICOLOGIA}`} className="inline-flex items-center min-h-[40px] px-4 rounded-full bg-white border border-rose-200 text-rose-800 text-[13px] font-bold no-underline hover:bg-rose-100">
                        Escribir a Psicología
                      </a>
                    </div>
                  )}
                </>
              )}
              {mensaje.opciones?.length > 0 && (
                <ul className="list-none m-0 mt-3 p-0 flex flex-col gap-2 whitespace-normal" aria-label="Horarios disponibles">
                  {mensaje.opciones.map((o, j) => {
                    const elegida = mensaje.elegida === o.horarioId;
                    return (
                      <li
                        key={o.horarioId}
                        className={`flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border px-3.5 py-2.5 ${
                          elegida ? "border-primary" : "border-gray-200"
                        }`}
                      >
                        <span className="flex flex-col">
                          <span className="font-bold text-ink-900 first-letter:uppercase">
                            {mensaje.opciones.length > 1 && <span className="text-ink-500 font-semibold">{j + 1}. </span>}
                            {o.fecha} · {o.hora}
                          </span>
                          <span className="text-[13px] text-ink-500">{o.servicio}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => agendar(o, i)}
                          disabled={enviando || mensaje.opcionesUsadas}
                          className="inline-flex items-center gap-1.5 min-h-[40px] text-[13px] font-bold boton-liquido rounded-full px-4 disabled:opacity-50"
                        >
                          <Icono nombre="calendario" size={16} strokeWidth={2} />
                          {elegida ? (mensaje.agendada ? "Agendada" : "Agendando…") : "Agendar"}
                        </button>
                      </li>
                    );
                  })}
                  {mensaje.opciones.length > 1 && !mensaje.opcionesUsadas && (
                    <li className="text-[12px] text-ink-500">También puedes escribir «la primera», «la segunda»… o pedirme otro día u hora.</li>
                  )}
                </ul>
              )}
              {!mensaje.crisis && mensaje.sugerencias?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {mensaje.sugerencias.map((s) => (
                    <Link
                      key={s.ruta}
                      to={s.ruta}
                      onClick={() => alNavegar?.()}
                      className="inline-flex items-center min-h-[40px] text-[13px] font-bold burbuja text-primary rounded-full px-3.5 hover:bg-white"
                    >
                      {s.texto}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {enviando && (
          <div className="flex justify-start">
            <div className="bg-white text-[#6B7A8D] border border-[#1E3A5F]/10 rounded-2xl rounded-bl-md px-4 py-3 text-sm">Escribiendo…</div>
          </div>
        )}
        {inicio && !compacto && (
          <div className="grid gap-3">
            <SugerenciasChips preguntas={preguntasSugeridas} onElegir={enviar} deshabilitado={enviando} />
            <NotaPrivacidad />
          </div>
        )}
        {/* En el estado inicial del panel no hace falta el ancla (ni su espacio). */}
        {!(compacto && inicio) && <div ref={finRef} />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
        className="mt-2 shrink-0"
      >
        <div className="flex items-end gap-2 rounded-[22px] bg-white pl-4 pr-1.5 py-1.5 border border-[#1E3A5F]/10 focus-within:shadow-[0_0_0_3px_rgb(var(--primario)/0.2)]">
          <input
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            maxLength={500}
            placeholder={PLACEHOLDERS[indicePlaceholder]}
            aria-label="Mensaje para el asistente"
            className="flex-1 bg-transparent py-2 text-[14px] text-[#2C3E50] outline-none placeholder:text-[#9aa6b4]"
          />
          <button
            type="submit"
            disabled={enviando || !pregunta.trim()}
            aria-label="Enviar"
            className="boton-liquido h-9 w-9 mb-0.5 rounded-full flex items-center justify-center disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
          </button>
        </div>
        <p className="mt-2 mb-0 text-center text-[10.5px] text-[#6B7A8D]">Respuestas generadas con IA · verifica la información importante</p>
      </form>
    </div>
  );
}
