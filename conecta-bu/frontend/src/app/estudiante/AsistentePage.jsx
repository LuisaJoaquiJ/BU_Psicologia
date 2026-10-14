import { AsistenteConversacion } from "../../components/AsistenteConversacion";

// RF-014: pantalla completa del asistente. El botón flotante usa la misma
// conversación. Las respuestas vienen del backend, que aplica RN-011 antes
// de consultar a Gemini.
export function AsistentePage() {
  return (
    <main className="max-w-3xl mx-auto p-6 lg:p-10 flex flex-col" style={{ minHeight: "calc(100vh - 72px)" }}>
      <h1 className="m-0 text-3xl sm:text-[34px] font-extrabold">Asistente de orientación</h1>
      <p className="mt-1.5 mb-4 text-ink-500">
        Información general sobre Bienestar y el uso de Conecta BU. No reemplaza la atención de un profesional ni
        realiza diagnósticos.
      </p>
      <div className="flex-1 min-h-0 flex flex-col">
        <AsistenteConversacion />
      </div>
    </main>
  );
}
