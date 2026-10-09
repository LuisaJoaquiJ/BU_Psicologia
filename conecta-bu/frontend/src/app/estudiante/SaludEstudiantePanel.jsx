import { Routes, Route } from "react-router-dom";
import { Navbar } from "../../components/Navbar";
import { MisCitasPage } from "./MisCitasPage";
import { SaludEstudiantePage, SaludParticipacionesPage } from "./SaludEstudiantePage";

// Area del estudiante en el modulo Salud integral (/mi-salud). Es
// independiente del area de Desarrollo humano (/estudiante): su propio
// menu, sus propias citas y sus participaciones.
export function SaludEstudiantePanel() {
  return (
    <div>
      <Navbar modulo="salud" />
      <Routes>
        <Route index element={<SaludEstudiantePage />} />
        <Route path="mis-citas" element={<MisCitasPage modulo="salud" />} />
        <Route path="participaciones" element={<SaludParticipacionesPage />} />
      </Routes>
    </div>
  );
}
