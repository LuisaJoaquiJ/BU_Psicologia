import { Icono } from "../comunes/componentes/Iconos";
import { AsistenteConversacion } from "../../../components/AsistenteConversacion";

// RF-014: pantalla completa del asistente. El boton flotante usa la misma
// conversacion. Las respuestas vienen del backend, que aplica RN-011 antes
// de consultar a Gemini o a n8n.
export function AsistentePage() {
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10 pb-16 flex flex-col [&>*]:max-w-3xl" style={{ minHeight: "calc(100vh - 72px)" }}>
      <h1 className="m-0 font-sans text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.035em] font-extrabold text-primary-dark">Asistente de orientación</h1>
      <p className="mt-1.5 mb-4 text-ink-500">
        Información general sobre Bienestar y el uso de Conecta BU. No reemplaza la atención de un profesional ni realiza diagnósticos.
      </p>
      <div className="m-0 mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[#5C4206] bg-gold-light border border-[#F3E2B5] rounded-xl px-4 py-3">
        <span>Si estás en peligro, llama a la línea de emergencias 123.</span>
        <a href="tel:123" className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-[#5C4206] text-white font-extrabold text-sm no-underline hover:bg-[#46320A] transition-colors">
          <Icono nombre="telefono" size={16} strokeWidth={2.2} />
          Llamar al 123
        </a>
      </div>
      <AsistenteConversacion />
    </main>
  );
}
