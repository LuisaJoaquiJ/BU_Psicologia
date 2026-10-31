import { Route, Routes } from "react-router-dom";
import { Barra } from "../comun/Barra";
import { AgendaPersonal, ConvocatoriasPersonal, GruposPersonal, InicioPersonal } from "./Paginas";

export function CulturaPanel() {
  return (
    <div className="tema-cultura min-h-screen fondo-panel panel-moderno">
      <Barra variante="personal" />
      <Routes>
        <Route index element={<InicioPersonal />} />
        <Route path="grupos" element={<GruposPersonal />} />
        <Route path="agenda" element={<AgendaPersonal />} />
        <Route path="convocatorias" element={<ConvocatoriasPersonal />} />
      </Routes>
    </div>
  );
}
