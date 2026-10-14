import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icono } from "./Iconos";
import { http } from "../lib/api/http";
import { useAuth } from "../lib/auth/AuthContext";

const PREGUNTAS_SUGERIDAS = [
  "¿Qué servicios ofrece Bienestar?",
  "¿Cómo agendo una cita?",
  "¿Qué eventos hay próximamente?",
  "¿Cómo cancelo una cita?",
];

function burbuja(mensaje) {
  if (mensaje.autor === "estudiante") return "bg-primary text-white rounded-br-md";
  if (mensaje.seguridad) return "bg-amber-50 text-ink-900 border border-amber-200 rounded-bl-md";
  if (mensaje.error) return "bg-red-50 text-red-700 rounded-bl-md";
  return "bg-gray-100 text-ink-900 rounded-bl-md";
}

// Conversación del asistente. El historial vive solo en pantalla.
export function AsistenteConversacion({ compacto = false, alNavegar }) {
  const { usuario } = useAuth();
  const primerNombre = usuario?.nombre?.split(" ")[0];
  const [mensajes, setMensajes] = useState([
    {
      autor: "asistente",
      texto: `¡Hola${primerNombre ? `, ${primerNombre}` : ""}! Soy el asistente de Conecta BU. Puedo orientarte sobre los servicios de Bienestar, cómo agendar o cancelar citas y los próximos eventos.`,
    },
  ]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, enviando]);

  async function enviar(texto) {
    const contenido = texto.trim();
    if (!contenido || enviando) return;
    setMensajes((m) => [...m, { autor: "estudiante", texto: contenido }]);
    setPregunta("");
    setEnviando(true);
    try {
      const res = await http.post("/asistente/consultas", { pregunta: contenido });
      setMensajes((m) => [
        ...m,
        {
          autor: "asistente",
          texto: res.data.respuesta,
          sugerencias: res.data.sugerencias,
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
    <div className={compacto ? "flex flex-col min-h-0 h-full" : "flex flex-col flex-1 min-h-0"}>
      {!compacto && (
        <p className="m-0 mb-4 flex items-center gap-2.5 text-sm font-semibold text-[#5C4206] bg-gold-light border border-[#F3E2B5] rounded-xl px-4 py-3">
          <Icono nombre="telefono" size={18} strokeWidth={2} className="shrink-0" />
          <span>
            Si estás en peligro, llama a la línea de emergencias{" "}
            <a href="tel:123" className="underline underline-offset-4">
              123
            </a>
            .
          </span>
        </p>
      )}

      <div className={`flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 ${compacto ? "" : "bg-white rounded-2xl border border-gray-200 p-4 sm:p-6"}`}>
        {mensajes.map((mensaje, i) => (
          <div key={i} className={`flex ${mensaje.autor === "estudiante" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line ${burbuja(mensaje)}`}>
              {mensaje.texto}
              {mensaje.sugerencias?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {mensaje.sugerencias.map((s) => (
                    <Link
                      key={s.ruta}
                      to={s.ruta}
                      onClick={alNavegar}
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
        <div className="flex flex-wrap gap-2 mt-3">
          {PREGUNTAS_SUGERIDAS.map((texto) => (
            <button
              key={texto}
              type="button"
              onClick={() => enviar(texto)}
              className="text-left text-sm border border-gray-200 bg-white rounded-full px-3.5 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors"
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
        className="flex gap-2 mt-3"
      >
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={500}
          placeholder="Escribe tu pregunta…"
          aria-label="Pregunta para el asistente"
          className="flex-1 min-w-0 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-ink-900 bg-white"
        />
        <button
          type="submit"
          disabled={enviando || !pregunta.trim()}
          className="text-sm font-semibold bg-primary text-white rounded-full px-4 py-2.5 hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
