import { Routes, Route } from "react-router-dom";
import { Navbar } from "../comunes/componentes/Navbar";
import { InicioEstudiante } from "./InicioEstudiante";
import { ServiciosPage } from "./ServiciosPage";
import { AgendarCitaPage } from "./AgendarCitaPage";
import { MisCitasPage } from "./MisCitasPage";
import { EventosPage } from "./EventosPage";
import { AsistentePage } from "./AsistentePage";

// Layout + enrutado del rol Estudiante (HU-04). Sprint 2 agrega Servicios,
// Agendar cita y Mis citas (HU-06 a HU-12); Sprint 4 agrega Eventos
// (RF-010) y Sprint 5 el Asistente de orientación (RF-014), siguiendo la
// estructura de carpetas de F-03 (seccion 6.2).
export function EstudiantePanel() {
  return (
    <div className="tema-desarrollo-humano min-h-screen fondo-panel panel-moderno">
      <Navbar modulo="desarrollo-humano" />
      <Routes>
        <Route index element={<InicioEstudiante />} />
        <Route path="servicios" element={<ServiciosPage />} />
        <Route path="agendar" element={<AgendarCitaPage />} />
        <Route path="mis-citas" element={<MisCitasPage />} />
        <Route path="eventos" element={<EventosPage />} />
        <Route path="asistente" element={<AsistentePage />} />
      </Routes>
    </div>
  );
}
