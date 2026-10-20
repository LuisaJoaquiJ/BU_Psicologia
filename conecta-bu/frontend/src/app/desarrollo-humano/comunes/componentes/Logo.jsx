import { Link } from "react-router-dom";

// Marca: logo oficial de la Uniautónoma del Cauca + "Conecta BU".
// "invertido" = sobre fondos azules: el logo va en una placa blanca para que
// conserve sus colores. "compacto" oculta el subtítulo (celular).
export function Logo({ to = "/", titulo = "Conecta BU", subtitulo = "Bienestar Institucional", invertido = false, alto = 52 }) {
  return (
    <Link to={to} className="flex items-center gap-3 no-underline min-w-0">
      <span className={`shrink-0 flex ${invertido ? "bg-white rounded-[10px] px-2 py-1" : ""}`}>
        <img
          src="/img/logo-uniautonoma-marca.png"
          alt="Uniautónoma del Cauca"
          style={{ height: invertido ? alto - 8 : alto, width: "auto" }}
        />
      </span>
      <span className="flex flex-col leading-tight min-w-0">
        <span className={`font-extrabold text-lg tracking-tight ${invertido ? "text-white" : "text-primary-dark"}`}>{titulo}</span>
        {subtitulo && <span className={`text-[13px] ${invertido ? "text-[#B9C7DE]" : "text-ink-500"}`}>{subtitulo}</span>}
      </span>
    </Link>
  );
}
