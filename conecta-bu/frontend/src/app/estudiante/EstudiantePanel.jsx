import { useAuth } from "../../lib/auth/AuthContext";
import { Navbar } from "../../components/Navbar";

// Pantalla base del rol Estudiante (HU-04). Las secciones de Servicios,
// Mis citas, Eventos y Asistente se implementan en los sprints 2 a 5,
// siguiendo la estructura de carpetas propuesta en F-03 (seccion 6.2).
export function EstudiantePanel() {
  const { usuario } = useAuth();

  return (
    <div>
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-primary mb-1">
          Bienvenida/o, {usuario?.nombre}
        </h1>
        <p className="text-gray-600 mb-6">
          Iniciaste sesion como <strong>{usuario?.rol}</strong> con tu cuenta institucional.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ["Servicios de Desarrollo Humano", "RF-003 · Sprint 2"],
            ["Agendar una cita", "RF-004 / RF-005 · Sprint 2"],
            ["Eventos e inscripciones", "RF-009 / RF-010 · Sprint 4"],
            ["Asistente con IA", "RF-014 · Sprint 5"],
          ].map(([titulo, nota]) => (
            <div key={titulo} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-medium">{titulo}</h2>
              <p className="text-sm text-gray-400 mt-1">Proximamente ({nota})</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
