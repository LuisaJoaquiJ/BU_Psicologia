import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth/AuthContext";

const ITEMS = [
  {
    titulo: "Servicios de Desarrollo Humano",
    desc: "Consulta los servicios de orientación disponibles.",
    to: "/estudiante/servicios",
    icon: "🩺",
    tint: "bg-sky-50",
  },
  {
    titulo: "Agendar una cita",
    desc: "Elige un horario disponible y confirma tu cita.",
    to: "/estudiante/agendar",
    icon: "📅",
    tint: "bg-amber-50",
  },
  {
    titulo: "Mis citas",
    desc: "Consulta o cancela tus citas programadas.",
    to: "/estudiante/mis-citas",
    icon: "🗂️",
    tint: "bg-emerald-50",
  },
  {
    titulo: "Eventos e inscripciones",
    desc: "Consulta los talleres y actividades, e inscríbete.",
    to: "/estudiante/eventos",
    icon: "🎉",
    tint: "bg-violet-50",
  },
  {
    titulo: "Asistente de orientación",
    desc: "Resuelve dudas sobre servicios, citas y eventos.",
    to: "/estudiante/asistente",
    icon: "✨",
    tint: "bg-rose-50",
  },
];

// Inicio del panel Estudiante: servicios y citas (Sprint 2), eventos
// (Sprint 4) y asistente de orientación (Sprint 5).
export function InicioEstudiante() {
  const { usuario } = useAuth();
  const primerNombre = usuario?.nombre?.split(" ")[0];

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">Hola, {primerNombre} 👋</h1>
      <p className="text-gray-500 mb-8">
        Bienvenida/o a tu espacio de Bienestar. Iniciaste sesión como{" "}
        <strong className="text-ink-900">{usuario?.rol}</strong> con tu cuenta institucional.
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
