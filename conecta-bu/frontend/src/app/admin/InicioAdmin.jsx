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
  {
    titulo: "Usuarios",
    desc: "Consulta usuarios, cambia su rol y habilita o deshabilita su acceso.",
    to: "/admin/usuarios",
    icon: "👤",
    tint: "bg-violet-50",
  },
  {
    titulo: "Estadísticas",
    desc: "Participación e asistencia a citas y eventos, y estado de n8n.",
    to: "/admin/estadisticas",
    icon: "📊",
    tint: "bg-rose-50",
  },
];

// Inicio del panel Administrador: horarios y agenda (Sprint 3), eventos
// (Sprint 4), usuarios y estadísticas (Sprint 5).
export function InicioAdmin() {
  const { usuario } = useAuth();

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">Panel administrativo</h1>
      <p className="text-gray-500 mb-8">
        Hola, {usuario?.nombre} — gestiona horarios, citas, eventos y usuarios del área.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
    </main>
  );
}
