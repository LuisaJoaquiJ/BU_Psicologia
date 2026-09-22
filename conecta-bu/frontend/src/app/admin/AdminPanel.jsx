import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { Navbar } from "../../components/Navbar";
import { http } from "../../lib/api/http";

// Pantalla base del rol Administrador (HU-04). Ademas confirma, contra el
// backend, que las rutas administrativas quedan protegidas por rol (HU-05).
export function AdminPanel() {
  const { usuario } = useAuth();
  const [estadoPing, setEstadoPing] = useState("Verificando permisos administrativos...");

  useEffect(() => {
    http
      .get("/admin/ping")
      .then((res) => setEstadoPing(res.data.message))
      .catch(() => setEstadoPing("No fue posible confirmar el acceso administrativo."));
  }, []);

  return (
    <div>
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-primary mb-1">
          Panel administrativo — {usuario?.nombre}
        </h1>
        <p className="text-sm text-green-700 bg-green-50 inline-block rounded-md px-3 py-1 mb-6">
          {estadoPing}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            ["Gestion de horarios", "RF-008 · Sprint 3"],
            ["Agenda y asistencia a citas", "RF-007 · Sprint 3"],
            ["Gestion de eventos", "RF-009 · Sprint 4"],
            ["Usuarios y dashboard", "RF-012 / RF-015 · Sprint 5"],
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
