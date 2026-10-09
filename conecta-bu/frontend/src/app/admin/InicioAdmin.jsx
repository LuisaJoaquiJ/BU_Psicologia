import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";

const ITEMS = [
  {
    titulo: "Gestión de horarios",
    desc: "Publica, modifica y deshabilita horarios de atención.",
    to: "/admin/horarios",
    icon: "⏰",
    tint: "bg-amber-50",
  },
  {
    titulo: "Agenda y asistencia a citas",
    desc: "Consulta la agenda del día y registra la asistencia.",
    to: "/admin/citas",
    icon: "🗒️",
    tint: "bg-sky-50",
  },
  {
    titulo: "Gestión de eventos",
    desc: "Crea y publica eventos, y registra la asistencia de los inscritos.",
    to: "/admin/eventos",
    icon: "🎉",
    tint: "bg-emerald-50",
  },
];

const PROXIMAMENTE = [
  { titulo: "Usuarios y dashboard", nota: "RF-012 / RF-015 · Sprint 5", icon: "👤", tint: "bg-violet-50" },
];

// Inicio del panel Administrador. Horarios y Agenda/asistencia (Sprint 3) y
// Eventos (Sprint 4) ya llevan a funcionalidades reales; el resto queda
// marcado como "Próximamente" hasta sus sprints correspondientes.
export function InicioAdmin() {
  const { usuario } = useAuth();

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">Panel administrativo</h1>
      <p className="text-gray-500 mb-8">
        Hola, {usuario?.nombre} — gestiona horarios, citas, eventos y usuarios del área.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
        {ITEMS.map(({ titulo, desc, to, icon, tint }) => (
          <Link
            key={titulo}
            to={to}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className={`w-11 h-11 rounded-xl ${tint} flex items-center justify-center text-xl mb-4`}>
              {icon}
            </div>
            <h2 className="font-semibold text-ink-900">{titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {PROXIMAMENTE.map(({ titulo, nota, icon, tint }) => (
          <div key={titulo} className="bg-white rounded-2xl border border-gray-200 p-6 opacity-70">
            <div className={`w-11 h-11 rounded-xl ${tint} flex items-center justify-center text-xl mb-4`}>
              {icon}
            </div>
            <h2 className="font-semibold text-ink-900">{titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">Próximamente</p>
            <p className="text-xs text-gray-400 mt-2">{nota}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
