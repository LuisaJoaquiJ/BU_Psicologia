import { Icono } from "../comunes/componentes/Iconos";
import { AsistenteConversacion } from "../../../components/AsistenteConversacion";

// RF-014: pantalla completa del asistente. El botón flotante usa la misma
// conversación. Las respuestas vienen del backend, que aplica RN-011 antes
// de consultar a Gemini o a n8n.
export function AsistentePage() {
  return (
    <main
      className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-8 flex flex-col"
      style={{ minHeight: "calc(100vh - 72px)" }}
    >
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col gap-5">
        {/* Encabezado con estado del asistente */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-dark/5 text-primary-dark text-xs font-bold tracking-wide uppercase mb-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              Orientación virtual · Conecta BU
            </div>
            <h1 className="m-0 font-sans text-[28px] sm:text-[36px] leading-[1.1] tracking-[-0.035em] font-extrabold text-primary-dark">
              Asistente de orientación
            </h1>
            <p className="mt-1.5 mb-0 text-sm sm:text-base text-ink-500 max-w-2xl">
              Resuelve dudas sobre servicios de Bienestar Universitario y el uso de la plataforma.
            </p>
          </div>
        </header>

        {/* Banner de emergencia compacto y accesible */}
        <div
          role="region"
          aria-label="Línea de atención de emergencias"
          className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5C4206] bg-gold-light/90 border border-[#F3E2B5] rounded-2xl px-4 py-3 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 font-semibold">
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[#5C4206]/10 text-[#5C4206] shrink-0"
              aria-hidden="true"
            >
              <Icono nombre="telefono" size={16} strokeWidth={2.2} />
            </span>
            <span>¿Estás en una situación de riesgo o crisis? Comunícate de inmediato con la línea 123.</span>
          </div>

          <a
            href="tel:123"
            className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full bg-[#5C4206] text-white font-bold text-xs sm:text-sm no-underline hover:bg-[#46320A] active:scale-[0.99] transition-all shrink-0"
          >
            <Icono nombre="telefono" size={15} strokeWidth={2.2} />
            Llamar al 123
          </a>
        </div>

        {/* Contenedor principal de la conversación */}
        <section
          aria-label="Conversación con el asistente"
          className="flex-1 flex flex-col min-h-[460px] bg-white border border-black/10 rounded-2xl shadow-sm overflow-hidden"
        >
          <AsistenteConversacion />
        </section>

        {/* Aviso legal / alcance clínico al pie para no saturar la cabecera */}
        <p className="m-0 text-center text-xs text-ink-500 leading-relaxed px-2">
          Este asistente brinda orientación informativa automatizada; no constituye atención médica ni psicológica ni reemplaza la valoración de un profesional.
        </p>
      </div>
    </main>
  );
}