import { Routes, Route } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import { InicioAdmin } from "./InicioAdmin";
import { GestionHorariosPage } from "./GestionHorariosPage";
import { AgendaAdminPage } from "./AgendaAdminPage";
import { GestionEventosPage } from "./GestionEventosPage";
import { EventoInscritosPage } from "./EventoInscritosPage";
import { UsuariosPage } from "./UsuariosPage";
import { EstadisticasPage } from "./EstadisticasPage";

// Layout + enrutado del rol Administrador (HU-04, HU-05). Sprint 3 agrega
// Gestión de horarios y Agenda/asistencia (HU-13 a HU-16); Sprint 4 agrega
// Gestión de eventos e inscritos/asistencia (RF-009, RF-011); Sprint 5
// agrega Usuarios (RF-012) y Estadísticas (RF-015), siguiendo F-03 (6.2).
export function AdminPanel() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<InicioAdmin />} />
        <Route path="horarios" element={<GestionHorariosPage />} />
        <Route path="citas" element={<AgendaAdminPage />} />
        <Route path="eventos" element={<GestionEventosPage />} />
        <Route path="eventos/:id/inscritos" element={<EventoInscritosPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="estadisticas" element={<EstadisticasPage />} />
      </Routes>
    </AdminLayout>
  );
}
