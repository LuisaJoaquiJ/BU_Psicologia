import { Routes, Route } from "react-router-dom";
import { Navbar } from "../../components/Navbar";
import { InicioEstudiante } from "./InicioEstudiante";
import { ServiciosPage } from "./ServiciosPage";
import { AgendarCitaPage } from "./AgendarCitaPage";
import { MisCitasPage } from "./MisCitasPage";
import { EventosPage } from "./EventosPage";

function Proximamente({ titulo, nota }) {
  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-10">
      <h1 className="text-2xl font-bold text-ink-900 mb-1">{titulo}</h1>
      <p className="text-gray-500">Próximamente ({nota}).</p>
    </main>
  );
}

// Layout + enrutado del rol Estudiante (HU-04). Sprint 2 agrega Servicios,
// Agendar cita y Mis citas (HU-06 a HU-12); Sprint 4 agrega Eventos
// (RF-010); el Asistente llega en el Sprint 5, siguiendo la estructura de
// carpetas de F-03 (seccion 6.2).
export function EstudiantePanel() {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route index element={<InicioEstudiante />} />
        <Route path="servicios" element={<ServiciosPage />} />
        <Route path="agendar" element={<AgendarCitaPage />} />
        <Route path="mis-citas" element={<MisCitasPage />} />
        <Route path="eventos" element={<EventosPage />} />
        <Route
          path="asistente"
          element={<Proximamente titulo="Asistente con IA" nota="RF-014 · Sprint 5" />}
        />
      </Routes>
    </div>
  );
}
