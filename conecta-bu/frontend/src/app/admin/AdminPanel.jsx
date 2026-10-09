import { Routes, Route } from "react-router-dom";
import { Navbar } from "../../components/Navbar";
import { InicioAdmin } from "./InicioAdmin";
import { GestionHorariosPage } from "./GestionHorariosPage";
import { AgendaAdminPage } from "./AgendaAdminPage";

function Proximamente({ titulo, nota }) {
  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">{titulo}</h1>
      <p className="text-gray-500">Próximamente ({nota}).</p>
    </main>
  );
}

// Layout + enrutado del rol Administrador (HU-04, HU-05). Sprint 3 agrega
// Gestión de horarios y Agenda/asistencia (HU-13 a HU-16); Eventos y
// Usuarios llegan en los sprints 4 y 5, siguiendo F-03 (seccion 6.2).
export function AdminPanel() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route index element={<InicioAdmin />} />
        <Route path="horarios" element={<GestionHorariosPage />} />
        <Route path="citas" element={<AgendaAdminPage />} />
        <Route path="eventos" element={<Proximamente titulo="Gestión de eventos" nota="RF-009 · Sprint 4" />} />
        <Route
          path="usuarios"
          element={<Proximamente titulo="Usuarios y dashboard" nota="RF-012 / RF-015 · Sprint 5" />}
        />
      </Routes>
    </div>
  );
}
