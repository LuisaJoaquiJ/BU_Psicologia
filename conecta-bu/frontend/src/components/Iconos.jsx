// Iconos de trazo (24x24) usados en el rediseño. Heredan el color del texto.
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const TRAZOS = {
  calendario: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  estrella: <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />,
  escudo: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  corazon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  usuarios: <><circle cx="9" cy="8" r="4" /><path d="M2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9" /></>,
  grafica: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  tablero: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>,
  izquierda: <path d="M15 18l-6-6 6-6" />,
  derecha: <path d="M9 18l6-6-6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  descarga: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  alerta: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
};

export function Icono({ nombre, size = 22, strokeWidth, className = "" }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={strokeWidth ?? base.strokeWidth} className={className}>
      {TRAZOS[nombre]}
    </svg>
  );
}
