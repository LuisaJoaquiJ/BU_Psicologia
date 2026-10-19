import { useEffect, useRef, useState } from "react";
import { Icono } from "../comunes/componentes/Iconos";
import { Link } from "react-router-dom";
import { http } from "../../../lib/api/http";
import { useAuth } from "../../../lib/auth/AuthContext";

const PREGUNTAS_SUGERIDAS = ["¿Qué servicios ofrece Bienestar?", "Quiero agendar una cita", "¿Qué eventos hay próximamente?", "¿Cómo cancelo una cita?"];

// RF-014: asistente de orientacion. Tambien agenda: el backend ofrece
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

export function AsistentePage() {
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
      const res = await http.post("/asistente/consultas", { pregunta: contenido, historial });
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

  return (
    <main className="max-w-3xl mx-auto p-6 lg:p-10 flex flex-col" style={{ minHeight: "calc(100vh - 72px)" }}>
      <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">Asistente de orientación</h1>
      <p className="mt-1.5 mb-4 text-ink-500">
        Información general sobre Bienestar y el uso de Conecta BU. No reemplaza la atención de un profesional ni realiza diagnósticos.
      </p>
      <p className="m-0 mb-5 flex items-center gap-2.5 text-sm font-semibold text-[#5C4206] bg-gold-light border border-[#F3E2B5] rounded-xl px-4 py-3">
        <Icono nombre="telefono" size={18} strokeWidth={2} className="shrink-0" />
        <span>
          Si estás en peligro, llama a la línea de emergencias{" "}
          <a href="tel:123" className="underline underline-offset-4">
            123
          </a>
          .
        </span>
      </p>

      <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto">
        {mensajes.map((mensaje, i) => (
          <div key={i} className={`flex ${mensaje.autor === "estudiante" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${
                mensaje.autor === "estudiante"
                  ? "bg-primary text-white rounded-br-md"
                  : mensaje.seguridad
                    ? "bg-amber-50 text-ink-900 border border-amber-200 rounded-bl-md"
                    : mensaje.exito
                      ? "bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-bl-md"
                    : mensaje.error
                      ? "bg-red-50 text-red-700 rounded-bl-md"
                      : "bg-gray-100 text-ink-900 rounded-bl-md"
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
                          className="inline-flex items-center gap-1.5 min-h-[40px] text-[13px] font-bold bg-primary text-white rounded-full px-4 hover:bg-primary-dark transition-colors disabled:opacity-50"
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
                      className="inline-flex items-center min-h-[40px] text-[13px] font-bold bg-white text-primary border border-primary/30 rounded-full px-3.5 hover:bg-primary-light transition-colors"
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
            <div className="bg-gray-100 text-ink-500 rounded-2xl rounded-bl-md px-4 py-3 text-sm">Escribiendo…</div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {mensajes.length <= 1 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {PREGUNTAS_SUGERIDAS.map((texto) => (
            <button
              key={texto}
              onClick={() => enviar(texto)}
              className="text-sm border border-gray-200 bg-white rounded-full px-4 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
        className="flex gap-2 mt-4"
      >
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={500}
          placeholder="Escribe tu pregunta…"
          aria-label="Pregunta para el asistente"
          className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-ink-900 bg-white"
        />
        <button
          type="submit"
          disabled={enviando || !pregunta.trim()}
          className="text-sm font-semibold bg-primary text-white rounded-full px-5 py-2.5 hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
