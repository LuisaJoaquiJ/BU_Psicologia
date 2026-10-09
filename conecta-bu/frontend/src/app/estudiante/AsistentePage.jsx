import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../lib/api/http";
import { useAuth } from "../../lib/auth/AuthContext";

const PREGUNTAS_SUGERIDAS = [
  "¿Qué servicios ofrece Bienestar?",
  "¿Cómo agendo una cita?",
  "¿Qué eventos hay próximamente?",
  "¿Cómo cancelo una cita?",
];

// RF-014: asistente de orientacion. El historial vive solo en esta pantalla
// (no se guarda). Las respuestas vienen del backend, que aplica los filtros
// de seguridad de RN-011 antes de consultar a n8n / IA.
export function AsistentePage() {
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
    <main className="max-w-3xl mx-auto p-6 lg:p-10 flex flex-col" style={{ minHeight: "calc(100vh - 72px)" }}>
      <h1 className="text-3xl font-semibold text-primary mb-1">Asistente de orientación</h1>
      <p className="text-sm text-gray-500 mb-6">
        Información general sobre Bienestar y el uso de Conecta BU. No reemplaza la atención de un profesional ni
        realiza diagnósticos. Si estás en peligro, llama a la línea de emergencias 123.
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
                  : mensaje.error
                  ? "bg-red-50 text-red-700 rounded-bl-md"
                  : "bg-gray-100 text-ink-900 rounded-bl-md"
              }`}
            >
              {mensaje.texto}
              {mensaje.sugerencias?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {mensaje.sugerencias.map((s) => (
                    <Link
                      key={s.ruta}
                      to={s.ruta}
                      className="text-xs font-medium bg-white text-primary border border-primary/30 rounded-full px-3 py-1 hover:bg-primary-light transition-colors"
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
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-md px-4 py-3 text-sm">Escribiendo…</div>
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
