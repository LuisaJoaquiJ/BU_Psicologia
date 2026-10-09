import { Link } from "react-router-dom";

// Marca de Conecta BU. "invertido" = versión para fondos azules.
export function Logo({ to = "/", subtitulo = "Bienestar Universitario", invertido = false }) {
  return (
    <Link to={to} className="flex items-center gap-3 no-underline">
      <span
        className={`w-11 h-11 rounded-xl flex items-center justify-center font-display font-semibold text-lg shrink-0 ${
          invertido ? "bg-gold text-primary" : "bg-primary text-gold"
        }`}
      >
        UA
      </span>
      <span className="flex flex-col leading-tight">
        <span className={`font-bold text-base ${invertido ? "text-white" : "text-primary"}`}>Conecta BU</span>
        {subtitulo && (
          <span className={`text-xs ${invertido ? "text-white/75" : "text-ink-500"}`}>{subtitulo}</span>
        )}
      </span>
    </Link>
  );
}
