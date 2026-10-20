import { Route, Routes } from "react-router-dom";
import { Navbar } from "../comunes/componentes/Navbar";
import { EventosEstudiantePage } from "./EventosEstudiantePage";
import { InicioDeporte } from "./InicioDeporte";
import { MisHorasPage } from "./MisHorasPage";
import { OfertaPage } from "./OfertaPage";
import { ConfirmarProvider } from "../comunes/componentes/Confirmar";

// Área de Deporte del estudiante: menú y rutas.

export function MiDeportePanel() {
  return (
    <ConfirmarProvider>
      <div className="tema-deporte min-h-screen fondo-panel panel-moderno">
        <Navbar modulo="deporte" />
        <Routes>
          <Route index element={<InicioDeporte />} />
          <Route path="oferta" element={<OfertaPage />} />
          <Route path="horas" element={<MisHorasPage />} />
          <Route path="eventos" element={<EventosEstudiantePage />} />
        </Routes>
      </div>
    </ConfirmarProvider>
  );
}
