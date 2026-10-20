import { Routes, Route } from "react-router-dom";
import { Navbar } from "../comunes/componentes/Navbar";
import { MisCitasPage } from "./MisCitasPage";
import { SaludEstudiantePage, SaludParticipacionesPage } from "./SaludEstudiantePage";
import { SalidasEstudiantePage } from "./SalidasEstudiantePage";
import { JornadasEstudiantePage } from "./JornadasEstudiantePage";

// Area del estudiante en el modulo Salud integral (/mi-salud). Es
// independiente del area de Desarrollo humano (/estudiante): su propio
// menu, sus propias citas y sus participaciones.
export function SaludEstudiantePanel() {
  return (
    <div className="tema-salud min-h-screen fondo-panel panel-moderno">
      <Navbar modulo="salud" />
      <Routes>
        <Route index element={<SaludEstudiantePage />} />
        <Route path="mis-citas" element={<MisCitasPage />} />
        <Route path="jornadas" element={<JornadasEstudiantePage />} />
        <Route path="participaciones" element={<SaludParticipacionesPage />} />
        <Route path="salidas" element={<SalidasEstudiantePage />} />
      </Routes>
    </div>
  );
}
