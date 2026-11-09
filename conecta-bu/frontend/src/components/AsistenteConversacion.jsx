import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icono } from "./Iconos";
import { http } from "../lib/api/http";
import { useAuth } from "../lib/auth/AuthContext";

const ACCIONES = [
  { titulo: "Agendar una cita", detalle: "Te muestro horarios libres", texto: "Quiero agendar una cita" },
  { titulo: "Próximos eventos", detalle: "Talleres y actividades del campus", texto: "¿Qué eventos hay próximamente?" },
  { titulo: "Servicios de Bienestar", detalle: "Qué puedes hacer en Conecta BU", texto: "¿Qué servicios ofrece Bienestar?" },
];

const ACCIONES_POR_MODULO = {
  cultura: [
    { titulo: "Grupos y talleres", detalle: "Qué hay y cómo entrar", texto: "¿Qué grupos de cultura hay?" },
    { titulo: "Convocatorias", detalle: "Audiciones abiertas", texto: "¿Qué convocatorias hay abiertas?" },
    { titulo: "Agenda cultural", detalle: "Próximos eventos", texto: "¿Qué eventos culturales hay?" },
  ],
  deporte: [
    { titulo: "Grupos de deporte", detalle: "Horarios y cupos", texto: "¿Qué grupos de deporte hay?" },
    { titulo: "Mis horas", detalle: "Cuántas llevo y cuántas faltan", texto: "¿Cuántas horas de deporte llevo?" },
    { titulo: "Eventos deportivos", detalle: "Torneos y encuentros", texto: "¿Qué eventos deportivos hay?" },
  ],
  salud: [
    { titulo: "Jornadas de salud", detalle: "Campañas y jornadas", texto: "¿Hay jornadas de salud?" },
    { titulo: "Salidas", detalle: "Publicadas por la Unidad de Salud", texto: "¿Qué salidas hay publicadas?" },
    { titulo: "Agendar una cita", detalle: "Orientación psicológica", texto: "Quiero agendar una cita" },
  ],
};

const PREGUNTAS_POR_MODULO = {
  cultura: ["¿Qué grupos de cultura hay?", "¿Qué convocatorias hay abiertas?", "¿Qué eventos culturales hay?"],
  deporte: ["¿Qué grupos de deporte hay?", "¿Cuántas horas de deporte llevo?", "¿Qué eventos deportivos hay?"],
  salud: ["¿Hay jornadas de salud?", "¿Qué salidas hay publicadas?", "¿Cómo me inscribo a una salida?"],
  orientacion: ["¿Qué grupos de cultura hay?", "¿Cuántas horas de deporte llevo?", "¿Hay jornadas de salud?"],
};

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
  const [mensajes, setMensajes] = useState([
    {
      autor: "asistente",
      texto: `¡Hola${primerNombre ? `, ${primerNombre}` : ""}! Soy el asistente de Conecta BU. Puedo orientarte sobre los servicios de Bienestar y los próximos eventos, y agendarte una cita: dime qué día y a qué hora te queda bien.`,
    },
  ]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

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
      const res = await http.post("/asistente/consultas", { pregunta: contenido, historial, modulo });
      setMensajes((m) => [
        ...m,
        {
          autor: "asistente",
          texto: res.data.respuesta,
          sugerencias: res.data.sugerencias,
          opciones: res.data.opciones,
          seguridad: res.data.origen === "seguridad",
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
          <div className="flex flex-col items-center text-center pt-2">
            <span className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-md" style={{ background: "linear-gradient(135deg, var(--liquido-1, #3d6288), var(--liquido-3, #162c49))" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4M22 5h-4M4 17v2M5 18H3" /></svg>
            </span>
            <p className="mt-3 mb-0 text-lg font-black text-[#1E3A5F]">Hola{primerNombre ? `, ${primerNombre}` : ""}, soy el asistente de Conecta BU</p>
            <p className="mt-1 mb-0 text-sm max-w-[280px] text-[#6B7A8D]">Te oriento sobre Orientación, Deporte, Salud y Cultura, y te agendo una cita.</p>
            <div className="mt-5 w-full grid gap-2 text-left">
              {acciones.map((accion) => (
                <button key={accion.titulo} type="button" onClick={() => enviar(accion.texto)} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left border border-[#1E3A5F]/10 hover:shadow-md">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-primary bg-primary-light">
                    <Icono nombre="calendario" size={18} strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold leading-tight text-[#1E3A5F]">{accion.titulo}</span>
                    <span className="block text-[11.5px] mt-0.5 text-[#6B7A8D]">{accion.detalle}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-4 mb-2 text-xs font-semibold text-[#6B7A8D]">O pregúntale a la IA</p>
          </div>
        )}
        {(!compacto || !inicio) && mensajes.map((mensaje, i) => (
          <div key={i} className={`flex ${mensaje.autor === "estudiante" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                mensaje.autor === "estudiante"
                  ? "boton-liquido rounded-br-md"
                  : mensaje.seguridad
                    ? "bg-amber-50 text-ink-900 border border-amber-200 rounded-bl-md"
                    : mensaje.exito
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-bl-md"
                    : mensaje.error
                      ? "bg-red-50 text-red-700 rounded-bl-md"
                      : "bg-white text-[#2C3E50] border border-[#1E3A5F]/10 rounded-bl-md"
              }`}
            >
              {mensaje.texto}
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
              {mensaje.sugerencias?.length > 0 && (
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
        {inicio && (
          <div className="grid gap-2">
            {preguntasSugeridas.map((texto) => (
              <button
                key={texto}
                type="button"
                onClick={() => enviar(texto)}
                className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left text-[13px] font-medium border border-[#1E3A5F]/10 text-[#2C3E50] hover:shadow-md"
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-primary bg-primary-light">?</span>
                {texto}
              </button>
            ))}
          </div>
        )}
        <div ref={finRef} />
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
            placeholder="Escribe tu pregunta…"
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
