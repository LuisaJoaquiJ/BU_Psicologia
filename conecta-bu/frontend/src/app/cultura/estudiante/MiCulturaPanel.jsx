import { Route, Routes } from "react-router-dom";
import { Barra } from "../comun/Barra";
import { AgendaCultura, ConvocatoriasCultura, GruposCultura, InicioCultura } from "./Paginas";

export function MiCulturaPanel() {
  return (
    <div className="tema-cultura min-h-screen fondo-panel panel-moderno">
      <Barra />
      <Routes>
        <Route index element={<InicioCultura />} />
        <Route path="grupos" element={<GruposCultura />} />
        <Route path="agenda" element={<AgendaCultura />} />
        <Route path="convocatorias" element={<ConvocatoriasCultura />} />
      </Routes>
    </div>
  );
}
