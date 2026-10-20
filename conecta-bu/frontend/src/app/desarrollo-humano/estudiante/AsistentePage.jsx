import { Icono } from "../comunes/componentes/Iconos";
import { AsistenteConversacion } from "../../../components/AsistenteConversacion";

// RF-014: pantalla completa del asistente. El boton flotante usa la misma
// conversacion. Las respuestas vienen del backend, que aplica RN-011 antes
// de consultar a Gemini o a n8n.
export function AsistentePage() {
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
      <AsistenteConversacion />
    </main>
  );
}
